import axios from 'axios';

// Base API configuration
// NUXT_PUBLIC_API_URL já inclui o sufixo /api
export const api = axios.create({
	baseURL: import.meta.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001/api',
	headers: {
		'Content-Type': 'application/json',
	},
	withCredentials: true, // Required for better-auth sessions
});

export default api;
