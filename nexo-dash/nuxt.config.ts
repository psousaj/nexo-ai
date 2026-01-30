// https://nuxt.com/docs/api/configuration/nuxt-config
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
			apiUrl: process.env.NUXT_PUBLIC_API_URL, // Nuxt will automatically pick this up if mapped, but explicit is fine
			authBaseUrl: process.env.NUXT_PUBLIC_AUTH_BASE_URL,
		},
	},
});
