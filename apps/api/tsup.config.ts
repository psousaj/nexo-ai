import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';
import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	target: 'node20',
	outDir: 'dist',
	clean: true,
	sourcemap: true,
	minify: false,
	splitting: false,
	bundle: true,
	// NÃO fazer bundle de nada de node_modules, apenas código interno
	external: [/node_modules/],
	platform: 'node',
	tsconfig: './tsconfig.json',
	esbuildPlugins: [
		// Upload de sourcemaps para o Sentry no build
		// Requer SENTRY_AUTH_TOKEN no ambiente (CI ou local)
		...(process.env.SENTRY_AUTH_TOKEN
			? [
					sentryEsbuildPlugin({
						org: process.env.SENTRY_ORG || 'ze-filho',
						project: process.env.SENTRY_PROJECT || 'node-hono',
						authToken: process.env.SENTRY_AUTH_TOKEN,
						release: {
							name: `nexo-api@${process.env.npm_package_version || '0.0.0'}`,
						},
						sourcemaps: {
							assets: './dist/**',
						},
						telemetry: false,
					}),
				]
			: []),
	],
	onSuccess: async () => {
		const { cpSync, existsSync } = await import('node:fs');
		const { join } = await import('node:path');

		const templatesSource = join('src', 'templates');
		const templatesDest = join('dist', 'templates');

		if (existsSync(templatesSource)) {
			cpSync(templatesSource, templatesDest, { recursive: true });
			console.log('✓ Templates copiados para dist/templates');
		} else {
			console.warn('⚠ Pasta templates não encontrada em', templatesSource);
		}
	},
});
