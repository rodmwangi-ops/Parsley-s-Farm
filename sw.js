// ============================================================
// PARSLEY'S FARM — Service Worker
// Offline-first caching strategy (Firestore edition)
// ============================================================

const CACHE_NAME = 'parsleys-farm-v4.1';

// Pre-cache: app assets + Firebase SDK (versioned, never change)
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
  // Firebase SDK — versioned static files, safe to cache permanently
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js'
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

  // --- Network-first: Firebase/Google dynamic API calls only ---
  // Auth endpoints, Firestore data sync, token refresh.
  // Does NOT include gstatic.com (static SDK/font files — those get cached).
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('firebasestorage.app') ||
      (url.hostname.includes('google.com') && !url.hostname.includes('gstatic'))) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // --- Cache-first: app files, Firebase SDK, Google Fonts, everything else ---
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Serve from cache, update in background
        fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
          }
        }).catch(() => { });
        return cached;
      }

      // Not cached — fetch from network, then cache
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
