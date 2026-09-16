import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        // Dev local: apunta al mtw-api que corre en localhost:4000 (con
        // DISABLE_CF_ACCESS_LOCAL_DEV=true). Para probar contra produccion,
        // cambiar temporalmente a https://mtw-relay-api-production.up.railway.app
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})