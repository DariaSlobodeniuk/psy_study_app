// Кешує додаток, щоб він відкривався без інтернету. Дані завжди пробує взяти свіжі.
const CACHE = 'study-v11';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icons/cat/rig/angL.webp', 'icons/cat/rig/angR.webp', 'icons/cat/rig/arcL.webp', 'icons/cat/rig/arcR.webp', 'icons/cat/rig/bang.webp', 'icons/cat/rig/blushL.webp', 'icons/cat/rig/blushR.webp', 'icons/cat/rig/body.webp', 'icons/cat/rig/earL.webp', 'icons/cat/rig/earR.webp', 'icons/cat/rig/eyeL.webp', 'icons/cat/rig/eyeR.webp', 'icons/cat/rig/gt.webp', 'icons/cat/rig/head_cut.webp', 'icons/cat/rig/heart.webp', 'icons/cat/rig/lt.webp', 'icons/cat/rig/mouthO.webp', 'icons/cat/rig/mouthOpen.webp', 'icons/cat/rig/mouthTiny.webp', 'icons/cat/rig/mouthW.webp', 'icons/cat/rig/qmark.webp', 'icons/cat/rig/scribble.webp', 'icons/cat/rig/spark.webp', 'icons/cat/rig/spark2.webp', 'icons/cat/rig/tail.webp', 'icons/cat/rig/upL.webp', 'icons/cat/rig/upR.webp', 'icons/cat/rig/zzz.webp', 'icons/icon-192.png', 'icons/icon-512.png', 'data/data.json', 'data/learn/index.json', 'data/learn/quiz.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // мережа спершу, кеш як запасний варіант
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => list.length ? list[0].focus() : self.clients.openWindow('./')));
});
