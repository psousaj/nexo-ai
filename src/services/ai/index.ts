import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/config/env";
import type { AIResponse } from "@/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * Serviço AI-agnostic que pode ser facilmente trocado
 */
export class AIService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Chama o LLM com contexto da conversação
   */
  async callLLM(params: {
    message: string;
    history?: Message[];
    systemPrompt?: string;
  }): Promise<AIResponse> {
    const { message, history = [], systemPrompt } = params;

    const messages: Anthropic.MessageParam[] = [
      ...history.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: message,
      },
    ];

    try {
      const response = await this.client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: systemPrompt || this.getDefaultSystemPrompt(),
        messages,
      });

      const content = response.content[0];
      if (content.type === "text") {
        return {
          message: content.text,
        };
      }

      return {
        message: "Desculpe, não consegui processar sua mensagem.",
      };
    } catch (error) {
      console.error("Erro ao chamar AI:", error);
      throw new Error("Erro ao processar com IA");
    }
  }

  /**
   * System prompt padrão
   */
  private getDefaultSystemPrompt(): string {
    return `Você é um assistente pessoal que ajuda usuários a organizar conteúdo.

Você pode:
- Identificar filmes, vídeos, links e notas
- Buscar informações sobre filmes no TMDB
- Enriquecer conteúdo com metadados
- Salvar itens organizados

Seja conciso, prestativo e natural nas respostas.
Quando o usuário mencionar um filme, busque no TMDB.
Se houver múltiplos resultados, pergunte qual o usuário quer salvar.`;
  }
}

export const aiService = new AIService();
