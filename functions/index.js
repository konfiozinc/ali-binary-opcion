// ============================================================
// ALÍ BINARY OPTIONS PRO — Cloud Functions
// 1) postSignal  : recibe la señal del scanner (AppALI) y la publica
//    en Firestore + envía push FCM a los usuarios activos.
// 2) deleteAuthUser : elimina usuario de Auth + Firestore (admin).
// ============================================================
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Email del SuperAdmin. Debe coincidir con firebase.rules (isSuperAdmin)
// y con window.SUPER_ADMIN_EMAIL (js/firebase-config.js).
const SUPER_ADMIN_EMAIL = "damoatrader1015@gmail.com";

// Anti-spam en postSignal: una señal cada 10 segundos.
const SIGNAL_COOLDOWN_MS = 10000;

// Secreto compartido scanner <-> función (functions/.env).
// Fail-closed: si no está configurado, NO se aceptan señales.
const SIGNAL_SECRET = process.env.APPALI_SIGNAL_SECRET;

async function isAdmin(uid) {
  const doc = await admin.firestore().collection("users").doc(uid).get();
  return doc.exists && doc.data().role === "admin";
}

// ── CUSTOM CLAIMS ──────────────────────────────────────────
// Sincroniza el claim `admin` del token con el rol en Firestore.
// Así firebase.rules puede usar request.auth.token.admin == true
// sin leer Firestore en cada operación.
exports.syncAdminClaim = functions.firestore
  .document("users/{uid}")
  .onWrite(async (change, context) => {
    const uid  = context.params.uid;
    const data = change.after.exists ? change.after.data() : null;
    const isAdminRole = data && data.role === "admin";
    try {
      await admin.auth().setCustomUserClaims(uid, isAdminRole ? { admin: true } : null);
      console.log(`[claims] ${uid} → admin=${isAdminRole}`);
    } catch (e) {
      console.warn("syncAdminClaim error:", e.message);
    }
  });

// Permite a un admin fijar/retirar el claim manualmente (opcional).
exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "No autenticado");
  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError("permission-denied", "Solo admins pueden gestionar claims");
  }
  const { uid, admin } = data || {};
  if (!uid) throw new functions.https.HttpsError("invalid-argument", "Se requiere uid");
  await admin.auth().setCustomUserClaims(uid, admin ? { admin: true } : null);
  return { success: true, uid, admin: !!admin };
});

// ============================================================
// 1) postSignal (HTTP) — publica una señal del scanner
// ============================================================
exports.postSignal = functions.https.onRequest(async (req, res) => {
  // CORS básico
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "use POST" }); return; }

  const data = req.body || {};
  if (!SIGNAL_SECRET || data.secret !== SIGNAL_SECRET) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  // Validación mínima
  if (!data.asset || !data.direction || (data.direction !== "CALL" && data.direction !== "PUT")) {
    res.status(400).json({ ok: false, error: "asset y direction (CALL/PUT) son obligatorios" });
    return;
  }

  try {
    // Anti-spam: máximo 1 señal cada SIGNAL_COOLDOWN_MS
    const recent = await admin.firestore()
      .collection("signals")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    if (!recent.empty) {
      const last = recent.docs[0].data().createdAt;
      if (last && last.toMillis && (Date.now() - last.toMillis()) < SIGNAL_COOLDOWN_MS) {
        res.status(429).json({ ok: false, error: "rate_limited", retryInMs: SIGNAL_COOLDOWN_MS });
        return;
      }
    }

    const signal = {
      asset: data.asset,
      broker: data.broker || "IQ Option",
      direction: data.direction,
      entryTime: data.entryTime || null,          // "HH:MM" hora COT
      expiration: parseInt(data.expiration, 10) || 1,
      status: "pending",
      source: "bot",
      botName: data.botName || "AppALI",
      strategy: data.strategy || "GSR",
      confidence: data.confidence ?? null,
      rsi: data.rsi ?? null,
      damoa: data.damoa ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const ref = await admin.firestore().collection("signals").add(signal);

    // ── Push FCM a usuarios activos con token ──
    const usersSnap = await admin.firestore()
      .collection("users")
      .where("activo", "==", true)
      .get();
    const tokens = [];
    usersSnap.forEach(d => { const t = d.data().fcmToken; if (t) tokens.push(t); });

    if (tokens.length) {
      const msg = {
        notification: {
          title: "📡 Nueva señal — Alí Binary",
          body: `${signal.asset} ${signal.direction} · Entrada ${signal.entryTime || "ya"}`
        },
        data: { url: "./sala.html", asset: signal.asset, direction: signal.direction },
        android: { priority: "high" },
        webpush: { headers: { TTL: "60" } }
      };
      try {
        const r = await admin.messaging().sendEachForMulticast({ tokens, ...msg });
        console.log(`FCM enviado a ${r.successCount}/${tokens.length} dispositivos`);
      } catch (e) {
        console.warn("FCM send error:", e.message);
      }
    }

    await admin.firestore().collection("audit_logs").add({
      action: "BOT_SIGNAL_CREATED",
      details: { signalId: ref.id, asset: signal.asset, direction: signal.direction },
      uid: "system", email: "scanner", timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ ok: true, id: ref.id });
  } catch (e) {
    console.error("postSignal error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ============================================================
// 2) deleteAuthUser (callable) — borra Auth + Firestore
// ============================================================
exports.deleteAuthUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "No autenticado");
  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError("permission-denied", "Solo admins pueden eliminar usuarios");
  }
  const { uid, email } = data || {};
  if (!uid) throw new functions.https.HttpsError("invalid-argument", "Se requiere uid");
  if (email === SUPER_ADMIN_EMAIL) {
    throw new functions.https.HttpsError("permission-denied", "No puedes eliminar al SuperAdmin");
  }
  try {
    await admin.auth().deleteUser(uid);
    await admin.firestore().collection("users").doc(uid).delete();
    await admin.firestore().collection("audit_logs").add({
      action: "USER_AUTH_DELETED",
      details: { targetUid: uid, targetEmail: email || "unknown" },
      uid: context.auth.uid, email: context.auth.token.email || "admin",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: `Usuario ${uid} eliminado` };
  } catch (err) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});
