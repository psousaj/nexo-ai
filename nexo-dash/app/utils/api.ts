import axios from 'axios';
import { env } from '~/config/env';

// Base API configuration
export const api = axios.create({
	baseURL: env.NUXT_PUBLIC_API_URL,
	headers: {
		'Content-Type': 'application/json',
	},
	withCredentials: true, // Required for better-auth sessions
});

export default api;
