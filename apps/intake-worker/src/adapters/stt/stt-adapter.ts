import type { NormalizedAudioPayload } from '@nexo/shared';

export interface SttTranscriptionResult {
	provider: string;
	text: string;
	confidence?: number;
}

export interface SttAdapter {
	transcribe(input: NormalizedAudioPayload): Promise<SttTranscriptionResult>;
}

export class StubSttAdapter implements SttAdapter {
	async transcribe(_input: NormalizedAudioPayload): Promise<SttTranscriptionResult> {
		return {
			provider: 'stub-stt',
			text: '',
		};
	}
}
