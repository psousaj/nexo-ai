import { env } from "@/config/env";
import type { VideoMetadata } from "@/types";

interface YouTubeVideoSnippet {
  title: string;
  channelTitle: string;
  thumbnails: {
    default: { url: string };
    medium: { url: string };
    high: { url: string };
  };
}

interface YouTubeVideoStatistics {
  viewCount: string;
}

interface YouTubeVideoContentDetails {
  duration: string; // ISO 8601 format: PT15M33S
}

export class YouTubeService {
  private baseUrl = "https://www.googleapis.com/youtube/v3";
  private apiKey = env.YOUTUBE_API_KEY;

  /**
   * Extrai video ID de URL do YouTube
   */
  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Converte duração ISO 8601 para segundos
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || "0");
    const minutes = parseInt(match[2] || "0");
    const seconds = parseInt(match[3] || "0");

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Busca detalhes de um vídeo
   */
  async getVideoDetails(videoId: string): Promise<VideoMetadata> {
    const url = new URL(`${this.baseUrl}/videos`);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("id", videoId);
    url.searchParams.set("part", "snippet,statistics,contentDetails");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      throw new Error("Vídeo não encontrado");
    }

    const video = data.items[0];
    const snippet: YouTubeVideoSnippet = video.snippet;
    const statistics: YouTubeVideoStatistics = video.statistics;
    const contentDetails: YouTubeVideoContentDetails = video.contentDetails;

    return {
      video_id: videoId,
      platform: "youtube",
      channel_name: snippet.channelTitle,
      duration: this.parseDuration(contentDetails.duration),
      views: parseInt(statistics.viewCount || "0"),
      thumbnail_url: snippet.thumbnails.high.url,
    };
  }

  /**
   * Enriquece vídeo do YouTube a partir da URL
   */
  async enrichYouTubeVideo(url: string): Promise<VideoMetadata> {
    const videoId = this.extractVideoId(url);

    if (!videoId) {
      throw new Error("URL do YouTube inválida");
    }

    return this.getVideoDetails(videoId);
  }
}

export const youtubeService = new YouTubeService();
