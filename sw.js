// ============================================================
// SERVICE WORKER v2.0 — Ali Binary Options Pro
// Push Notifications via Firebase Cloud Messaging
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
const CACHE_NAME   = "ali-binary-v2";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./sala.html",
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

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = e.request.url;
  if (url.includes("firebase") || url.includes("googleapis") ||
      url.includes("gstatic") || url.includes("mixkit")) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});

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
