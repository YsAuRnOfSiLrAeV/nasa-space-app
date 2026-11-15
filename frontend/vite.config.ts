import { fileURLToPath, URL } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Explicit extension: Vite's native config loader requires it.
import { demoDataPlugin } from './scripts/demoData.ts';

export default defineConfig(({ mode }) => {
  // Server-side settings (not exposed to the app): see .env.example.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), demoDataPlugin()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      // The team FastAPI (backend/api, `uvicorn api.main:app`) in dev: same origin,
      // so no CORS. `/api/health` -> `<target>/health`.
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      manifest: true,
      // MapLibre alone is ~1 MB minified (~280 kB gzip); that is the floor for a WebGL map.
      chunkSizeWarningLimit: 1100,
      // Keep automatic entry-aware splitting: a manual chart vendor group can
      // pull shared helpers into a chunk that the landing must then import.
    },
    test: {
      // Real GeoJSON fixtures are memory/CPU heavy; bound concurrency on desktop machines.
      maxWorkers: 4,
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    },
  };
});
