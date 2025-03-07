import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
  build: {
    rollupOptions: {
      external: ['d3-force']
    }
  }
})
