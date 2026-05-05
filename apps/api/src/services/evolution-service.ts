import { env } from '@/config/env';
import { db } from '@/db';
import { whatsappSettings } from '@/db/schema';
import { instrumentService } from '@/services/service-instrumentation';
import { loggers } from '@/utils/logger';

interface EvolutionInstancePayload {
	instance?: {
		instanceName?: string;
		status?: string;
		owner?: string;
		profileName?: string;
		apikey?: string;
	};
}

interface EvolutionConnectionStateResponse {
	instance?: {
		instanceName?: string;
		state?: string;
	};
}

interface EvolutionConnectResponse {
	pairingCode?: string;
	code?: string;
	count?: number;
}

interface EvolutionSendListSection {
	title: string;
	rows: Array<{
		title: string;
		description?: string;
		rowId: string;
	}>;
}

function normalizeStatus(status?: string): 'connecting' | 'connected' | 'disconnected' | 'error' {
	const normalized = (status || '').toLowerCase();
	if (normalized === 'open' || normalized === 'connected') return 'connected';
	if (normalized === 'connecting' || normalized === 'created') return 'connecting';
	if (normalized === 'close' || normalized === 'closed' || normalized === 'disconnected') return 'disconnected';
	return 'error';
}

export class EvolutionService {
	private readonly baseUrl = env.EVOLUTION_API_BASE_URL.replace(/\/+$/, '');
	private readonly instanceName = env.EVOLUTION_INSTANCE_NAME;
	private readonly maxRetries = 3;
	private readonly retryBaseDelayMs = 500;
	private readonly retryMaxDelayMs = 5000;

	private circuitBreakerFailures = 0;
	private circuitBreakerOpenUntil = 0;
	private static readonly CIRCUIT_BREAKER_THRESHOLD = 5;
	private static readonly CIRCUIT_BREAKER_RESET_MS = 30_000;

