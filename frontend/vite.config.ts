import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'

export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      cert: fs.readFileSync('../backend/certs/localhost+2.pem'),
      key: fs.readFileSync('../backend/certs/localhost+2-key.pem'),
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})