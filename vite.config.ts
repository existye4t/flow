import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: './',
  publicDir: 'assets',
  base: './',
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@main': path.resolve(__dirname, './src/main'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: {
    port: 5713,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist-renderer',
  },
  clearScreen: false,
})
