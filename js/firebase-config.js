// ============================================================
// FIREBASE CONFIG — ALÍ BINARY OPTIONS PRO v2.0
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDRfZYY3d4ul1PJEp-KMHMYfbkT6QULk3U",
  authDomain: "ali-binary-options.firebaseapp.com",
  databaseURL: "https://ali-binary-options-default-rtdb.firebaseio.com",
  projectId: "ali-binary-options",
  storageBucket: "ali-binary-options.firebasestorage.app",
  messagingSenderId: "215991454083",
  appId: "1:215991454083:web:97423f29d542dcfc74ceb6",
  measurementId: "G-CDXNMWGHJD"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

// Habilitar persistencia offline
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// ── AUDIT LOG ───────────────────────────────────────────────
async function writeAuditLog(action, details = {}) {
  try {
    const user = auth.currentUser;
    await db.collection("audit_logs").add({
      action,
      details,
      uid:       user ? user.uid   : "system",
      email:     user ? user.email : "system",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent.substring(0, 120)
    });
  } catch(e) { console.warn("Audit log error:", e); }
}

// ── FIREBASE CLOUD MESSAGING (FCM) ──────────────────────────
// VAPID key pública — obtener en Firebase Console →
// Project Settings → Cloud Messaging → Web Push certificates
const FCM_VAPID_KEY = "TU_VAPID_KEY_AQUI"; // ← reemplazar

let fcmMessaging = null;

async function initFCM() {
  try {
    // Solo inicializar si el navegador soporta notificaciones
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    fcmMessaging = firebase.messaging();

    // Solicitar permiso de notificaciones
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("FCM: permiso denegado");
      return;
    }

    // Obtener token FCM del dispositivo
    const swReg = await navigator.serviceWorker.ready;
    const token = await fcmMessaging.getToken({
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (token) {
      await saveFCMToken(token);
      console.log("FCM token guardado:", token.substring(0, 20) + "...");
    }

    // Escuchar mensajes cuando la app está en primer plano
    fcmMessaging.onMessage(payload => {
      const { title, body } = payload.notification || {};
      // Mostrar notificación nativa aunque la app esté abierta
      if (swReg.showNotification) {
        swReg.showNotification(title || "📡 Nueva Señal", {
          body:    body || "Nueva señal disponible",
          icon:    "./assets/icon-192.png",
          badge:   "./assets/icon-192.png",
          vibrate: [300, 100, 300],
          tag:     "ali-signal",
          requireInteraction: true,
          data:    { url: "./sala.html" }
        });
      }
    });

  } catch(e) {
    console.warn("FCM init error:", e.message);
  }
}

// Guardar/actualizar token FCM del usuario en Firestore
async function saveFCMToken(token) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await db.collection("users").doc(user.uid).update({
      fcmToken: token,
      fcmUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      fcmDevice: navigator.userAgent.substring(0, 80)
    });
  } catch(e) {
    // Si el documento no existe aún, ignorar
    console.warn("saveFCMToken:", e.message);
  }
}

// Obtener todos los tokens FCM activos (para enviar push masivo)
async function getAllFCMTokens() {
  const snap = await db.collection("users")
    .where("activo", "==", true)
    .get();
  const tokens = [];
  snap.forEach(doc => {
    const t = doc.data().fcmToken;
    if (t) tokens.push(t);
  });
  return tokens;
}

// ── MODO MANTENIMIENTO ───────────────────────────────────────
async function checkMaintenance() {
  try {
    const snap = await db.collection("settings").doc("app").get();
    if (snap.exists && snap.data().maintenance === true) {
      const user = auth.currentUser;
      // SuperAdmin puede pasar siempre
      if (user && user.email === "damoatrader1015@gmail.com") return false;
      return true; // mostrar pantalla de mantenimiento
    }
    return false;
  } catch(e) { return false; }
}

async function setMaintenance(enabled) {
  await db.collection("settings").doc("app").set(
    { maintenance: enabled, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  await writeAuditLog("MAINTENANCE_" + (enabled ? "ON" : "OFF"), {});
}
