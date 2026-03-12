import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
	plugins: [tsconfigPaths()],
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
			'@nexo/api-core': resolve(__dirname, '../../packages/api-core/src'),
		},
	},
});
