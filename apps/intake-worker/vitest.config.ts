import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		globals: true,
		include: ['src/tests/**/*.test.ts'],
		exclude: ['node_modules', 'dist'],
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, './src'),
			'@nexo/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
		},
	},
});
