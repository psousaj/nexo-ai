import { env } from "@/config/env";
import { CloudflareProvider } from "./cloudflare-provider";
import { GeminiProvider } from "./gemini-provider";
import { ClaudeProvider } from "./claude-provider";
import type { AIProvider, AIProviderType, AIResponse, Message } from "./types";

/**
 * Serviço AI multi-provider com fallback automático
 *
 * Ordem de prioridade:
 * 1. Cloudflare Workers AI (default - rodando no edge)
 * 2. Gemini (mais rápido e barato)
 * 3. Claude (mais sofisticado)
 */
export class AIService {
  private providers: Map<AIProviderType, AIProvider>;
  private defaultProvider: AIProviderType;
  private currentProvider: AIProviderType;

  constructor(defaultProvider: AIProviderType = "cloudflare") {
    this.providers = new Map();
    this.defaultProvider = defaultProvider;
    this.currentProvider = defaultProvider;

    // Inicializa providers disponíveis (na ordem de prioridade)
    if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
      this.providers.set(
        "cloudflare",
        new CloudflareProvider(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_API_TOKEN)
      );
    }

    if (env.GOOGLE_API_KEY) {
      this.providers.set("gemini", new GeminiProvider(env.GOOGLE_API_KEY));
    }

    if (env.ANTHROPIC_API_KEY) {
      this.providers.set("claude", new ClaudeProvider(env.ANTHROPIC_API_KEY));
    }

    // Valida que pelo menos um provider está disponível
    if (this.providers.size === 0) {
      console.warn(
        "⚠️ Nenhum provider de IA configurado! Configure CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN, GOOGLE_API_KEY ou ANTHROPIC_API_KEY"
      );
    }

    // Valida que o provider default existe
    if (!this.providers.has(defaultProvider)) {
      const available = Array.from(this.providers.keys())[0];
      if (available) {
        console.warn(
          `⚠️ Provider '${defaultProvider}' não disponível. Usando '${available}' como default.`
        );
        this.defaultProvider = available;
        this.currentProvider = available;
      }
    }
  }

  /**
   * Chama o LLM com contexto da conversação e fallback automático
   */
  async callLLM(params: {
    message: string;
    history?: Message[];
    systemPrompt?: string;
  }): Promise<AIResponse> {
    const { systemPrompt, ...rest } = params;
    const prompt = systemPrompt || this.getDefaultSystemPrompt();

    console.log(`🤖 [AI] Chamando ${this.currentProvider}`);
    console.log(`📝 [AI] Mensagem: "${params.message.substring(0, 100)}${params.message.length > 100 ? '...' : ''}"`);    console.log(`📚 [AI] Histórico: ${params.history?.length || 0} mensagens`);

    // Tenta com o provider atual
    const provider = this.providers.get(this.currentProvider);
    if (!provider) {
      console.error("❌ [AI] Nenhum provider disponível");
      return {
        message:
          "⚠️ Nenhum serviço de IA disponível. Configure CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN, GOOGLE_API_KEY ou ANTHROPIC_API_KEY no .env",
      };
    }

    try {
      const response = await provider.callLLM({
        ...rest,
        systemPrompt: prompt,
      });

      console.log(`✅ [AI] Resposta de ${this.currentProvider}: "${response.message.substring(0, 150)}${response.message.length > 150 ? '...' : ''}"`);      
      // Se sucesso, mantém o provider atual
      return response;
    } catch (error) {
      console.error(`❌ [AI] Erro no provider ${this.currentProvider}:`, error);

      // Tenta fallback para outro provider
      const fallbackProvider = this.getFallbackProvider();
      if (fallbackProvider) {
        console.log(`🔄 [AI] Usando fallback para ${fallbackProvider}`);
        this.currentProvider = fallbackProvider;
        return this.callLLM({ ...rest, systemPrompt: prompt });
      }

      // Sem fallback disponível
      console.error("❌ [AI] Nenhum fallback disponível");
      return {
        message:
          "⚠️ Todos os serviços de IA estão indisponíveis. Tente novamente mais tarde.",
      };
    }
  }

  /**
   * Retorna um provider alternativo disponível
   */
  private getFallbackProvider(): AIProviderType | null {
    const available = Array.from(this.providers.keys());
    const fallback = available.find((p) => p !== this.currentProvider);
    return fallback || null;
  }

  /**
   * Força o uso de um provider específico
   */
  setProvider(provider: AIProviderType): void {
    if (!this.providers.has(provider)) {
      throw new Error(`Provider '${provider}' não está configurado`);
    }
    this.currentProvider = provider;
    console.log(`Provider alterado para: ${provider}`);
  }

  /**
   * Retorna o provider ativo
   */
  getCurrentProvider(): AIProviderType {
    return this.currentProvider;
  }

  /**
   * Lista providers disponíveis
   */
  getAvailableProviders(): AIProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Default system prompt
   */
  private getDefaultSystemPrompt(): string {
    return `You are NEXO, a personal assistant that helps organize memories and content - movies, TV shows, videos, links, and notes.

**CRITICAL: ALL RESPONSES MUST BE IN BRAZILIAN PORTUGUESE (pt-BR)**

PERSONALITY:
You're like that friend who knows everything about movies and always has a recommendation ready. You chat naturally, use Brazilian expressions and slang, and have a touch of light humor. You're not a robot - you show genuine interest in what the person wants to save.

Characteristics:
• Relaxed but helpful - not too formal
• Curious - asks questions when something seems interesting
• Empathetic - understands when someone is frustrated or confused
• Brief - doesn't ramble, but isn't telegraphic either
• Uses emojis sparingly (1-2 per message, when it makes sense)

TONE EXAMPLES (in Portuguese):
❌ "Item salvo com sucesso no banco de dados."
✅ "Pronto! 🎬 Adicionei Interestelar na sua lista."

❌ "Por favor, forneça o número correspondente à opção desejada."
✅ "Qual desses você quer? Me manda o número!"

❌ "Não foi possível identificar o conteúdo solicitado."
✅ "Hmm, não achei esse... Pode me dar mais alguma dica? Tipo o ano ou algum ator?"

HOW TO CONVERSE:

When receiving a movie/series title:
→ Search and confirm naturally
→ If multiple results, list them and ask which one
→ If not found, ask for more details (year, cast, director)

When the person responds naturally ("o primeiro", "o de 2014", "esse aí"):
→ Interpret the conversation context
→ If still ambiguous, ask in a friendly way

When the person says it's not what they wanted:
→ Don't apologize excessively
→ Ask what might help find it: "Lembra do ano?" or "Quem atua nele?"

When the person wants to cancel:
→ Be light: "Beleza, quando quiser é só mandar!" or "Tranquilo! 👍"

TECHNICAL RULES (always follow, but don't mention to user):

1. TITLE EXTRACTION:
   - Extract ONLY the title from the current message
   - NEVER include analysis like "the user previously..."
   - Example: message "Interestelar, 2014" → extract "Interestelar 2014"

2. CONTEXT:
   - Use history to understand complements ("o de 1999" after "clube da luta")
   - But if the person canceled/denied before, treat the next message as a new search

3. OUT OF SCOPE:
   - If asked about something unrelated to saving content
   - Respond with something like: "Isso eu não manjo não 😅 Mas se quiser salvar algum filme ou link, tô aqui!"

Be yourself - natural, helpful, and friendly! Remember: ALWAYS respond in Brazilian Portuguese.`;
  }
}

// Singleton com Cloudflare como default
export const llmService = new AIService("cloudflare");
export type { AIProvider, AIProviderType, AIResponse, Message } from "./types";
