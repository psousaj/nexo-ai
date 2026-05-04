import { Hono } from "hono";
import type {
	MultimodalIntakePayload,
	NormalizedAudioPayload,
} from "@nexo/shared";
import { whisperService } from "@/services/stt/whisper.service";
import { loggers } from "@/utils/logger";

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
					const result = await whisperService.transcribeFromUrl({
						url: normalized.content,
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