/**
 * Definições de Tools para AI com Function Calling
 */

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * Tool: Salvar item na biblioteca do usuário
 */
export const saveItemTool: Tool = {
  name: "save_item",
  description:
    "Salva um filme, série, vídeo, link ou nota na biblioteca do usuário. Use quando o usuário pedir para salvar/guardar/adicionar algo.",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["movie", "tv_show", "video", "link", "note"],
        description: "Tipo do item a ser salvo",
      },
      title: {
        type: "string",
        description: "Título do item (nome do filme, série, vídeo, etc)",
      },
      metadata: {
        type: "object",
        description:
          "Metadados adicionais (tmdbId para filmes/séries, url para links/vídeos)",
        properties: {
          tmdbId: {
            type: "number",
            description: "ID do TMDB para filmes e séries",
          },
          url: {
            type: "string",
            description: "URL para links ou vídeos",
          },
        },
      },
    },
    required: ["type", "title"],
  },
};

/**
 * Tool: Buscar itens salvos
 */
export const searchItemsTool: Tool = {
  name: "search_items",
  description:
    "Busca itens já salvos na biblioteca do usuário. Use quando o usuário perguntar 'o que eu salvei?', 'quais filmes tenho?', etc.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Termo de busca (opcional, vazio = retorna todos)",
      },
      type: {
        type: "string",
        enum: ["movie", "tv_show", "video", "link", "note", "all"],
        description: "Filtrar por tipo (opcional)",
      },
      limit: {
        type: "number",
        description: "Número máximo de resultados (padrão: 10)",
      },
    },
    required: [],
  },
};

/**
 * Tool: Enriquecer metadados (buscar informações em APIs externas)
 */
export const enrichMetadataTool: Tool = {
  name: "enrich_metadata",
  description:
    "Busca informações detalhadas sobre um filme/série/vídeo em APIs externas (TMDB, YouTube). Use quando o usuário pedir detalhes sobre algo.",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["movie", "tv_show", "video"],
        description: "Tipo do conteúdo",
      },
      query: {
        type: "string",
        description: "Nome do filme/série ou URL do vídeo",
      },
    },
    required: ["type", "query"],
  },
};

/**
 * Tool: Aplicar timeout ao usuário (quando for ofensivo)
 */
export const applyUserTimeoutTool: Tool = {
  name: "apply_user_timeout",
  description:
    "Aplica um timeout de 5 minutos para um usuário que está sendo ofensivo ou desrespeitoso. Use APENAS quando detectar xingamentos, ofensas ou desrespeito.",
  parameters: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description: "Motivo do timeout (ex: 'linguagem ofensiva')",
      },
    },
    required: ["reason"],
  },
};

/**
 * Tool: Obter provedores de streaming
 */
export const getStreamingProvidersTool: Tool = {
  name: "get_streaming_providers",
  description:
    "Verifica onde um filme está disponível para assistir (Netflix, Prime, Disney+, etc) e se precisa baixar via torrent. Use quando o usuário perguntar onde assistir.",
  parameters: {
    type: "object",
    properties: {
      tmdbId: {
        type: "number",
        description: "ID do filme no TMDB",
      },
    },
    required: ["tmdbId"],
  },
};

/**
 * Lista de todas as tools disponíveis
 */
export const availableTools: Tool[] = [
  saveItemTool,
  searchItemsTool,
  enrichMetadataTool,
  applyUserTimeoutTool,
  getStreamingProvidersTool,
];

/**
 * Retorna definições de tools no formato esperado por cada provider
 */
export function getToolsForProvider(
  provider: "gemini" | "claude" | "cloudflare"
): Tool[] {
  // Cloudflare não suporta tools ainda, retorna vazio
  if (provider === "cloudflare") {
    return [];
  }

  return availableTools;
}
