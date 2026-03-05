import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	target: 'node20',
	outDir: 'dist',
	clean: true,
	sourcemap: true,
	splitting: false,
	bundle: true,
	external: [/node_modules/],
	platform: 'node',
	tsconfig: './tsconfig.json',
});
