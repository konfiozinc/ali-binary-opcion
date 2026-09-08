// ============================================================
// ALÍ BINARY OPTIONS PRO — Cloud Functions
// 1) postSignal  : recibe la señal del scanner (AppALI) y la publica
//    en Firestore + envía push FCM a los usuarios activos.
// 2) deleteAuthUser : elimina usuario de Auth + Firestore (admin).
// ============================================================
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Secreto compartido scanner <-> función. Se configura por entorno:
//   firebase functions:config:set appali.signal_secret="UN_SECRETO_LARGO"
const SIGNAL_SECRET = functions.config().appali?.signal_secret || "CAMBIA_ESTE_SECRETO";

async function isAdmin(uid) {
  const doc = await admin.firestore().collection("users").doc(uid).get();
  return doc.exists && doc.data().role === "admin";
}

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
  if (data.secret !== SIGNAL_SECRET) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  // Validación mínima
  if (!data.asset || !data.direction || (data.direction !== "CALL" && data.direction !== "PUT")) {
    res.status(400).json({ ok: false, error: "asset y direction (CALL/PUT) son obligatorios" });
    return;
  }

  try {
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
  if (email === "damoatrader1015@gmail.com") {
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
