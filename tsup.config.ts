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
});
