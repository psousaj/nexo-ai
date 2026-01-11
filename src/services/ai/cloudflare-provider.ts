import type { AIProvider, AIResponse, Message } from "./types";

/**
 * Provider para Cloudflare Workers AI
 */
export class CloudflareProvider implements AIProvider {
  private accountId: string;
  private apiToken: string;
  private model: string;

  constructor(
    accountId: string,
    apiToken: string,
    model: string = "@cf/meta/llama-3.1-8b-instruct"
  ) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.model = model;
  }

  async callLLM(params: {
    message: string;
    history?: Message[];
    systemPrompt?: string;
  }): Promise<AIResponse> {
    const { message, history = [], systemPrompt } = params;

    try {
      console.log("☁️ [Cloudflare] Montando prompt");
      
      // Montar o prompt completo com histórico e contexto
      let fullPrompt = "";

      if (systemPrompt) {
        fullPrompt += `${systemPrompt}\n\n`;
      }

      // Adicionar histórico
      if (history.length > 0) {
        fullPrompt += "Histórico da conversa:\n";
        history.forEach((msg) => {
          const role = msg.role === "user" ? "Usuário" : "Assistente";
          fullPrompt += `${role}: ${msg.content}\n`;
        });
        fullPrompt += "\n";
      }

      // Adicionar mensagem atual
      fullPrompt += `Usuário: ${message}\nAssistente:`;

      console.log(`☁️ [Cloudflare] Enviando para ${this.model}`);
      
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: fullPrompt,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Cloudflare AI API error (${response.status}):`,
          errorText
        );
        throw new Error(`Cloudflare AI API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("☁️ [Cloudflare] Resposta recebida");

      // A resposta da API Cloudflare vem em formato diferente dependendo do modelo
      // Para llama-3.1-8b-instruct, a resposta vem em data.result.response
      const text = data?.result?.response || data?.result || "";

      if (!text) {
        console.warn("⚠️ [Cloudflare] Resposta vazia!", JSON.stringify(data).substring(0, 200));
      }

      return {
        message: text.trim(),
      };
    } catch (error: any) {
      console.error("❌ [Cloudflare] Erro:", error);

      // Erro de autenticação
      if (error?.status === 401 || error?.status === 403) {
        return {
          message:
            "😅 Hmm... estou com problemas de autenticação aqui. Pode tentar novamente mais tarde?",
        };
      }

      // Erro de rate limit
      if (error?.status === 429) {
        return {
          message:
            "😅 Opa, muitas mensagens de uma vez! Dá uma pausa de uns minutinhos e tenta de novo?",
        };
      }

      // Erro genérico
      return {
        message:
          "😅 Hmm... estou com problemas pra te responder no momento. Pode tentar novamente mais tarde?",
      };
    }
  }

  getName(): string {
    return "cloudflare";
  }
}
