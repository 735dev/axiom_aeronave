// Service worker mínimo: da el arranque sin señal. La cola de envíos pendientes
// no vive acá sino en la aplicación (IndexedDB), porque necesita la sesión.
//
// No cachea respuestas de la API: mostrar un gasto viejo como si fuera actual
// es peor que no mostrar nada. Solo conserva el armazón de la aplicación.
const SHELL = 'shell-v1';
const SHELL_FILES = ['/', '/index.html', '/favicon.svg', '/isotipo.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // La navegación cae al armazón cacheado cuando no hay red.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request)),
  );
});
