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
	overview?: string;
	tagline?: string;
	keywords?: string[];
}

export interface TVShowMetadata {
	tmdb_id: number;
	first_air_date: number;
	last_air_date?: number;
	number_of_seasons: number;
	number_of_episodes: number;
	status: string;
	genres: string[];
	rating: number;
	streaming?: Array<{
		provider: string;
		url: string;
	}>;
	poster_url?: string;
	created_by?: string[];
	cast?: string[];
	overview?: string;
	tagline?: string;
	keywords?: string[];
}

export interface VideoMetadata {
	video_id: string;
	platform: 'youtube' | 'vimeo';
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
	priority?: 'low' | 'medium' | 'high';
	created_via?: 'chat' | 'api';
}

export interface MemoMetadata {
	content: string;
	source?: string;
	created_via?: 'chat' | 'api';
}

export interface BookMetadata {
	title: string;
	authors: string[];
	year?: number;
	publisher?: string;
	page_count?: number;
	genres: string[];
	description?: string;
	cover_url?: string;
	isbn?: string;
	google_books_id: string;
}

export interface MusicMetadata {
	title: string;
	artist: string;
	artists: string[];
	album: string;
	album_cover_url?: string;
	year?: number;
	duration_ms: number;
	genres: string[];
	spotify_id: string;
	spotify_url: string;
	preview_url?: string;
	popularity?: number;
}

export interface ImageMetadata {
	url: string;
	source_domain?: string;
	format?: string;
	width?: number;
	height?: number;
	size_bytes?: number;
	exif_date_taken?: string;
	exif_gps_lat?: number;
	exif_gps_lng?: number;
	exif_camera_model?: string;
	description?: string;
}

export type ItemMetadata =
	| MovieMetadata
	| TVShowMetadata
	| VideoMetadata
	| LinkMetadata
	| NoteMetadata
	| MemoMetadata
	| BookMetadata
	| MusicMetadata
	| ImageMetadata;
