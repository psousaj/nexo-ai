import type { MessageMetadata } from '@/adapters/messaging';
import { getPivotFeatureFlags } from '@/config/pivot-feature-flags';
import { intakeWorkerClient } from '@/services/intake-worker-client';
import type { MultimodalIntakePayload } from '@nexo/shared';

interface MultimodalRuntimeOutput {
	message: string;
	providerPayload?: Record<string, unknown>;
}

function mergeProviderPayload(
	providerPayload: Record<string, unknown> | undefined,
	intakeWorker: Record<string, unknown>,
): Record<string, unknown> {
	return {
		...(providerPayload ?? {}),
		multimodalTrigger: {
			source: 'message-service',
			intakeWorker,
		},
	};
}

function filterEnabledAttachments(attachments: MultimodalIntakePayload[]): MultimodalIntakePayload[] {
	const flags = getPivotFeatureFlags();
	return attachments.filter((attachment) => {
		if (attachment.kind === 'audio') {
			return flags.MULTIMODAL_AUDIO;
		}
		return flags.MULTIMODAL_IMAGE;
	});
}

function buildMultimodalPrompt(items: { kind: 'audio' | 'image'; text: string }[]): string {
	const lines = items.map((item, index) => `${index + 1}. [${item.kind}] ${item.text.trim()}`);
	return `\n\nContexto multimodal detectado:\n${lines.join('\n')}`;
}

export async function applyMultimodalRuntime(
	message: string,
	metadata?: MessageMetadata,
): Promise<MultimodalRuntimeOutput> {
	const baseProviderPayload = metadata?.providerPayload;
	const attachments = metadata?.attachments ?? [];

	if (attachments.length === 0) {
		return { message, providerPayload: baseProviderPayload };
	}

	const enabledAttachments = filterEnabledAttachments(attachments);
	if (enabledAttachments.length === 0) {
		return { message, providerPayload: baseProviderPayload };
	}

	try {
		const response = await intakeWorkerClient.processAttachments(enabledAttachments);
		const enrichedItems = response.items
			.filter((item) => item.text.trim().length > 0)
			.map((item) => ({ kind: item.kind, text: item.text }));

		const nextMessage = enrichedItems.length > 0 ? `${message}${buildMultimodalPrompt(enrichedItems)}` : message;
		return {
			message: nextMessage,
			providerPayload: mergeProviderPayload(baseProviderPayload, {
				status: 'processed',
				requested: enabledAttachments.length,
				returned: response.items.length,
			}),
		};
	} catch {
		return {
			message,
			providerPayload: mergeProviderPayload(baseProviderPayload, {
				status: 'failed',
				requested: enabledAttachments.length,
				reason: 'intake_worker_failed',
			}),
		};
	}
}
