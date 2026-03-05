import type { NormalizedImagePayload } from '@nexo/shared';

export interface OcrExtractionResult {
	provider: string;
	text: string;
	language?: string;
}

export interface OcrAdapter {
	extractText(input: NormalizedImagePayload): Promise<OcrExtractionResult>;
}

export class StubOcrAdapter implements OcrAdapter {
	async extractText(_input: NormalizedImagePayload): Promise<OcrExtractionResult> {
		return {
			provider: 'stub-ocr',
			text: '',
		};
	}
}
