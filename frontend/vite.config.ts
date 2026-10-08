import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // El service worker se actualiza solo: al publicar una versión nueva, la
      // próxima vez que se abra la app ya está al día, sin pedirle nada al usuario.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'og-image.png', 'robots.txt'],
      manifest: {
        name: 'RepairOS — Gestión de taller',
        short_name: 'RepairOS',
        description:
          'Órdenes de reparación, clientes, equipos y presupuestos para talleres de electrónica.',
        lang: 'es',
        start_url: '/inicio',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0A0D12',
        theme_color: '#0A0D12',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // La API nunca se cachea: una orden vieja mostrada como actual es peor
        // que un error de red visible.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Las tipografías de Google sí, que no cambian nunca.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Fotos de equipos y firmas: se muestran desde caché si ya se vieron.
            urlPattern: /\/uploads\/.*\.(png|jpg|jpeg|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'imagenes-ordenes',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  resolve: {
    // `@/features/...` en vez de `../../../features/...`.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    port: 5173
  }
});
