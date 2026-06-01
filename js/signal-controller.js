// ============================================================
// SIGNAL-CONTROLLER.JS — CRUD de señales
// ============================================================

// Crear señal
async function createSignal(data) {
  const signal = {
    asset:      data.asset,
    broker:     data.broker,
    direction:  data.direction,   // "CALL" | "PUT"
    entryTime:  data.entryTime,
    expiration: data.expiration,
    status:     "pending",        // pending | win | loss | draw
    createdAt:  firebase.firestore.FieldValue.serverTimestamp()
  };
  const ref = await db.collection("signals").add(signal);
  return ref.id;
}

// Actualizar señal (editar campos)
async function updateSignal(id, data) {
  await db.collection("signals").doc(id).update(data);
}

// Eliminar señal
async function deleteSignal(id) {
  await db.collection("signals").doc(id).delete();
}

// Marcar resultado
async function setSignalResult(signalId, result) {
  // result: "win" | "loss" | "draw"
  await db.collection("signals").doc(signalId).update({ status: result });
  await db.collection("results").add({
    signalId,
    result,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Escuchar señales en tiempo real (últimas 20)
function listenSignals(callback) {
  return db.collection("signals")
    .orderBy("createdAt", "desc")
    .limit(20)
    .onSnapshot(snap => {
      const signals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(signals);
    });
}

// Obtener señal por ID
async function getSignal(id) {
  const snap = await db.collection("signals").doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

// Escuchar señales activas (status=pending) — para sala
function listenActiveSignals(callback) {
  return db.collection("signals")
    .where("status", "==", "pending")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      const signals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(signals);
    });
}
