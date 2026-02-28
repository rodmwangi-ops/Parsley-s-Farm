// ============================================================
// PARSLEY'S FARM — Service Worker
// Offline-first caching strategy
// ============================================================

const CACHE_NAME = 'parsleys-farm-v3.1';
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
  './icons/icon-512.svg'
];

// External resources to cache
const EXTERNAL = [
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Space+Mono:wght@400;700&display=swap'
];

// Install: cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.log('Some assets failed to cache:', err);
        // Cache what we can
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

// Fetch: cache-first for app assets, network-first for API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Google APIs — always network (auth, sheets)
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('google.com') || url.hostname.includes('gstatic.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // App assets — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Return cached, but also update cache in background
        fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
          }
        }).catch(() => { });
        return cached;
      }

      // Not cached — fetch from network
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline and not cached — return offline page
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Background sync (when browser supports it)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-farm-data') {
    event.waitUntil(
      // Notify the client to push changes
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_REQUESTED' }));
      })
    );
  }
});
