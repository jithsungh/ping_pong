import { defineConfig } from 'vite';

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
    sourcemap: true
  }
});
