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

export type ItemMetadata = MovieMetadata | TVShowMetadata | VideoMetadata | LinkMetadata | NoteMetadata;
