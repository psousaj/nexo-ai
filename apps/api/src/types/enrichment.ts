export interface MovieMetadata {
	title: string;
	year: number;
	director: string;
	overview: string;
	tmdbId: number;
	posterUrl?: string;
	genres: string[];
}

export interface TVShowMetadata {
	title: string;
	firstAirYear: number;
	overview: string;
	tmdbId: number;
	genres: string[];
}

export interface MusicMetadata {
	title: string;
	artist: string;
	album?: string;
	spotifyUrl?: string;
	previewUrl?: string;
}

export interface BookMetadata {
	title: string;
	author: string;
	isbn?: string;
	publisher?: string;
	pageCount?: number;
}

export interface VideoMetadata {
	title: string;
	channelTitle: string;
	videoUrl: string;
	thumbnailUrl?: string;
}

export interface LinkMetadata {
	title?: string;
	description?: string;
	image?: string;
	url: string;
}

export interface ImageMetadata {
	url: string;
	width?: number;
	height?: number;
	contentType?: string;
	fileSize?: number;
}
