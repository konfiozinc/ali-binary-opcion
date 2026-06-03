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
