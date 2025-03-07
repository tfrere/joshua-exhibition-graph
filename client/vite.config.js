import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Configuration ESM pour obtenir l'équivalent de __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  optimizeDeps: {
    include: ['d3-force'] // Pré-bundle d3-force pour le développement
  },
  build: {
    // Répertoire de sortie (relatif au dossier actuel)
    outDir: mode === 'production' 
      ? resolve(__dirname, '../server/dist/client') 
      : 'dist',
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:;"
    }
  }
}))
