import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['d3-force']
  },
  build: {
    rollupOptions: {
      // Si nécessaire, configurez des options spécifiques de build ici
    }
  }
})
