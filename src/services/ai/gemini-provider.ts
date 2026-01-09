import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider, AIResponse, Message } from "./types";

/**
 * Provider para Google Gemini API
 */
export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string = "gemini-2.5-flash") {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async callLLM(params: {
    message: string;
    history?: Message[];
    systemPrompt?: string;
  }): Promise<AIResponse> {
    const { message, history = [], systemPrompt } = params;

    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt,
      });

      // Converter histórico para formato Gemini
      let geminiHistory = history.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

      // Gemini exige que histórico sempre comece com 'user'
      // Remove mensagens iniciais 'model' se existirem
      while (geminiHistory.length > 0 && geminiHistory[0].role !== "user") {
        geminiHistory = geminiHistory.slice(1);
      }

      const chat = model.startChat({
        history: geminiHistory,
      });

      const result = await chat.sendMessage(message);
      const response = result.response;
      const text = response.text();

      return {
        message: text,
      };
    } catch (error: any) {
      console.error("Erro ao chamar Gemini:", error);

      // Erro de API key inválida
      if (error?.status === 400 || error?.message?.includes("API_KEY")) {
        return {
          message:
            "😅 Hmm... estou com problemas de configuração aqui. Pode tentar novamente mais tarde?",
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
    return "gemini";
  }
}
