import { normalizeMultimodalPayload } from '@nexo/shared';
import { type Context, Hono } from 'hono';
import { ZodError } from 'zod';
import { StubOcrAdapter } from './adapters/ocr/ocr-adapter';
import { StubSttAdapter } from './adapters/stt/stt-adapter';
import { getWorkerEnv } from './config/env';
import { getWorkerFeatureFlags } from './config/feature-flags';

function jsonError(c: Context, status: 400 | 401 | 422 | 500, error: string, message: string) {
	return c.json(
		{
			error,
			message,
		},
		status,
	);
}

function hasAttachmentsArray(body: unknown): body is { attachments: unknown[] } {
	if (!body || typeof body !== 'object') {
		return false;
	}

	const payload = body as { attachments?: unknown };
	return Array.isArray(payload.attachments);
}

function isAuthorizedRequest(c: Context): boolean {
	const configuredToken = getWorkerEnv().INTAKE_WORKER_TOKEN;
	if (!configuredToken) {
		return true;
	}

	const authorization = c.req.header('authorization');
	if (!authorization) {
		return false;
	}

	const match = authorization.match(/^Bearer\s+(.+)$/i);
	if (!match) {
		return false;
	}

	return match[1] === configuredToken;
}

function getUnprocessableAttachmentMessage(error: unknown): string | null {
	if (error instanceof ZodError) {
		return error.issues[0]?.message ?? 'Invalid attachment payload';
	}

	if (error instanceof Error && (error.message.includes('feature flag is disabled') || error.message.includes('payload must'))) {
		return error.message;
	}

	return null;
}

export function createIntakeWorkerApp() {
	const app = new Hono();
	const sttAdapter = new StubSttAdapter();
	const ocrAdapter = new StubOcrAdapter();

	app.get('/health', (c) => {
		const flags = getWorkerFeatureFlags();
		return c.json({
			status: 'ok',
			service: 'intake-worker',
			timestamp: new Date().toISOString(),
			features: {
				audio: flags.MULTIMODAL_AUDIO,
				image: flags.MULTIMODAL_IMAGE,
			},
		});
	});

	app.post('/intake/process', async (c) => {
		if (!isAuthorizedRequest(c)) {
			return jsonError(c, 401, 'unauthorized', 'Missing or invalid bearer token');
		}

		const flags = getWorkerFeatureFlags();
		const body = await c.req.json().catch(() => null);

		if (!hasAttachmentsArray(body)) {
			return jsonError(c, 400, 'invalid_request', 'Request body must include an attachments array');
		}

		try {
			const items = await Promise.all(
				body.attachments.map(async (payload) => {
					const normalized = normalizeMultimodalPayload(payload, flags);

					if (normalized.kind === 'audio') {
						const transcription = await sttAdapter.transcribe(normalized);
						return {
							kind: 'audio' as const,
							messageId: normalized.messageId,
							text: transcription.text,
							metadata: {
								provider: transcription.provider,
								transport: normalized.transport,
								mimeType: normalized.mimeType,
							},
						};
					}

					const extraction = await ocrAdapter.extractText(normalized);
					return {
						kind: 'image' as const,
						messageId: normalized.messageId,
						text: extraction.text,
						metadata: {
							provider: extraction.provider,
							transport: normalized.transport,
							mimeType: normalized.mimeType,
						},
					};
				}),
			);

			return c.json({ items }, 200);
		} catch (error) {
			const unprocessableMessage = getUnprocessableAttachmentMessage(error);
			if (unprocessableMessage) {
				return jsonError(c, 422, 'unprocessable_attachment', unprocessableMessage);
			}

			return jsonError(c, 500, 'internal_error', 'Failed to process attachments');
		}
	});

	return app;
}
