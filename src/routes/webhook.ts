import { Elysia } from "elysia";
import { userService } from "@/services/user-service";
import { conversationService } from "@/services/conversation-service";
import { whatsappService } from "@/services/whatsapp";
import { classifierService } from "@/services/classifier-service";
import { enrichmentService } from "@/services/enrichment";
import { itemService } from "@/services/item-service";
import { aiService } from "@/services/ai";
import { env } from "@/config/env";
import {
  webhookVerifySchema,
  whatsappWebhookPayloadSchema,
  webhookSuccessResponseSchema,
  errorResponseSchema,
  type WhatsappMessage,
} from "@/schemas";

/**
 * Processa mensagem do WhatsApp
 */
async function processMessage(message: WhatsappMessage) {
  if (!message.text?.body) return;

  const phoneNumber = message.from;
  const messageText = message.text.body;

  // 1. Busca ou cria usuário
  const user = await userService.findOrCreateUser(phoneNumber);

  // 2. Busca ou cria conversação
  const conversation = await conversationService.findOrCreateConversation(
    user.id
  );

  // 3. Salva mensagem do usuário
  await conversationService.addMessage(conversation.id, "user", messageText);

  // 4. Classifica tipo de conteúdo
  const detectedType = classifierService.detectType(messageText);

  // 5. Processa baseado no tipo
  let responseText = "";

  if (detectedType === "movie") {
    const query = classifierService.extractQuery(messageText, "movie");
    const results = await enrichmentService.searchMovies(query);

    if (results.length === 0) {
      responseText = `Não encontrei nenhum filme com "${query}". Pode tentar com outro nome?`;
    } else if (results.length === 1) {
      // Salva direto
      const movie = results[0];
      const metadata = await enrichmentService.enrich("movie", {
        tmdbId: movie.id,
      });

      await itemService.createItem({
        userId: user.id,
        type: "movie",
        title: movie.title,
        metadata: metadata || undefined,
      });

      responseText = `✅ Salvo: ${movie.title} (${
        movie.release_date?.split("-")[0]
      })`;
    } else {
      // Múltiplos resultados - pede confirmação
      await conversationService.updateState(
        conversation.id,
        "awaiting_confirmation",
        {
          candidates: results.slice(0, 3),
          detected_type: "movie",
        }
      );

      const options = results
        .slice(0, 3)
        .map(
          (m, i) => `${i + 1}. ${m.title} (${m.release_date?.split("-")[0]})`
        )
        .join("\n");

      responseText = `Encontrei vários filmes:\n\n${options}\n\nQual você quer salvar? (Digite o número)`;
    }
  } else if (detectedType === "video") {
    const url = classifierService.extractUrl(messageText);
    if (url) {
      const metadata = await enrichmentService.enrich("video", { url });

      await itemService.createItem({
        userId: user.id,
        type: "video",
        title:
          (metadata && "channel_name" in metadata
            ? metadata.channel_name
            : null) || "Vídeo",
        metadata: metadata || undefined,
      });

      responseText = `✅ Vídeo salvo!`;
    }
  } else if (detectedType === "link") {
    const url = classifierService.extractUrl(messageText);
    if (url) {
      const metadata = await enrichmentService.enrich("link", { url });

      await itemService.createItem({
        userId: user.id,
        type: "link",
        title:
          (metadata && "og_title" in metadata ? metadata.og_title : null) ||
          url,
        metadata: metadata || undefined,
      });

      responseText = `✅ Link salvo!`;
    }
  } else {
    // Nota ou mensagem genérica - usa AI
    const history = await conversationService.getHistory(conversation.id);
    const aiResponse = await aiService.callLLM({
      message: messageText,
      history,
    });

    responseText = aiResponse.message;
  }

  // 6. Salva resposta do bot
  await conversationService.addMessage(
    conversation.id,
    "assistant",
    responseText
  );

  // 7. Envia resposta via WhatsApp
  await whatsappService.sendMessage(phoneNumber, responseText);
  await whatsappService.markAsRead(message.id);
}

export const webhookRouter = new Elysia({ prefix: "/webhook" })
  /**
   * GET /webhook/meta - Verificação do webhook
   */
  .get(
    "/meta",
    ({ query }) => {
      if (
        query["hub.mode"] === "subscribe" &&
        query["hub.verify_token"] === env.META_VERIFY_TOKEN
      ) {
        return new Response(query["hub.challenge"]);
      }

      return new Response("Forbidden", { status: 403 });
    },
    {
      query: webhookVerifySchema,
      detail: {
        tags: ["Webhook"],
        summary: "Verificação do webhook Meta",
        description: "Endpoint usado pelo Meta para verificar o webhook",
      },
    }
  )

  /**
   * POST /webhook/meta - Recebe mensagens do WhatsApp
   */
  .post(
    "/meta",
    async ({ body }) => {
      try {
        // Valida e extrai mensagens
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const messages = changes?.value?.messages;

        if (messages && messages.length > 0) {
          // Processa primeira mensagem (em produção, processar todas)
          await processMessage(messages[0]);
        }

        return { success: true };
      } catch (error) {
        console.error("Erro no webhook:", error);
        return { error: "Internal error" };
      }
    },
    {
      body: whatsappWebhookPayloadSchema,
      response: {
        200: webhookSuccessResponseSchema,
        500: errorResponseSchema,
      },
      detail: {
        tags: ["Webhook"],
        summary: "Recebe mensagens do WhatsApp",
        description:
          "Webhook que recebe e processa mensagens do WhatsApp Business API",
      },
    }
  );
