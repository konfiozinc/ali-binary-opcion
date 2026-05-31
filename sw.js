// ============================================================
// SERVICE WORKER — Ali Binary Options Pro
// ============================================================

const CACHE_NAME = "ali-binary-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/admin.html",
  "/sala.html",
  "/manifest.json",
  "/js/firebase-config.js",
  "/js/auth.js",
  "/js/roles.js",
  "/js/signal-controller.js",
  "/js/users-controller.js",
  "/js/admin-controller.js",
  "/js/sala-controller.js"
];

// ── INSTALL: cachear assets estáticos ──────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: limpiar caches viejos ────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: network-first, fallback cache ───────────────────
self.addEventListener("fetch", event => {
  // Solo manejar GETs del mismo origen
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Firebase requests → siempre red
  if (event.request.url.includes("firebase") ||
      event.request.url.includes("googleapis") ||
      event.request.url.includes("gstatic")) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        // Guardar copia fresca en cache
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── PUSH NOTIFICATIONS (preparado) ─────────────────────────
self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};
  const title   = data.title   || "Nueva Señal 📡";
  const options = {
    body:    data.body    || "Hay una nueva señal disponible",
    icon:    "/assets/icon-192.png",
    badge:   "/assets/icon-192.png",
    vibrate: [200, 100, 200],
    data:    { url: "/sala.html" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url || "/sala.html"));
});
