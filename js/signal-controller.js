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
