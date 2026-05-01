import { Hono } from 'hono';
import type { MultimodalIntakePayload } from '@nexo/shared';

interface IntakeProcessRequest {
	attachments: MultimodalIntakePayload[];
}

interface IntakeProcessResponse {
	items: Array<{
		kind: 'audio' | 'image';
		messageId: string;
		text: string;
		metadata?: Record<string, unknown>;
	}>;
}

/**
 * Intake processor — internal API route replacing the external intake-worker app.
 *
 * TODO: implement real audio transcription (Whisper) and image description (vision model)
 * using the existing Cloudflare AI Gateway / AI SDK infrastructure.
 */
export const intakeRoutes = new Hono().post('/process', async (c) => {
	const { attachments } = await c.req.json<IntakeProcessRequest>();

	const items: IntakeProcessResponse['items'] = attachments.map((att, index) => ({
		kind: att.kind as 'audio' | 'image',
		messageId: att.messageId || `att-${index}`,
		text:
			att.kind === 'audio'
				? '[Áudio recebido — transcrição será implementada em breve]'
				: '[Imagem recebida — descrição será implementada em breve]',
		metadata: { source: 'internal-intake', originalSize: att.size },
	}));

	return c.json<IntakeProcessResponse>({ items });
});
