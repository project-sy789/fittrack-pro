/* FitTrack Pro — Service Worker v10
 * - Auto-update: skipWaiting + clients.claim + reload notification
 * - network-first for navigation (always fresh HTML)
 * - cache-first for static assets (icons, manifest)
 * - stale-while-revalidate for CDN (Chart.js)
 */
const CACHE = 'fittrack-v10';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: precache core assets ──
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS).catch(() => {});  // best-effort
    self.skipWaiting();  // activate new SW immediately
  })());
});

// ── ACTIVATE: clean old caches + notify clients to reload ──
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    // Tell all clients an update happened
    const clients = await self.clients.matchAll({type: 'window'});
    clients.forEach(c => c.postMessage({type: 'SW_UPDATED'}));
  })());
});

// ── FETCH ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET (POST etc.)
  if (e.request.method !== 'GET') return;

  // Navigation requests → network-first (always fresh HTML)
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(e.request, {cache: 'no-store'});
        const c = await caches.open(CACHE);
        c.put('./index.html', net.clone());
        return net;
      } catch (err) {
        // Offline → cached index or offline page
        const cached = await caches.match('./index.html');
        return cached || caches.match('./');
      }
    })());
    return;
  }

  // Same-origin static assets → cache-first
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      if (cached) {
        // Revalidate in background
        fetch(e.request).then(net => {
          if (net && net.ok) {
            caches.open(CACHE).then(c => c.put(e.request, net.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      // Not cached → fetch and cache
      const net = await fetch(e.request);
      if (net && net.ok) {
        caches.open(CACHE).then(c => c.put(e.request, net.clone()));
      }
      return net;
    })());
    return;
  }

  // CDN (Chart.js) → stale-while-revalidate
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      const netPromise = fetch(e.request).then(net => {
        if (net && net.ok) {
          caches.open(CACHE).then(c => c.put(e.request, net.clone()));
        }
        return net;
      }).catch(() => cached);
      return cached || netPromise;
    })());
    return;
  }
});

// ── MESSAGE: allow page to force-activate ──
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
