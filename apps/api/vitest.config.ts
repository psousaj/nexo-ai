import { resolve } from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const pnpmStore = resolve(__dirname, '../../node_modules/.pnpm/node_modules');

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
			// pnpm strict mode: resolve unhoisted packages from pnpm virtual store
			'@sentry/core': resolve(pnpmStore, '@sentry/core'),
			'@sentry/node': resolve(pnpmStore, '@sentry/node'),
			'js-yaml': resolve(pnpmStore, 'js-yaml'),
		},
		dedupe: ['@sentry/core', '@sentry/node', 'js-yaml'],
	},
});
