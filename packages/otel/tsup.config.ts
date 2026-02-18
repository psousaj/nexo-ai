import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts', 'src/tracing.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	clean: true,
	sourcemap: true,
	splitting: false,
	target: 'node20',
	outDir: 'dist',
	external: ['@opentelemetry/*'],
});
