export interface Attachment {
	kind: 'audio' | 'image';
	messageId: string;
	mimeType: string;
	url: string;
}

export interface ProcessedAttachment {
	kind: 'audio' | 'image';
	transcription?: { text: string; confidence: number };
	description?: string;
}

export class AttachmentIntakeService {
	constructor(
		private deps: {
			transcribe: (attachment: Attachment) => Promise<{ text: string; confidence: number }>;
			describeImage: (attachment: Attachment) => Promise<string>;
		},
	) {}

	async process(attachments: Attachment[]): Promise<ProcessedAttachment[]> {
		return Promise.all(
			attachments.map(async (attachment) => {
				if (attachment.kind === 'audio') {
					const transcription = await this.deps.transcribe(attachment);
					return { kind: 'audio', transcription };
				}
				const description = await this.deps.describeImage(attachment);
				return { kind: 'image', description };
			}),
		);
	}
}
