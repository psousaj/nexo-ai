import { sttService } from '@/core/enrichment/stt-service';
import { loggers } from '@/utils/logger';

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
		private deps?: {
			transcribe?: (audioBase64: string) => Promise<string | null>;
			describeImage?: (attachment: Attachment) => Promise<string>;
		},
	) {}

	async process(attachments: Attachment[]): Promise<ProcessedAttachment[]> {
		return Promise.all(
			attachments.map(async (attachment) => {
				if (attachment.kind === 'audio') {
					try {
						const audioData = await this.downloadAttachment(attachment.url);
						const text = this.deps?.transcribe
							? await this.deps.transcribe(audioData)
							: await sttService.transcribe(audioData);
						if (text) {
							return { kind: 'audio', transcription: { text, confidence: 0.9 } };
						}
					} catch (error) {
						loggers.enrichment.error({ err: error }, 'Attachment intake: erro ao processar áudio');
					}
					return { kind: 'audio' };
				}
				// Image: return as-is for now (vision to be added in next phase)
				if (attachment.kind === 'image' && this.deps?.describeImage) {
					const description = await this.deps.describeImage(attachment);
					return { kind: 'image', description };
				}
				return { kind: 'image' };
			}),
		);
	}

	private async downloadAttachment(url: string): Promise<string> {
		const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
		if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
		const buffer = await response.arrayBuffer();
		return Buffer.from(buffer).toString('base64');
	}
}
