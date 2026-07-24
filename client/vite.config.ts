import { defineConfig } from 'vite';

declare const process: { env: Record<string, string | undefined> };

export default defineConfig(() => ({
  build: { outDir: 'build' },
  server: {
    proxy: {
      '/api': process.env.VITE_BACKEND_URL || 'http://127.0.0.1:5013',
    },
  },
}));
