/* Minimal service worker so vCards can be installed as apps (PWA). Network-first, cache fallback for offline. */
const CACHE = 'vcard-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin || req.url.includes('/api/')) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok && (req.mode === 'navigate' || /\.(css|woff2|png|jpg|webp|svg)$/.test(req.url))) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req)));
});
