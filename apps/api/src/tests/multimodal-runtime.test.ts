import type { MessageMetadata } from '@/adapters/messaging';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const processAttachmentsMock = vi.fn();
const getPivotFeatureFlagsMock = vi.fn();

vi.mock('@/services/intake-worker-client', () => ({
	intakeWorkerClient: {
		processAttachments: processAttachmentsMock,
	},
}));

vi.mock('@/config/pivot-feature-flags', () => ({
	getPivotFeatureFlags: getPivotFeatureFlagsMock,
}));

function createMetadata(overrides: Partial<MessageMetadata> = {}): MessageMetadata {
	return {
		isGroupMessage: false,
		messageType: 'text',
		providerPayload: { raw: true },
		...overrides,
	};
}

describe('applyMultimodalRuntime', () => {
	beforeEach(() => {
		vi.resetModules();
		processAttachmentsMock.mockReset();
		getPivotFeatureFlagsMock.mockResolvedValue({
			CONVERSATION_FREE: false,
			TOOL_SCHEMA_V2: false,
			MULTIMODAL_AUDIO: true,
			MULTIMODAL_IMAGE: true,
			PROVIDER_SPLIT: false,
			ELYSIA_RUNTIME: false,
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('enriches message and trigger metadata on multimodal success', async () => {
		processAttachmentsMock.mockResolvedValue({
			items: [{ kind: 'image', messageId: 'msg-1', text: 'cartaz do filme' }],
		});

		const { applyMultimodalRuntime } = await import('@/services/multimodal-runtime');
		const result = await applyMultimodalRuntime(
			'quero salvar isso',
			createMetadata({
				attachments: [
					{
						kind: 'image',
						messageId: 'msg-1',
						userId: 'user-1',
						mimeType: 'image/png',
						url: 'https://cdn.example/image.png',
					},
				],
			}),
		);

		expect(processAttachmentsMock).toHaveBeenCalledTimes(1);
		expect(result.message).toContain('Contexto multimodal detectado');
		expect(result.message).toContain('[image] cartaz do filme');
		expect(result.providerPayload).toMatchObject({
			raw: true,
			multimodalTrigger: {
				source: 'message-service',
				intakeWorker: {
					status: 'processed',
					requested: 1,
					returned: 1,
				},
			},
		});
	});

	it('keeps deterministic text path and tags failure metadata when worker fails', async () => {
		processAttachmentsMock.mockRejectedValue(new Error('down'));

		const { applyMultimodalRuntime } = await import('@/services/multimodal-runtime');
		const result = await applyMultimodalRuntime(
			'mensagem original',
			createMetadata({
				attachments: [
					{
						kind: 'audio',
						messageId: 'msg-2',
						userId: 'user-2',
						mimeType: 'audio/ogg',
						url: 'https://cdn.example/audio.ogg',
					},
				],
			}),
		);

		expect(result.message).toBe('mensagem original');
		expect(result.providerPayload).toMatchObject({
			multimodalTrigger: {
				intakeWorker: {
					status: 'failed',
					reason: 'intake_worker_failed',
				},
			},
		});
	});

	it('does not call worker when modality flags are disabled', async () => {
		getPivotFeatureFlagsMock.mockResolvedValue({
			CONVERSATION_FREE: false,
			TOOL_SCHEMA_V2: false,
			MULTIMODAL_AUDIO: false,
			MULTIMODAL_IMAGE: false,
			PROVIDER_SPLIT: false,
			ELYSIA_RUNTIME: false,
		});

		const metadata = createMetadata({
			providerPayload: { keep: 'same' },
			attachments: [
				{
					kind: 'audio',
					messageId: 'msg-3',
					userId: 'user-3',
					mimeType: 'audio/mpeg',
					url: 'https://cdn.example/audio.mp3',
				},
			],
		});

		const { applyMultimodalRuntime } = await import('@/services/multimodal-runtime');
		const result = await applyMultimodalRuntime('texto sem mudança', metadata);

		expect(processAttachmentsMock).not.toHaveBeenCalled();
		expect(result).toEqual({
			message: 'texto sem mudança',
			providerPayload: { keep: 'same' },
		});
	});
});
