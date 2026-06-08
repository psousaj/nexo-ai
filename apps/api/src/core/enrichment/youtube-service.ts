import { env } from '@/config/env';
import type { VideoMetadata } from '@/types/enrichment';
import { loggers } from '@/utils/logger';
import { fetchWithRetry } from '@/utils/retry';
import { cacheGet, cacheSet } from './cache';

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
	duration: string;
}

interface YouTubeVideoItem {
	snippet: YouTubeVideoSnippet;
	statistics: YouTubeVideoStatistics;
	contentDetails: YouTubeVideoContentDetails;
}

interface YouTubeAPIResponse {
	items?: YouTubeVideoItem[];
}

export class YouTubeService {
	private baseUrl = 'https://www.googleapis.com/youtube/v3';
	private apiKey = env.YOUTUBE_API_KEY;

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

	private parseDuration(duration: string): number {
		const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
		if (!match) return 0;

		const hours = Number.parseInt(match[1] || '0');
		const minutes = Number.parseInt(match[2] || '0');
		const seconds = Number.parseInt(match[3] || '0');

		return hours * 3600 + minutes * 60 + seconds;
	}

	async getVideoDetails(videoId: string): Promise<VideoMetadata> {
		if (!this.apiKey) throw new Error('YOUTUBE_API_KEY não configurada');

		const cacheKey = `youtube:video:${videoId}`;

		const cached = await cacheGet<VideoMetadata>(cacheKey);
		if (cached) {
			loggers.enrichment.debug(`Cache hit: ${cacheKey}`);
			return cached;
		}

		const url = new URL(`${this.baseUrl}/videos`);
		url.searchParams.set('key', this.apiKey);
		url.searchParams.set('id', videoId);
		url.searchParams.set('part', 'snippet,statistics,contentDetails');

		const response = await fetchWithRetry(url.toString(), undefined, {
			maxRetries: 2,
			delayMs: 500,
		});

		if (!response.ok) {
			throw new Error(`YouTube API error: ${response.statusText}`);
		}

		const data = (await response.json()) as YouTubeAPIResponse;

		if (!data.items || data.items.length === 0) {
			throw new Error('Vídeo não encontrado');
		}

		const video = data.items[0];
		const snippet: YouTubeVideoSnippet = video.snippet;

		const metadata: VideoMetadata = {
			title: snippet.title,
			channelTitle: snippet.channelTitle,
			videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
			thumbnailUrl: snippet.thumbnails.high.url,
		};

		await cacheSet(cacheKey, metadata, 43200);

		return metadata;
	}

	async enrichYouTubeVideo(url: string): Promise<VideoMetadata> {
		if (!this.apiKey) throw new Error('YOUTUBE_API_KEY não configurada');

		const videoId = this.extractVideoId(url);

		if (!videoId) {
			throw new Error('URL do YouTube inválida');
		}

		return this.getVideoDetails(videoId);
	}
}

export const youtubeService = new YouTubeService();
