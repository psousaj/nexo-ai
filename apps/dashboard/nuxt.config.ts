import { resolve } from 'node:path';
// https://nuxt.com/docs/api/configuration/nuxt-config
import { config } from 'dotenv';

// Carregar .env da raiz do monorepo
config({ path: resolve(__dirname, '../../.env') });

import { env } from './app/config/env';

export default defineNuxtConfig({
	modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/image', '@nuxt/scripts', '@nuxt/test-utils', '@pinia/nuxt'],

	devtools: {
		enabled: true,
	},

	// Dashboard é SPA administrativa (sem necessidade de SEO)
	// Desabilitar SSR elimina hydration mismatches e problemas de auth com cookies
	ssr: false,

	devServer: {
		port: env.PORT_DASHBOARD || 5173,
		host: '0.0.0.0',
	},

	vite: {
		server: {
			allowedHosts: true, // Permite qualquer host (zrok, ngrok, etc.)
		},
	},

	css: ['~/assets/css/main.css'],

	routeRules: {
		'/': { prerender: false },
	},

	compatibilityDate: '2025-01-15',

	eslint: {
		config: {
			stylistic: {
				commaDangle: 'never',
				braceStyle: '1tbs',
			},
		},
	},

	runtimeConfig: {
		public: {
			apiUrl: env.NUXT_PUBLIC_API_URL || 'http://localhost:3001/api',
			authBaseUrl: env.NUXT_PUBLIC_AUTH_BASE_URL || 'http://localhost:3001',
		},

}
	});
