import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.test.ts', '**/*.spec.ts'],
  },
  resolve: {
    alias: {
      // Same as Nuxt
      '~': path.resolve(__dirname, './'),
      '@': path.resolve(__dirname, './'),
      '#app': path.resolve(__dirname, './.nuxt/app'),
      '#imports': path.resolve(__dirname, './.nuxt/imports'),
      '#build': path.resolve(__dirname, './.nuxt'),
    },
  },
})