import { env } from "@/config/env";

interface WhatsAppMessage {
  to: string;
  text: string;
}

/**
 * Cliente para Meta WhatsApp Business API
 */
export class WhatsAppService {
  private baseUrl = "https://graph.facebook.com/v18.0";
  private token = env.META_WHATSAPP_TOKEN;
  private phoneNumberId = env.META_WHATSAPP_PHONE_NUMBER_ID;

  /**
   * Envia mensagem de texto
   */
  async sendMessage(to: string, text: string) {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error: ${error}`);
    }

    return await response.json();
  }

  /**
   * Marca mensagem como lida
   */
  async markAsRead(messageId: string) {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    };

    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Valida webhook signature
   */
  verifyWebhook(signature: string, body: string): boolean {
    // TODO: Implementar validação HMAC SHA256
    return true;
  }
}

export const whatsappService = new WhatsAppService();