	private get apiKey(): string {
		if (!env.EVOLUTION_API_KEY || !env.EVOLUTION_API_KEY.trim()) {
			throw new Error('EVOLUTION_API_KEY não configurada');
		}
		return env.EVOLUTION_API_KEY;
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private backoffDelay(attempt: number): number {
		const exponential = Math.min(this.retryMaxDelayMs, this.retryBaseDelayMs * 2 ** (attempt - 1));
		const jitter = Math.floor(Math.random() * 200);
		return exponential + jitter;
	}

	private isCircuitOpen(): boolean {
		if (this.circuitBreakerFailures >= EvolutionService.CIRCUIT_BREAKER_THRESHOLD) {
			if (Date.now() < this.circuitBreakerOpenUntil) {
				return true;
			}
			this.circuitBreakerFailures = 0;
			this.circuitBreakerOpenUntil = 0;
		}
		return false;
	}

	private recordCircuitFailure(): void {
		this.circuitBreakerFailures++;
		if (this.circuitBreakerFailures >= EvolutionService.CIRCUIT_BREAKER_THRESHOLD) {
			this.circuitBreakerOpenUntil = Date.now() + EvolutionService.CIRCUIT_BREAKER_RESET_MS;
			loggers.api.warn(
				{ failures: this.circuitBreakerFailures, resetMs: EvolutionService.CIRCUIT_BREAKER_RESET_MS },
				'⚡ Evolution API circuit breaker ABERTO',
			);
		}
	}

	private recordCircuitSuccess(): void {
		this.circuitBreakerFailures = 0;
		this.circuitBreakerOpenUntil = 0;
	}

	private isRetryableError(error: unknown): boolean {
		if (error instanceof Error) {
			const code = String((error as any).code || '').toUpperCase();
			const retryableCodes = new Set([
				'ECONNRESET',
				'ECONNREFUSED',
				'ETIMEDOUT',
				'ENOTFOUND',
				'UND_ERR_CONNECT_TIMEOUT',
			]);
			if (retryableCodes.has(code)) return true;
		}
		return false;
	}

	private async upsertSettings(payload: {
		instanceName?: string;
		phoneNumber?: string;
		connectionStatus?: 'connecting' | 'connected' | 'disconnected' | 'error';
		lastError?: string | null;
	}): Promise<void> {
		await db
			.insert(whatsappSettings)
			.values({
				id: 'global',
				activeApi: 'evolution',
				phoneNumber: payload.phoneNumber,
				connectionStatus: payload.connectionStatus,
				lastError: payload.lastError || null,
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: whatsappSettings.id,
				set: {
					activeApi: 'evolution',
					phoneNumber: payload.phoneNumber,
					connectionStatus: payload.connectionStatus,
					lastError: payload.lastError || null,
					updatedAt: new Date(),
				},
			});
	}

	private requestUrl(path: string, query?: Record<string, string | undefined>): string {
		const url = new URL(`${this.baseUrl}${path}`);
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				if (value?.trim()) {
					url.searchParams.set(key, value);
				}
			}
		}
		return url.toString();
	}

	private async request<T>(
		method: 'GET' | 'POST' | 'PUT' | 'DELETE',
		path: string,
		options?: {
			query?: Record<string, string | undefined>;
			body?: unknown;
			acceptNotFound?: boolean;
		},
	): Promise<T | null> {
		if (this.isCircuitOpen()) {
			throw new Error(`Evolution API circuit breaker aberto — ${method} ${path} ignorado`);
		}

		let lastError: unknown;

		for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
			try {
				const response = await fetch(this.requestUrl(path, options?.query), {
					method,
					headers: {
						apikey: this.apiKey,
						'Content-Type': 'application/json',
					},
					body: options?.body ? JSON.stringify(options.body) : undefined,
				});

				if (response.status === 404 && options?.acceptNotFound) {
					this.recordCircuitSuccess();
					return null;
				}

				if (!response.ok) {
					const errorText = await response.text();
					const error = new Error(`Evolution API ${method} ${path} failed: ${response.status} ${errorText}`);
					(error as any).statusCode = response.status;

					if (response.status >= 500 || response.status === 429) {
						lastError = error;
						const isLastAttempt = attempt >= this.maxRetries + 1;
						if (!isLastAttempt) {
							const delayMs = this.backoffDelay(attempt);
							loggers.api.warn(
								{ method, path, status: response.status, attempt, delayMs },
								'🔁 Evolution API erro transitório, retry agendado',
							);
							await this.sleep(delayMs);
							continue;
						}
					}

					this.recordCircuitFailure();
					throw error;
				}

				this.recordCircuitSuccess();

				if (response.status === 204) {
					return null;
				}

				return (await response.json()) as T;
			} catch (error) {
				if (error instanceof Error && (error as any).statusCode) {
					throw error;
				}

				lastError = error;
				const isLastAttempt = attempt >= this.maxRetries + 1;

				if (this.isRetryableError(error) && !isLastAttempt) {
					const delayMs = this.backoffDelay(attempt);
					loggers.api.warn(
						{ method, path, attempt, delayMs, err: error },
						'🔁 Evolution API fetch falhou, retry agendado',
					);
					await this.sleep(delayMs);
					continue;
				}

				this.recordCircuitFailure();
				throw error;
			}
		}

		this.recordCircuitFailure();
		throw lastError instanceof Error ? lastError : new Error(String(lastError));
	}

	private normalizeRecipient(recipient: string): string {
		const raw = recipient.includes('@') ? recipient.split('@')[0] : recipient;
		return raw.replace(/\D/g, '');
	}

	private inferMimeType(url: string): string {
		const lower = url.toLowerCase();
		if (lower.endsWith('.png')) return 'image/png';
		if (lower.endsWith('.webp')) return 'image/webp';
		if (lower.endsWith('.gif')) return 'image/gif';
		return 'image/jpeg';
	}

	async sendMediaAudio(
		recipient: string,
		audioBase64: string,
		mimeType: string,
		fileName: string,
	): Promise<void> {
		await this.request('POST', `/message/sendMedia/${this.instanceName}`, {
			body: {
				number: this.normalizeRecipient(recipient),
				mediatype: 'audio',
				mimetype: mimeType,
				caption: ' ',
				media: `data:${mimeType};base64,${audioBase64}`,
				fileName,
			},
		});
	}

	async sendList(
		recipient: string,
		params: {
			title: string;
			description: string;
			buttonText: string;
			footerText: string;
			values: EvolutionSendListSection[];
		},
	): Promise<void> {
		await this.request('POST', `/message/sendList/${this.instanceName}`, {
			body: {
				number: this.normalizeRecipient(recipient),
				title: params.title,
				description: params.description,
				buttonText: params.buttonText,
				footerText: params.footerText,
				values: params.values,
			},
		});
	}

	async getInformation(): Promise<Record<string, unknown> | null> {
		return await this.request<Record<string, unknown>>('GET', '/', {
			acceptNotFound: true,
		});
	}

	async fetchInstances(instanceName?: string): Promise<EvolutionInstancePayload[]> {
		const response = await this.request<any>('GET', '/instance/fetchInstances', {
			acceptNotFound: true,
			query: {
				instanceName,
			},
		});

		if (!response) {
			return [];
		}

		if (Array.isArray(response)) {
			return response as EvolutionInstancePayload[];
		}

		if (response?.response && Array.isArray(response.response)) {
			return response.response as EvolutionInstancePayload[];
		}

		return [];
	}

	async getInstance(): Promise<EvolutionInstancePayload | null> {
		const instances = await this.fetchInstances(this.instanceName);
		return instances.find((item) => item.instance?.instanceName === this.instanceName) || null;
	}

	async getConnectionState(): Promise<EvolutionConnectionStateResponse | null> {
		const response = await this.request<EvolutionConnectionStateResponse>(
			'GET',
			`/instance/connectionState/${this.instanceName}`,
			{
				acceptNotFound: true,
			},
		);

		if (response) {
			await this.upsertSettings({
				connectionStatus: normalizeStatus(response.instance?.state),
				lastError: null,
			});
		}

		return response;
	}

	async connectInstance(number?: string): Promise<EvolutionConnectResponse | null> {
		await this.upsertSettings({
			connectionStatus: 'connecting',
			lastError: null,
		});

		return await this.request<EvolutionConnectResponse>('GET', `/instance/connect/${this.instanceName}`, {
			query: { number },
			acceptNotFound: true,
		});
	}

	async restartInstance(): Promise<Record<string, unknown> | null> {
		await this.upsertSettings({
			connectionStatus: 'connecting',
			lastError: null,
		});
		return await this.request<Record<string, unknown>>('PUT', `/instance/restart/${this.instanceName}`, {
			acceptNotFound: true,
		});
	}

	async logoutInstance(): Promise<Record<string, unknown> | null> {
		await this.upsertSettings({
			connectionStatus: 'disconnected',
			lastError: null,
		});
		return await this.request<Record<string, unknown>>('DELETE', `/instance/logout/${this.instanceName}`, {
			acceptNotFound: true,
		});
	}

	async sendText(recipient: string, text: string): Promise<void> {
		await this.request('POST', `/message/sendText/${this.instanceName}`, {
			body: {
				number: this.normalizeRecipient(recipient),
				text,
			},
		});
	}

	async sendMediaImage(recipient: string, mediaUrl: string, caption?: string): Promise<void> {
		const fileName = mediaUrl.split('/').pop() || 'image.jpg';
		await this.request('POST', `/message/sendMedia/${this.instanceName}`, {
			body: {
				number: this.normalizeRecipient(recipient),
				mediatype: 'image',
				mimetype: this.inferMimeType(mediaUrl),
				caption: caption || ' ',
				media: mediaUrl,
				fileName,
			},
		});
	}

	async sendList(
		recipient: string,
		params: {
			title: string;
			description: string;
			buttonText: string;
			footerText: string;
			values: EvolutionSendListSection[];
		},
	): Promise<void> {
		await this.request('POST', `/message/sendList/${this.instanceName}`, {
			body: {
				number: this.normalizeRecipient(recipient),
				title: params.title,
				description: params.description,
				buttonText: params.buttonText,
				footerText: params.footerText,
				values: params.values,
			},
		});
	}

	async syncSettingsFromInstance(instancePayload: EvolutionInstancePayload): Promise<void> {
		const instance = instancePayload.instance;
		await this.upsertSettings({
			instanceName: instance?.instanceName,
			phoneNumber: instance?.owner ? instance.owner.split('@')[0] : undefined,
			connectionStatus: normalizeStatus(instance?.status),
			lastError: null,
		});
	}
}

export const evolutionService = instrumentService('evolution', new EvolutionService());
