// https://nuxt.com/docs/api/configuration/nuxt-config
import { validateEnv } from './app/config/env';

validateEnv();

export default defineNuxtConfig({
	modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/image', '@nuxt/scripts', '@nuxt/test-utils', '@pinia/nuxt'],

	devtools: {
		enabled: true,
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
			apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3002/api',
			authBaseUrl: process.env.NUXT_PUBLIC_AUTH_BASE_URL || 'http://localhost:3002/api/auth',
		},
	},
});
