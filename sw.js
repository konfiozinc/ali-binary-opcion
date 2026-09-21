// ============================================================
// SERVICE WORKER v3 — Ali Binary Options Pro
//   · Push Notifications (Firebase Cloud Messaging)
//   · Estrategia de caché con versionado:
//       - HTML / navegación  → network-first (siempre fresca)
//       - Assets estáticos   → cache-first + revalidación en 2º plano
// ============================================================

importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// Config Firebase en el SW
firebase.initializeApp({
  apiKey:            "AIzaSyDRfZYY3d4ul1PJEp-KMHMYfbkT6QULk3U",
  authDomain:        "ali-binary-options.firebaseapp.com",
  projectId:         "ali-binary-options",
  storageBucket:     "ali-binary-options.firebasestorage.app",
  messagingSenderId: "215991454083",
  appId:             "1:215991454083:web:97423f29d542dcfc74ceb6"
});

const messaging = firebase.messaging();

// ── CACHE ───────────────────────────────────────────────────
// ⚠️ IMPORTANTE: sube CACHE_VERSION cada vez que cambies el código,
//    así los clientes descargan la versión nueva.
const CACHE_VERSION  = "v3";
const STATIC_CACHE   = `ali-binary-static-${CACHE_VERSION}`;
const PAGES_CACHE    = `ali-binary-pages-${CACHE_VERSION}`;
const CURRENT_CACHES = [STATIC_CACHE, PAGES_CACHE];

// HTML pre-cacheado como fallback offline (se sirven network-first).
const PAGES = [
  "./index.html",
  "./sala.html",
  "./admin.html"
];

// Assets estáticos (inmutables entre versiones) → cache-first.
const STATIC_ASSETS = [
  "./manifest.json",
  "./js/firebase-config.js",
  "./js/auth.js",
  "./js/roles.js",
  "./js/signal-controller.js",
  "./js/users-controller.js",
  "./js/admin-controller.js",
  "./js/sala-controller.js",
  "./assets/logo.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

// Nunca interceptar servicios externos (Firebase, fuentes, audio, analytics…)
function isExternal(url) {
  return url.startsWith("http") && !url.startsWith(self.location.origin);
}

self.addEventListener("install", e => {
  e.waitUntil(
    Promise.all([
      caches.open(PAGES_CACHE).then(c => Promise.allSettled(PAGES.map(a => c.add(a)))),
      caches.open(STATIC_CACHE).then(c => Promise.allSettled(STATIC_ASSETS.map(a => c.add(a))))
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !CURRENT_CACHES.includes(k)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (isExternal(url.href)) return;

  // HTML / navegación → network-first (los usuarios ven siempre la última versión)
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith(networkFirst(req));
    return;
  }

  // Resto (JS/CSS/imágenes/manifest) → cache-first con revalidación
  e.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const clone = res.clone();
      caches.open(PAGES_CACHE).then(c => c.put(req, clone));
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    const fallback = await caches.match("./index.html");
    return fallback || Response.error();
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  const network = fetch(req).then(res => {
    if (res && res.ok) {
      const clone = res.clone();
      caches.open(STATIC_CACHE).then(c => c.put(req, clone));
    }
    return res;
  }).catch(() => cached);
  return cached || network;
}

// ── FCM BACKGROUND MESSAGES ─────────────────────────────────
// Recibe push cuando la app está en background o pantalla apagada
messaging.onBackgroundMessage(payload => {
  const { title, body, asset, direction } = payload.data || payload.notification || {};
  const notifTitle   = title   || "📡 Nueva Señal — Alí Binary";
  const notifOptions = {
    body:    body || `${asset || ""} ${direction || ""} — Entra a la sala ahora`,
    icon:    "./assets/icon-192.png",
    badge:   "./assets/icon-192.png",
    vibrate: [300, 100, 300, 100, 300],
    tag:     "ali-signal",          // reemplaza notificación anterior
    renotify: true,
    requireInteraction: true,       // queda visible hasta que el usuario la toque
    data:    { url: "./sala.html" },
    actions: [
      { action: "open", title: "Abrir Sala" },
      { action: "dismiss", title: "Cerrar" }
    ]
  };
  return self.registration.showNotification(notifTitle, notifOptions);
});

// ── NOTIFICACIONES MANUALES (desde el propio cliente) ────────
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch(e) {}
  const title = payload.title || "📡 Nueva Señal — Alí Binary";
  const opts  = {
    body:    payload.body || "Nueva señal disponible en la sala",
    icon:    "./assets/icon-192.png",
    badge:   "./assets/icon-192.png",
    vibrate: [300, 100, 300, 100, 300],
    tag:     "ali-signal",
    renotify: true,
    requireInteraction: true,
    data:    { url: payload.url || "./sala.html" },
    actions: [
      { action: "open",    title: "Ver Señal" },
      { action: "dismiss", title: "Cerrar"    }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

// ── CLICK EN NOTIFICACIÓN ─────────────────────────────────────
self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const url = event.notification.data?.url || "./sala.html";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      // Si ya hay una ventana abierta, enfocarla
      for (const client of list) {
        if (client.url.includes("sala") && "focus" in client) {
          return client.focus();
        }
      }
      // Si no, abrir nueva
      return clients.openWindow(url);
    })
  );
});
