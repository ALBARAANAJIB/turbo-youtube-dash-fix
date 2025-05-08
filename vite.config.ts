
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { crx } from '@crxjs/vite-plugin'
import fs from 'fs'

// Read the manifest file
const manifestJson = fs.readFileSync('./public/manifest.json', 'utf-8')
const manifest = JSON.parse(manifestJson)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8080,
    host: "::",
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: 'index.html',
        popup: './public/popup.html',
        dashboard: './public/dashboard.html',
        background: './public/background.js'
      },
    }
  }
})
