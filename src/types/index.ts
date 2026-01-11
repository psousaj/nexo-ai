// Types básicos do sistema

export type ItemType = "movie" | "tv_show" | "video" | "link" | "note";

export type ConversationState =
  | "idle"
  | "awaiting_confirmation"
  | "batch_processing" // Processando lista de itens
  | "awaiting_batch_item" // Aguardando confirmação de item da lista
  | "enriching"
  | "saving"
  | "error";

export type MessageRole = "user" | "assistant";

// Metadata por tipo de item
export interface MovieMetadata {
  tmdb_id: number;
  year: number;
  genres: string[];
  rating: number;
  streaming?: Array<{
    provider: string;
    url: string;
  }>;
  poster_url?: string;
  director?: string;
  cast?: string[];
}

export interface TVShowMetadata {
  tmdb_id: number;
  first_air_date: number; // Ano de estreia
  last_air_date?: number; // Ano do último episódio
  number_of_seasons: number;
  number_of_episodes: number;
  status: string; // "Ended", "Returning Series", etc
  genres: string[];
  rating: number;
  streaming?: Array<{
    provider: string;
    url: string;
  }>;
  poster_url?: string;
  created_by?: string[];
  cast?: string[];
}

export interface VideoMetadata {
  video_id: string;
  platform: "youtube" | "vimeo";
  channel_name: string;
  duration: number;
  views?: number;
  thumbnail_url?: string;
}

export interface LinkMetadata {
  url: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  domain?: string;
}

export interface NoteMetadata {
  full_content?: string;
  category?: string;
  related_topics?: string[];
  priority?: "low" | "medium" | "high";
  created_via?: "chat" | "api";
}

export type ItemMetadata =
  | MovieMetadata
  | TVShowMetadata
  | VideoMetadata
  | LinkMetadata
  | NoteMetadata;

// Contexto de conversação
export interface ConversationContext {
  awaiting_selection?: boolean;
  candidates?: any[];
  last_query?: string;
  detected_type?: ItemType;

  // Batch processing
  batch_queue?: Array<{
    query: string;
    type: ItemType;
    status: "pending" | "processing" | "confirmed" | "skipped";
  }>;
  batch_current_index?: number; // Índice do item atual na fila
  batch_current_candidates?: any[]; // Candidatos do item atual
  batch_confirmed_items?: any[]; // Itens já confirmados

  [key: string]: any;
}

// Re-export AI types from ai service
export type {
  AIResponse,
  Message,
  AIProvider,
  AIProviderType,
} from "@/services/ai/types";
