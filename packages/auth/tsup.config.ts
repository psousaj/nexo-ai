import { defineConfig } from 'tsup';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		client: 'src/client.ts',
		types: 'src/types.ts',
	},
	format: ['esm', 'cjs'],
	dts: true,
	clean: true,
	sourcemap: true,
	splitting: false,
	target: 'node20',
	outDir: 'dist',
	external: ['better-auth', 'better-auth/vue', 'better-auth/client'],
});
