import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: true,
    port: 5174,
    allowedHosts: true
  },
  preview: {
    host: true,
    port: 3000,
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        testReality: resolve(__dirname, 'test-reality.html'),
      },
    },
  },
});
