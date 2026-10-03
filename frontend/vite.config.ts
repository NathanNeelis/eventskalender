import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Override with API_TARGET=http://127.0.0.1:8001 npm run dev to use another backend
      '/api': process.env.API_TARGET ?? 'http://127.0.0.1:8000',
    },
  },
})
