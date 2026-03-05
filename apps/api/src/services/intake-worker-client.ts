import { env } from '@/config/env';
import type { MultimodalIntakePayload } from '@nexo/shared';

interface IntakeWorkerResponseItem {
	kind: 'audio' | 'image';
	messageId: string;
	text: string;
	metadata?: Record<string, unknown>;
}

export interface IntakeWorkerProcessResponse {
	items: IntakeWorkerResponseItem[];
}

export class IntakeWorkerClient {
	async processAttachments(attachments: MultimodalIntakePayload[]): Promise<IntakeWorkerProcessResponse> {
		if (attachments.length === 0) {
			return { items: [] };
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), env.INTAKE_WORKER_TIMEOUT_MS);

		try {
			const headers: Record<string, string> = {
				'content-type': 'application/json',
			};

			if (env.INTAKE_WORKER_TOKEN) {
				headers.authorization = `Bearer ${env.INTAKE_WORKER_TOKEN}`;
			}

			const response = await fetch(`${env.INTAKE_WORKER_URL}/intake/process`, {
				method: 'POST',
				headers,
				body: JSON.stringify({ attachments }),
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`intake-worker request failed (${response.status})`);
			}

			return (await response.json()) as IntakeWorkerProcessResponse;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error('intake-worker request timed out');
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}
}

export const intakeWorkerClient = new IntakeWorkerClient();
