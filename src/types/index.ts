// Types básicos do sistema

export type ItemType = "movie" | "video" | "link" | "note";

export type ConversationState =
  | "idle"
  | "awaiting_confirmation"
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
  category?: string;
  related_topics?: string[];
  priority?: "low" | "medium" | "high";
}

export type ItemMetadata =
  | MovieMetadata
  | VideoMetadata
  | LinkMetadata
  | NoteMetadata;

// Contexto de conversação
export interface ConversationContext {
  awaiting_selection?: boolean;
  candidates?: any[];
  last_query?: string;
  detected_type?: ItemType;
  [key: string]: any;
}

// Estrutura de resposta AI
export interface AIResponse {
  message: string;
  action?: "save_item" | "search_items" | "enrich_metadata";
  data?: any;
}
