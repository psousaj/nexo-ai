import axios from 'axios';

// Base API configuration
// In the future, this will point to your Hono/Node backend
const api = axios.create({
	baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3002/api',
	headers: {
		'Content-Type': 'application/json',
	},
	withCredentials: true, // Required for better-auth sessions
});

export default api;
