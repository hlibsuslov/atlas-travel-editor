/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * Emit public, non-secret build provenance. Vercel and GitHub Actions provide the
 * commit/environment variables automatically; local builds intentionally report
 * a null commit. Operators can verify what is live without dashboard access.
 */
const buildInfoPlugin: Plugin = {
  name: 'atlas-build-info',
  generateBundle() {
    const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null;
    const environment =
      process.env.VERCEL_ENV ??
      (process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local');
    this.emitFile({
      type: 'asset',
      fileName: 'build-info.json',
      source: `${JSON.stringify(
        {
          app: 'atlas',
          version: process.env.npm_package_version ?? null,
          commit,
          environment,
          builtAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    });
  },
};

const basePath = process.env.GITHUB_PAGES === 'true' ? '/atlas-travel-editor/' : '/';

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves the app under /atlas-travel-editor/; Vercel, Docker and
  // any root-domain/self-host deploy stay at '/'.
  base: basePath,
  plugins: [
    react(),
    buildInfoPlugin,
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
        start_url: basePath,
        scope: basePath,
        icons: [
          { src: `${basePath}favicon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          {
            src: `${basePath}maskable-icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
          {
            src: `${basePath}maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: `${basePath}apple-touch-icon.png`,
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
          },
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
