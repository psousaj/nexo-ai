import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [vue()],
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: [],
		include: ['src/tests/**/*.{test,spec}.{ts,js}'],
		exclude: ['node_modules', 'dist'],
	},
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
			'~': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
});
