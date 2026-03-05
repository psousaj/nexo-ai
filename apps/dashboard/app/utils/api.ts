import axios from 'axios';
import { useRuntimeConfig } from '#imports';

function normalizeApiBaseUrl(rawBaseUrl?: string): string {
	const fallbackBaseUrl = 'http://localhost:3001/api';
	const baseUrl = (rawBaseUrl || fallbackBaseUrl).trim().replace(/\/+$/, '');

	if (baseUrl.endsWith('/api')) {
		return baseUrl;
	}

	return `${baseUrl}/api`;
}

function resolveApiBaseUrl(): string {
	try {
		const config = useRuntimeConfig();
		return normalizeApiBaseUrl(config.public.apiUrl);
	} catch {
		return normalizeApiBaseUrl(import.meta.env.NUXT_PUBLIC_API_URL);
	}
}

// Base API configuration
// A URL é normalizada para sempre incluir o sufixo /api
export const api = axios.create({
	baseURL: resolveApiBaseUrl(),
	headers: {
		'Content-Type': 'application/json',
	},
	withCredentials: true, // Required for better-auth sessions
});

export default api;
