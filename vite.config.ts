import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    // Avoid transforming the briefly empty file produced by truncate-then-write saves.
    watch: { awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 } },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
