import type { MultimodalIntakePayload } from '@nexo/shared';

interface DiscordAttachmentShape {
	url: string;
	contentType?: string | null;
	name?: string | null;
	size?: number | null;
}

function mapDiscordAttachmentKind(contentType: string | undefined): 'audio' | 'image' | null {
	if (!contentType) {
		return null;
	}

	if (contentType.startsWith('image/')) {
		return 'image';
	}

	if (contentType.startsWith('audio/')) {
		return 'audio';
	}

	return null;
}

export function mapDiscordAttachmentsToMetadata(params: {
	attachments: DiscordAttachmentShape[];
	messageId: string;
	userId: string;
	timestamp: Date;
}): MultimodalIntakePayload[] {
	return params.attachments
		.map((attachment) => {
			const kind = mapDiscordAttachmentKind(attachment.contentType ?? undefined);
			if (!kind) {
				return null;
			}

			return {
				kind,
				messageId: params.messageId,
				userId: params.userId,
				timestamp: params.timestamp,
				mimeType: attachment.contentType || 'application/octet-stream',
				url: attachment.url,
				filename: attachment.name ?? undefined,
				byteLength: attachment.size ?? undefined,
			} satisfies MultimodalIntakePayload;
		})
		.filter((attachment): attachment is MultimodalIntakePayload => attachment !== null);
}
