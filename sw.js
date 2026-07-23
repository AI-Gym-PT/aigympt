/* AI Gym PT service worker — cache de mo nhanh + chay offline */
const CACHE = 'aigympt-v38';  // v38: THANH TIM KIEM BAI - go ten (khong dau cung duoc), tim ca ten Viet/Anh/alias/dung cu, ket qua phang tat ca nhom; khong thay thi goi y tu them
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const cur = await caches.open(CACHE);
    for (const k of keys) {
      if (k === CACHE) continue;
      // di tru HINH bat bien (jpg/png) tu cache cu sang cache moi (khong doi).
      // KHONG di tru mp3: giong da doc lai o v3 -> de tai moi cho khoi nghe giong cu.
      try {
        const old = await caches.open(k);
        for (const req of await old.keys()) {
          if (/\.(jpe?g|png)$/.test(new URL(req.url).pathname) && !(await cur.match(req))) {
            const res = await old.match(req);
            if (res) await cur.put(req, res);
          }
        }
      } catch (err) {}
      await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // trang chinh: uu tien mang (nhan ban cap nhat), rot mang thi dung cache
  if (e.request.mode === 'navigate' || url.pathname.endsWith('index.html')) {
    e.respondWith((async () => {
      try {
        const net = fetch(e.request).then(r => {
          if (!r || !r.ok) throw new Error('bad status ' + (r && r.status)); // 404 luc Pages deploy / 5xx -> KHONG phuc vu trang loi, roi ve cache
          const cp = r.clone(); caches.open(CACHE).then(c => c.put('./', cp));
          return r;
        });
        // mang gym cham: chay dua voi 4s — co app trong cache thi dung ngay, khong bat user nhin man trang
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000));
        return await Promise.race([net, timeout]);
      } catch (err) {
        return (await caches.match('./')) || (await caches.match('./index.html')) || fetch(e.request);
      }
    })());
    return;
  }
  // CHI file media bat bien (mp3/jpg/png) moi cache-first;
  // manifest.json cua voice PHAI network-first, khong thi user cu khong bao gio thay giong moi
  if (/\.(mp3|jpe?g|png)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
        return r;
      }))
    );
    return;
  }
  // con lai (gom voice/manifest.json): mang truoc + LUU BAN SAO vao cache lam du phong offline
  // -> mat mang van doc duoc manifest, 314 mp3 da cache khong bi "chet"
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
