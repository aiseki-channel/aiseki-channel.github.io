/**
 * Service Worker for 相席ちゃんねる
 *
 * Strategy:
 * - App shell (index.html, icons) → Cache-first, so the app loads
 *   instantly and works offline (showing stale counts).
 * - Cloudflare Worker API calls → Network-only (always fetch fresh;
 *   we never want to serve cached counts as if they were live).
 */

const CACHE = 'aiseki-v1';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install: cache the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-only for API calls, cache-first for shell
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Let Cloudflare Worker requests go straight to network
  if (url.hostname.endsWith('workers.dev')) {
    return; // browser handles it normally
  }

  // Cache-first for same-origin shell assets
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          // Cache any new shell assets we encounter
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
  }
});
