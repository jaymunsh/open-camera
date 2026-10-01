import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Content-address runtime assets too: their filenames are not hashed by Vite.
const hash = createHash('sha256');
const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
function hashDirectory(relative: string) {
  for (const entry of readdirSync(join(publicRoot, relative), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const name = `${relative}/${entry.name}`;
    if (entry.isDirectory()) hashDirectory(name);
    else hash.update(name).update('\0').update(readFileSync(join(publicRoot, name))).update('\0');
  }
}
for (const dir of ['luts', 'wasm', 'models']) hashDirectory(dir);
const assetVersion = hash.digest('hex').slice(0, 16);

export default defineConfig({
  define: { __ASSET_VERSION__: JSON.stringify(assetVersion) },
  server: {
    allowedHosts: ['.trycloudflare.com'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'fonts/*', 'licenses/*', 'luts/film/CREDITS.md'],
      workbox: {
        globIgnores: ['wasm/**', 'models/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/(wasm|models)\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'oc-ml', expiration: { maxEntries: 12 } },
          },
          {
            urlPattern: /\/luts\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'oc-luts', expiration: { maxEntries: 64 } },
          },
        ],
      },
      manifest: {
        name: 'open-camera',
        short_name: 'Open Camera',
        description: '카메라 필터 PWA',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
