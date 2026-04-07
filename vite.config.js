import { defineConfig } from 'vite';

export default defineConfig({
  base: '/3D-aquarium-demo/',
  publicDir: 'public',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
});
