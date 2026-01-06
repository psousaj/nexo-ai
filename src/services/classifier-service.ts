import type { ItemType } from "@/types";

/**
 * Classifica tipo de conteúdo baseado na mensagem do usuário
 */
export class ClassifierService {
  /**
   * Detecta tipo de item pela mensagem
   */
  detectType(message: string): ItemType | null {
    const lowerMsg = message.toLowerCase();

    // Detecta URLs de vídeo
    if (
      lowerMsg.includes("youtube.com") ||
      lowerMsg.includes("youtu.be") ||
      lowerMsg.includes("vimeo.com")
    ) {
      return "video";
    }

    // Detecta URLs genéricas
    if (lowerMsg.match(/https?:\/\//)) {
      return "link";
    }

    // Detecta filmes por palavras-chave
    const movieKeywords = [
      "filme",
      "movie",
      "assistir",
      "netflix",
      "prime video",
      "disney+",
    ];
    if (movieKeywords.some((kw) => lowerMsg.includes(kw))) {
      return "movie";
    }

    // Se não detectou nada específico, assume nota
    return "note";
  }

  /**
   * Extrai título/query da mensagem
   */
  extractQuery(message: string, type: ItemType): string {
    // Remove URLs
    let query = message.replace(/https?:\/\/[^\s]+/g, "").trim();

    // Remove palavras-chave comuns
    const keywords = ["filme", "movie", "assistir", "ver", "quero ver"];
    keywords.forEach((kw) => {
      const regex = new RegExp(`\\b${kw}\\b`, "gi");
      query = query.replace(regex, "").trim();
    });

    return query || message;
  }

  /**
   * Extrai URL de uma mensagem
   */
  extractUrl(message: string): string | null {
    const urlMatch = message.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : null;
  }
}

export const classifierService = new ClassifierService();
