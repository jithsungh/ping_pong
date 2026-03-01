import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PaddleLink - Phone Paddle',
        short_name: 'PaddleLink',
        description: 'Use your phone as a table tennis paddle',
        theme_color: '#1B5E20',
        background_color: '#1B5E20',
        display: 'fullscreen',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    host: true, // Allow external access for phone testing
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
