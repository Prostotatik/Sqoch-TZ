import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // agent scratch folders must not trigger HMR reloads
    watch: { ignored: ['**/agents-*/**'] },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
