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
		const timeoutId = setTimeout(() => controller.abort(), 5000);

		try {
			const response = await fetch(`http://localhost:${env.PORT}/internal/intake/process`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ attachments }),
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`internal intake request failed (${response.status})`);
			}

			return (await response.json()) as IntakeWorkerProcessResponse;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error('internal intake request timed out');
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}
}

export const intakeWorkerClient = new IntakeWorkerClient();
