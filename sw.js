const CACHE = 'fittrack-v3';
self.addEventListener('install', e => {
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  // NEVER cache index.html — always fetch fresh
  if (e.request.url.includes('index.html') || e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request)));
    return;
  }
  // CDN: always fresh
  if (e.request.url.includes('cdn.jsdelivr.net')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Other assets: cache-first with network update
  e.respondWith(caches.match(e.request).then(r => {
    return r || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    });
  }));
});
