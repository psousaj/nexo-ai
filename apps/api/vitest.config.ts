import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		globals: true,
		setupFiles: ['./src/tests/setup.ts'],
		include: ['src/tests/**/*.test.ts'],
		exclude: ['node_modules', 'dist'],
		coverage: {
			reporter: ['text', 'json', 'html'],
			exclude: ['node_modules/', 'src/tests/'],
		},
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, './src'),
		},
	},
});
