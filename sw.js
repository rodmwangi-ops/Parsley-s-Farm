// ============================================================
// PARSLEY'S FARM — Service Worker
// Offline-first caching (Supabase edition)
// ============================================================

const SW_VERSION = '5.2.0';
const CACHE_NAME = `parsleys-farm-v${SW_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './js/config.js',
  './js/auth.js',
  './js/db.js',
  './js/sync.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  // Supabase SDK — versioned, safe to cache
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install: cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.log('Some assets failed to cache:', err);
        return Promise.allSettled(ASSETS.map(url => cache.add(url)));
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first: Supabase API calls + Google Auth (NOT fonts)
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('accounts.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-first: app files, Supabase SDK, Google Fonts, everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
          }
        }).catch(() => { });
        return cached;
      }

      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
