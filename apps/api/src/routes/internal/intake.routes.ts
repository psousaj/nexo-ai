import { Hono } from 'hono';
import type { MultimodalIntakePayload, NormalizedAudioPayload } from '@nexo/shared';
import { whisperService } from '@/services/stt/whisper.service';
import { loggers } from '@/utils/logger';
import { env } from '@/config/env';

interface IntakeProcessRequest {
	attachments: MultimodalIntakePayload[];
}

interface IntakeProcessResponse {
	items: Array<{
		kind: "audio" | "image";
		messageId: string;
		text: string;
		metadata?: Record<string, unknown>;
	}>;
}

/**
 * Resolves a telegram-file:// URL to the actual download URL.
 * Telegram requires calling getFile API first to get the file_path.
 */
async function resolveTelegramFileUrl(fileId: string): Promise<string> {
	const botToken = env.TELEGRAM_BOT_TOKEN;
	if (!botToken) {
		throw new Error("TELEGRAM_BOT_TOKEN not configured for audio download");
	}

	const getUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
	const response = await fetch(getUrl);

	if (!response.ok) {
		throw new Error(`Telegram getFile failed: ${response.status}`);
	}

	const data = (await response.json()) as { ok: boolean; result?: { file_path?: string } };
	if (!data.ok || !data.result?.file_path) {
		throw new Error(`Telegram getFile returned no file_path for file_id=${fileId}`);
	}

	return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
}

/**
 * Resolves a URL that might use the telegram-file:// scheme.
 * Regular URLs are returned as-is.
 */
async function resolveAudioUrl(url: string): Promise<string> {
	if (url.startsWith("telegram-file://")) {
		const fileId = url.replace("telegram-file://", "");
		return await resolveTelegramFileUrl(fileId);
	}
	return url;
}

export const intakeRoutes = new Hono().post("/process", async (c) => {
	const { attachments } = await c.req.json<IntakeProcessRequest>();

	const items: IntakeProcessResponse["items"] = [];

	for (const att of attachments) {
		try {
			if (att.kind === "audio") {
				const normalized = att as NormalizedAudioPayload;
				let text: string;
				let metadata: Record<string, unknown> = { source: "whisper-stt" };

				if (normalized.transport === "url" && normalized.content) {
					const resolvedUrl = await resolveAudioUrl(normalized.content);
					const result = await whisperService.transcribeFromUrl({
						url: resolvedUrl,
						languageHint: normalized.languageHint,
					});
					text = result.text || "[Áudio transcrito sem texto detectado]";
					metadata = { ...metadata, language: result.language, duration: result.duration };
				} else if (normalized.transport === "base64" && normalized.content) {
					const audioBuffer = Buffer.from(normalized.content, "base64");
					const result = await whisperService.transcribeAudio({
						audioBuffer,
						filename: normalized.filename ?? "audio.ogg",
						mimeType: normalized.mimeType,
						languageHint: normalized.languageHint,
					});
					text = result.text || "[Áudio transcrito sem texto detectado]";
					metadata = { ...metadata, language: result.language, duration: result.duration };
				} else {
					text = "[Áudio recebido — não foi possível processar]";
					metadata = { source: "intake-fallback" };
				}

				items.push({
					kind: "audio",
					messageId: normalized.messageId,
					text,
					metadata,
				});
			} else {
				items.push({
					kind: "image",
					messageId: att.messageId,
					text: "[Imagem recebida — descrição será implementada em breve]",
					metadata: { source: "internal-intake" },
				});
			}
		} catch (error: unknown) {
			const errMsg = error instanceof Error ? error.message : String(error);
			loggers.queue.error(
				{ err: error, kind: att.kind, messageId: att.messageId },
				"❌ Erro ao processar attachment multimodal",
			);
			items.push({
				kind: att.kind as "audio" | "image",
				messageId: att.messageId,
				text:
					att.kind === "audio"
						? "[Áudio recebido — erro na transcrição]"
						: "[Imagem recebida — erro no processamento]",
				metadata: { source: "intake-error", error: errMsg },
			});
		}
	}

	return c.json<IntakeProcessResponse>({ items });
});