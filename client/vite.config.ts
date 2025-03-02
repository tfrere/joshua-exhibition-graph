import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    {
      name: 'glsl',
      transform(code, id) {
        if (id.endsWith('.glsl')) {
          const transformedCode = `export default ${JSON.stringify(code)};`;
          return {
            code: transformedCode,
            map: null
          };
        }
      }
    }
  ],
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    allowedHosts: ["localhost", ".railway.app"],
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  optimizeDeps: {
    exclude: ['force-calculations']
  },
  server: {
    port: 3000,
    open: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    middlewareMode: false,
    fs: {
      strict: false,
      allow: ['..']
    }
  },
  assetsInclude: ['**/*.wasm', '**/*.js', '**/*.glsl'],
  publicDir: 'public'
});
