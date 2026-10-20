import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

// Versión de la plataforma (package.json): "canal" + major.minor, ej. "Alpha V2.0".
// Ver CHANGELOG.md para qué trae cada versión.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string; canal: string }

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_CANAL__: JSON.stringify(pkg.canal),
  },
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