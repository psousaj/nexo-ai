import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
	plugins: [vue()],
	server: {
		port: process.env.PORT_LANDING ? parseInt(process.env.PORT_LANDING) : 3005,
		strictPort: false, // Permite porta alternativa se 3005 estiver ocupada
	},
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
});
