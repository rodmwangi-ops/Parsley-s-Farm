// ============================================================
// PARSLEY'S FARM v6 — Offline support
// App files: try the network first (so updates arrive), fall back to the saved copy.
// Supabase requests are never touched here: the app's own outbox handles offline saving.
// ============================================================
const VERSION = '6.0.1';
const CACHE = `parsleys-farm-${VERSION}`;
const SHELL = [
  './', './index.html', './css/app.css?v=6.0.1',
  './js/config.js?v=6.0.1', './js/layout.js?v=6.0.1', './js/seed-data.js?v=6.0.1', './js/store.js?v=6.0.1', './js/app.js?v=6.0.1',
  './manifest.json', './icons/icon-192.svg', './icons/icon-512.svg',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Removes every older cache, including the old app's.
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok && (url.origin === location.origin || url.hostname.includes('jsdelivr') || url.hostname.includes('gstatic') || url.hostname.includes('googleapis'))) {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
