// ============================================================
// SIGNAL-CONTROLLER.JS v2.0
// ============================================================

async function createSignal(data) {
  const signal = {
    asset: data.asset, broker: data.broker,
    direction: data.direction, entryTime: data.entryTime,
    expiration: data.expiration, status: "pending",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  const ref = await db.collection("signals").add(signal);
  await writeAuditLog("SIGNAL_CREATED", { signalId: ref.id, asset: data.asset, direction: data.direction });
  return ref.id;
}

async function updateSignal(id, data) {
  await db.collection("signals").doc(id).update(data);
  await writeAuditLog("SIGNAL_UPDATED", { signalId: id, ...data });
}

async function deleteSignal(id) {
  await db.collection("signals").doc(id).delete();
  await writeAuditLog("SIGNAL_DELETED", { signalId: id });
}

async function setSignalResult(signalId, result) {
  await db.collection("signals").doc(signalId).update({ status: result });
  await db.collection("results").add({
    signalId, result,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await writeAuditLog("SIGNAL_RESULT", { signalId, result });
}

function listenSignals(callback) {
  return db.collection("signals")
    .orderBy("createdAt","desc").limit(30)
    .onSnapshot(snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

async function getSignal(id) {
  const snap = await db.collection("signals").doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

function listenActiveSignals(callback) {
  return db.collection("signals")
    .where("status","==","pending")
    .orderBy("createdAt","desc")
    .onSnapshot(snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

// ── BOT IQ OPTION API ──────────────────────────────────────
// Estructura preparada para bot automático
async function createBotSignal(data) {
  const signal = {
    asset: data.asset, broker: data.broker || "IQ Option",
    direction: data.direction, entryTime: data.entryTime,
    expiration: data.expiration, status: "pending",
    source: "bot",        // identificar señales del bot
    botName: data.botName || "IQBot",
    confidence: data.confidence || null,   // % confianza del bot
    strategy: data.strategy || null,       // estrategia usada
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  const ref = await db.collection("signals").add(signal);
  await writeAuditLog("BOT_SIGNAL_CREATED", { signalId: ref.id, botName: signal.botName, asset: data.asset });
  return ref.id;
}

// Endpoint de recepción para webhook del bot
async function receiveBotWebhook(payload) {
  // payload esperado: { secret, asset, direction, entryTime, expiration, strategy, confidence }
  const BOT_SECRET = "ALI_BOT_SECRET_2026"; // cambiar por uno seguro
  if (payload.secret !== BOT_SECRET) throw new Error("Unauthorized");
  return await createBotSignal(payload);
}

// ── EXPIRACIÓN AUTOMÁTICA DE SEÑALES ────────────────────────
// Se ejecuta en background cuando cualquier usuario abre la sala
// Cierra señales "pending" cuya hora de entrada ya pasó + expiración

function parseEntryTime(entryTime) {
  // Formato esperado: "HH:MM"
  if (!entryTime) return null;
  const parts = entryTime.split(":");
  if (parts.length < 2) return null;
  const now = new Date();
  const target = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(),
    parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0
  );
  return target;
}

async function autoExpireSignals() {
  try {
    const snap = await db.collection("signals")
      .where("status", "==", "pending")
      .get();

    if (snap.empty) return;

    const now     = Date.now();
    const batch   = db.batch();
    let   expired = 0;

    snap.forEach(doc => {
      const s          = doc.data();
      const entryDate  = parseEntryTime(s.entryTime);
      if (!entryDate) return;

      // Calcular minutos de expiración (default 5 min si no hay)
      const expirationMins = parseInt(s.expiration, 10) || 5;
      // La señal expira: hora de entrada + expiración + 2 min de gracia
      const expiresAt = entryDate.getTime() + (expirationMins + 2) * 60 * 1000;

      if (now > expiresAt) {
        batch.update(doc.ref, {
          status:    "expired",
          expiredAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        expired++;
      }
    });

    if (expired > 0) {
      await batch.commit();
      console.log(`[AutoExpire] ${expired} señal(es) expirada(s) automáticamente`);
    }
  } catch(e) {
    console.warn("[AutoExpire] Error:", e.message);
  }
}

// Iniciar verificación periódica cada 2 minutos
function startAutoExpire() {
  autoExpireSignals(); // ejecutar inmediatamente
  setInterval(autoExpireSignals, 2 * 60 * 1000);
}
