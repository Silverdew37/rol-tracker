/* ============================================================
   SERVICE WORKER — Rol Tracker
   Permite que la app funcione offline y se instale como PWA.
   Cachea todos los archivos estáticos en la primera carga.
   ============================================================ */

// ⚠️ IMPORTANTE: cambia este número cada vez que subas cambios a GitHub.
// El navegador detectará la versión nueva y descargará los archivos actualizados
// automáticamente, sin borrar los datos de la app (localStorage no se toca).
const CACHE_NAME = 'rol-tracker-v4';

// Archivos que se cachean para uso offline
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/data.js',
  './js/ui.js',
  './js/notifications.js',
  './js/app.js',
  './manifest.json'
];

// Al instalar el SW, cachea todos los assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Al activar, elimina cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Intercepta peticiones: sirve desde caché si está disponible
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

/* ============================================================
   NOTIFICACIONES PROGRAMADAS
   El SW recibe mensajes desde la app para programar alarmas.
   Como los SW no tienen setTimeout persistente entre sesiones,
   usamos el evento 'periodicsync' si está disponible, o
   simplemente mostramos la notificación cuando la app está abierta.
   ============================================================ */

// Recibe mensajes desde la app principal
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data;
    self.registration.showNotification(title, {
      body,
      tag,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [200, 100, 200]
    });
  }
});
