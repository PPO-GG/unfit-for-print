import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

export default defineConfig({
    plugins: [vue()],
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['tests/**/*.test.ts'],
        exclude: ['node_modules', 'dist', '.nuxt', '.output'],
    },
    resolve: {
        alias: {
            '~': fileURLToPath(new URL('./', import.meta.url)),
            '@': fileURLToPath(new URL('./', import.meta.url)),
            // Add these aliases for Nuxt compatibility
            '#app': fileURLToPath(new URL('./node_modules/nuxt/dist/app', import.meta.url)),
            '#imports': fileURLToPath(new URL('./node_modules/nuxt/dist/app/imports', import.meta.url)),
            '#build': fileURLToPath(new URL('./.nuxt', import.meta.url)),
        },
    },
})