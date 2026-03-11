import { env } from '@/config/env';
import { cacheGet, cacheSet } from '@/config/redis';
import { instrumentService } from '@/services/service-instrumentation';
import type { MusicMetadata } from '@/types';
import { loggers } from '@/utils/logger';

const TOKEN_CACHE_KEY = 'spotify:client_token';
const TRACK_CACHE_TTL = 86400; // 24h
const TOKEN_CACHE_TTL = 3500; // ~58min (tokens duram 1h)

interface SpotifyTrack {
	id: string;
	name: string;
	artists: Array<{ name: string }>;
	album: {
		name: string;
		images: Array<{ url: string; width: number; height: number }>;
		release_date?: string;
	};
	duration_ms: number;
	popularity: number;
	external_urls: { spotify: string };
	preview_url?: string;
}

class SpotifyService {
	private readonly clientId = env.SPOTIFY_CLIENT_ID;
	private readonly clientSecret = env.SPOTIFY_CLIENT_SECRET;

	private async getAccessToken(): Promise<string | null> {
		if (!this.clientId || !this.clientSecret) return null;

		const cached = await cacheGet<string>(TOKEN_CACHE_KEY);
		if (cached) return cached;

		try {
			const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
			const res = await fetch('https://accounts.spotify.com/api/token', {
				method: 'POST',
				headers: {
					Authorization: `Basic ${credentials}`,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: 'grant_type=client_credentials',
				signal: AbortSignal.timeout(8000),
			});

			if (!res.ok) return null;

			const data = (await res.json()) as { access_token: string };
			await cacheSet(TOKEN_CACHE_KEY, data.access_token, TOKEN_CACHE_TTL);
			return data.access_token;
		} catch {
			return null;
		}
	}

	async searchTrack(title: string, artist?: string): Promise<MusicMetadata | null> {
		if (!this.clientId || !this.clientSecret) {
			loggers.app.warn('SPOTIFY_CLIENT_ID/SECRET não configurados — enrichment desabilitado');
			return null;
		}

		const cacheKey = `music:${title}:${artist ?? ''}`.toLowerCase().replace(/\s+/g, '_');
		const cached = await cacheGet<MusicMetadata>(cacheKey);
		if (cached) return cached;

		const token = await this.getAccessToken();
		if (!token) return null;

		try {
			const q = artist ? `track:${title} artist:${artist}` : `track:${title}`;
			const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`;

			const res = await fetch(url, {
				headers: { Authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(8000),
			});

			if (!res.ok) {
				loggers.app.warn({ status: res.status }, '🎵 Spotify API retornou erro');
				return null;
			}

			const data = (await res.json()) as { tracks: { items: SpotifyTrack[] } };
			const track = data.tracks?.items?.[0];
			if (!track) return null;

			const year = track.album.release_date ? Number(track.album.release_date.split('-')[0]) : undefined;

			const metadata: MusicMetadata = {
				title: track.name,
				artist: track.artists[0]?.name ?? '',
				artists: track.artists.map((a) => a.name),
				album: track.album.name,
				album_cover_url: track.album.images[0]?.url,
				year: Number.isNaN(year) ? undefined : year,
				duration_ms: track.duration_ms,
				genres: [],
				spotify_id: track.id,
				spotify_url: track.external_urls.spotify,
				preview_url: track.preview_url ?? undefined,
				popularity: track.popularity,
			};

			await cacheSet(cacheKey, metadata, TRACK_CACHE_TTL);
			return metadata;
		} catch (error) {
			loggers.app.error({ err: error }, '🎵 Erro ao buscar música no Spotify');
			return null;
		}
	}
}

export const spotifyService = instrumentService('spotify', new SpotifyService());
