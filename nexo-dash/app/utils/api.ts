import axios from 'axios';

// Base API configuration - will be initialized properly in a Nuxt plugin
export const api = axios.create({
	baseURL: 'http://localhost:3002/api',
	headers: {
		'Content-Type': 'application/json',
	},
	withCredentials: true, // Required for better-auth sessions
});

export default api;
