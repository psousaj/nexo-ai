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
      const geminiHistory = history.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

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
            "⚠️ Google Gemini API key inválida. Configure GOOGLE_API_KEY no .env",
        };
      }

      // Erro de rate limit
      if (error?.status === 429) {
        return {
          message:
            "⚠️ Limite de requisições atingido. Tente novamente em alguns minutos.",
        };
      }

      return {
        message: "⚠️ Serviço de IA indisponível. Tente novamente mais tarde.",
      };
    }
  }

  getName(): string {
    return "gemini";
  }
}
