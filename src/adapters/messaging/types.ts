/**
 * Messaging Provider Adapter Interface
 * 
 * Abstração para diferentes provedores de chat (WhatsApp, Telegram, Discord, etc)
 * Permite integrar múltiplos providers sem acoplar a lógica de negócio
 */

export type ProviderType = "whatsapp" | "telegram" | "discord";

/**
 * Mensagem normalizada recebida de qualquer provider
 */
export interface IncomingMessage {
  /** ID único da mensagem no provider */
  messageId: string;
  
  /** ID do remetente no provider (phone, chat_id, user_id, etc) */
  externalId: string;
  
  /** Nome do remetente (opcional) */
  senderName?: string;
  
  /** Conteúdo da mensagem */
  text: string;
  
  /** Timestamp da mensagem */
  timestamp: Date;
  
  /** Provider de origem */
  provider: ProviderType;
  
  /** Número de telefone (se disponível) para detecção cross-provider */
  phoneNumber?: string;
}

/**
 * Interface comum para todos os adapters de messaging
 */
export interface MessagingProvider {
  /**
   * Parse webhook payload do provider para formato normalizado
   * @returns IncomingMessage se válido, null se payload inválido/vazio
   */
  parseIncomingMessage(payload: any): IncomingMessage | null;
  
  /**
   * Verifica autenticidade do webhook (HMAC, tokens, etc)
   * Aceita qualquer tipo de Request (Fetch API ou Express)
   */
  verifyWebhook(request: any): boolean | Promise<boolean>;
  
  /**
   * Envia mensagem de texto para um destinatário
   * @param recipient - ID do destinatário no formato do provider
   * @param text - Conteúdo da mensagem (texto puro)
   */
  sendMessage(recipient: string, text: string): Promise<void>;
  
  /**
   * Retorna nome do provider
   */
  getProviderName(): ProviderType;
}
