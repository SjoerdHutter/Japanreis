import { defineConfig, type Plugin } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { parse as parseYaml } from 'yaml';
import { TEGEL_CACHE } from './src/kaart/constanten.ts';

// De app draait op https://<gebruiker>.github.io/Japanreis/, dus alle assets
// moeten met dat pad worden opgevraagd. Lokaal draaien werkt met hetzelfde pad.
const BASE = '/Japanreis/';

/**
 * Welke build dit is. In CI zet GitHub Actions de commit-sha in de omgeving;
 * lokaal staat er "lokaal". Handig bij een vreemde melding onderweg: dan zie je
 * meteen of je toestel wel op de laatste versie zit.
 */
const VERSIE = (process.env.GITHUB_SHA ?? 'lokaal').slice(0, 7);
const GEBOUWD_OP = new Date().toISOString();

/**
 * Laat `import ... from './x.yaml'` werken.
 *
 * De reiscontent staat in YAML omdat je dat met de hand bijwerkt, ook vanaf je
 * telefoon op github.com. De app krijgt er gewone JSON van, zodat er in de
 * browser geen YAML-parser hoeft mee te reizen. Fout in de YAML betekent een
 * mislukte build en niet een lege stad onderweg.
 */
const yamlPlugin = (): Plugin => ({
  name: 'japanreis-yaml',
  transform(code, id) {
    if (!id.endsWith('.yaml') && !id.endsWith('.yml')) return null;
    const data = parseYaml(code);
    return { code: `export default ${JSON.stringify(data)};`, map: null };
  },
});

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSIE__: JSON.stringify(VERSIE),
    __APP_GEBOUWD_OP__: JSON.stringify(GEBOUWD_OP),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    yamlPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // De app registreert de worker zelf, in src/pwa.ts. Het regeltje dat deze
      // plugin anders injecteert registreert alleen en herlaadt nooit, waardoor
      // een geïnstalleerde app op oude code blijft hangen.
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Japanreis',
        short_name: 'Japanreis',
        description: 'Reisgids voor Japan en Hanoi, offline te gebruiken.',
        lang: 'nl',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf7f2',
        theme_color: '#8c2f39',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            // Tegels die je onderweg tegenkomt blijven staan, zodat een stuk
            // kaart dat je al gezien hebt het ook zonder bereik doet. Dezelfde
            // cache als de knop "stad offline opslaan" vult.
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*\.png$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: TEGEL_CACHE,
              expiration: { maxEntries: 20000, maxAgeSeconds: 60 * 60 * 24 * 120 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // De wisselkoers: netwerk eerst, want een verse koers is beter dan
            // een oude. Lukt dat niet, dan pakt de app de laatst bewaarde koers
            // uit IndexedDB; deze cache is alleen de eerste terugval.
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|open\.er-api\.com)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'wisselkoers',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
