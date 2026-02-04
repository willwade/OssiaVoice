import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  base: '/',
  define: {
    global: 'globalThis'
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      stream: 'stream-browserify',
      events: 'events',
      timers: 'timers-browserify',
      'aac-board-viewer/vue': fileURLToPath(
        new URL('../../node_modules/aac-board-viewer/dist/vue/index.mjs', import.meta.url)
      )
    }
  }
})
