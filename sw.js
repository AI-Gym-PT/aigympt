/* AI Gym PT service worker — cache de mo nhanh + chay offline */
const CACHE = 'aigympt-v1';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // trang chinh: uu tien mang (nhan ban cap nhat), rot mang thi dung cache
  if (e.request.mode === 'navigate' || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./', cp)); return r; })
        .catch(() => caches.match('./'))
    );
    return;
  }
  // giong noi + hinh anh: bat bien -> cache truoc, mang sau
  if (url.pathname.includes('/voice/') || url.pathname.includes('/img/') || url.pathname.includes('icon-')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
        return r;
      }))
    );
    return;
  }
  // con lai: mang truoc, cache du phong
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
