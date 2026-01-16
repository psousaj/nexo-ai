import { env } from "@/config/env";
import type { MessagingProvider, IncomingMessage, ProviderType } from "./types";

/**
 * Adapter para Telegram Bot API
 */
export class TelegramAdapter implements MessagingProvider {
  private baseUrl = "https://api.telegram.org";
  private token = env.TELEGRAM_BOT_TOKEN;
  private webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;

  getProviderName(): ProviderType {
    return "telegram";
  }

  parseIncomingMessage(payload: any): IncomingMessage | null {
    // Telegram Update pode ter message ou edited_message
    const message = payload.message || payload.edited_message;

    if (!message) {
      return null;
    }

    // Texto pode vir de text ou caption (fotos/vídeos/documentos)
    const text = message.text || message.caption;

    if (!text) {
      return null; // Ignora se não houver texto
    }

    // Telegram usa chat.id como identificador único
    const chatId = message.chat.id.toString();

    // Nome: fallback chain
    const senderName =
      [message.from.first_name, message.from.last_name]
        .filter(Boolean)
        .join(" ") ||
      message.from.username ||
      "Usuário";

    // Telefone: raramente disponível (apenas se usuário compartilhou contato)
    const phoneNumber = message.contact?.phone_number;

    return {
      messageId: message.message_id.toString(),
      externalId: chatId,
      senderName,
      text,
      timestamp: new Date(message.date * 1000),
      provider: "telegram",
      phoneNumber,
    };
  }

  verifyWebhook(request: any): boolean {
    // Telegram webhook secret (recomendado em produção)
    if (!this.webhookSecret) {
      console.warn(
        "⚠️ Telegram webhook sem secret_token configurado. Configure TELEGRAM_WEBHOOK_SECRET em produção."
      );
      return true; // Modo dev: aceita tudo
    }

    // Elysia/Fetch API usa Headers object com .get()
    // Express usa objeto plain com lowercase keys
    const headers = request.headers;
    const secretToken = 
      headers?.get?.("x-telegram-bot-api-secret-token") || // Fetch API (case-insensitive)
      headers?.["x-telegram-bot-api-secret-token"];        // Express-style

    if (secretToken !== this.webhookSecret) {
      console.error("❌ Telegram webhook secret inválido ou ausente");
      console.error(`   Recebido: "${secretToken || '(nenhum)'}"`);
      return false;
    }

    return true;
  }

  async sendMessage(
    chatId: string,
    text: string,
    options?: {
      parseMode?: "MarkdownV2" | "HTML";
      replyToMessageId?: number;
    }
  ): Promise<void> {
    const url = `${this.baseUrl}/bot${this.token}/sendMessage`;

    const payload: any = {
      chat_id: chatId,
      text,
    };

    // Parse mode opcional
    if (options?.parseMode) {
      payload.parse_mode = options.parseMode;
    }

    // Reply to message
    if (options?.replyToMessageId) {
      payload.reply_parameters = {
        message_id: options.replyToMessageId,
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json() as { error_code?: number; description?: string };
      console.error(`❌ [Telegram] Erro ao enviar mensagem:`, {
        error_code: errorData.error_code,
        description: errorData.description,
        chatId,
        textLength: text.length
      });
      throw new Error(
        `Telegram API error [${errorData.error_code}]: ${errorData.description}`
      );
    }
    
    console.log(`📤 [Telegram] Mensagem enviada para ${chatId}`);
  }

  /**
   * Define webhook do Telegram (usar em setup inicial)
   */
  async setWebhook(webhookUrl: string): Promise<void> {
    const url = `${this.baseUrl}/bot${this.token}/setWebhook`;

    const payload = {
      url: webhookUrl,
      secret_token: this.webhookSecret,
      allowed_updates: ["message", "edited_message"],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json() as { error_code?: number; description?: string };
      throw new Error(
        `Telegram setWebhook error [${errorData.error_code}]: ${errorData.description}`
      );
    }
  }

  /**
   * Valida token do bot (útil para health checks)
   */
  async getMe(): Promise<any> {
    const url = `${this.baseUrl}/bot${this.token}/getMe`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json() as { error_code?: number; description?: string };
      throw new Error(
        `Telegram getMe error [${errorData.error_code}]: ${errorData.description}`
      );
    }

    return response.json();
  }
}

export const telegramAdapter = new TelegramAdapter();
