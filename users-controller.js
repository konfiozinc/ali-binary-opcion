// ============================================================
// USERS-CONTROLLER.JS — Gestión de usuarios (Admin)
// ============================================================

// Obtener todos los usuarios
async function getAllUsers() {
  const snap = await db.collection("users").orderBy("createdAt", "desc").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Escuchar usuarios en tiempo real
function listenUsers(callback) {
  return db.collection("users")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(users);
    });
}

// Bloquear usuario
async function blockUser(uid) {
  await db.collection("users").doc(uid).update({ activo: false });
}

// Desbloquear usuario
async function unblockUser(uid) {
  await db.collection("users").doc(uid).update({ activo: true });
}

// Eliminar usuario de Firestore (no elimina del Auth)
async function deleteUserDoc(uid) {
  await db.collection("users").doc(uid).delete();
}

// Estadísticas de señales
async function getSignalStats() {
  const snap = await db.collection("results").get();
  let win = 0, loss = 0, draw = 0;
  snap.forEach(d => {
    const r = d.data().result;
    if (r === "win")  win++;
    if (r === "loss") loss++;
    if (r === "draw") draw++;
  });
  const total = win + loss + draw;
  const pct   = total > 0 ? Math.round((win / total) * 100) : 0;
  return { win, loss, draw, total, pct };
}
