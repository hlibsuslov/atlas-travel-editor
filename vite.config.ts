/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves the app under /atlas-travel-editor/; Vercel, Docker and
  // any root-domain/self-host deploy stay at '/'.
  base: process.env.GITHUB_PAGES ? '/atlas-travel-editor/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'maskable-icon.svg',
        'maskable-512.png',
        'apple-touch-icon.png',
        'og-image.png',
      ],
      manifest: {
        name: 'Atlas — Personal travel cartography',
        short_name: 'Atlas',
        description: 'Map every country you were born in, have lived in, or visited.',
        // Brand tokens: paper ground, ink mark. Matches <meta name="theme-color">.
        theme_color: '#f3efe6',
        background_color: '#f3efe6',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/maskable-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          {
            src: '/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        // Don't precache the large world atlas json; serve it stale-while-revalidate.
        // The app bundles the detailed 50m atlas (see WorldMap.tsx), so the runtime
        // rule must match that filename — not the unused 110m one.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /countries-50m.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'world-atlas' },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // The detailed 50m world atlas lives in a lazy-loaded map chunk, so a large
    // size there is expected and does not affect the initial load.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Split vendor chunks so app code can be cached independently of deps.
        manualChunks: {
          react: ['react', 'react-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Only the client's own tests. `server/` is a separate package with its own
    // test runner (Node's built-in, for node:sqlite), so keep it out of here.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/**/*.d.ts'],
    },
  },
});
