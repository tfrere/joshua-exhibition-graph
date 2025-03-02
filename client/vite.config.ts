import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    allowedHosts: ["localhost", ".railway.app"],
  },
});
