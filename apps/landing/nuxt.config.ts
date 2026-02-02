// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  vite:{
    server: {
      allowedHosts: ['nexo.localhost','nexo.crudbox.tech']
    }
  },
  app: {
    head: {
      title: 'Nexo AI - Sua Segunda Memória Digital',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { hid: 'description', name: 'description', content: 'O assistente que organiza filmes, séries, links e notas automaticamente. Disponível no WhatsApp, Telegram e Discord.' }
      ]
    }
  }
})
