import { URL, fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
export default defineConfig({
    plugins: [vue()],
    server: {
        port: process.env.PORT_LANDING ? Number.parseInt(process.env.PORT_LANDING) : 3005,
        strictPort: false, // Permite porta alternativa se 3005 estiver ocupada
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});
