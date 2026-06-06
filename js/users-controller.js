// ============================================================
// USERS-CONTROLLER.JS v2.0
// ============================================================

async function getAllUsers() {
  const snap = await db.collection("users").orderBy("createdAt","desc").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function listenUsers(callback) {
  return db.collection("users").orderBy("createdAt","desc")
    .onSnapshot(snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

async function blockUser(uid) {
  const userData = await getUserDoc(uid);
  await db.collection("users").doc(uid).update({ activo: false });
  await writeAuditLog("USER_BLOCKED", { targetUid: uid, targetEmail: userData?.email });
}

async function unblockUser(uid) {
  const userData = await getUserDoc(uid);
  await db.collection("users").doc(uid).update({ activo: true });
  await writeAuditLog("USER_UNBLOCKED", { targetUid: uid, targetEmail: userData?.email });
}

async function deleteUserDoc(uid) {
  const userData = await getUserDoc(uid);

  // Intentar eliminar de Firebase Auth via Cloud Function
  // Si la función no está desplegada, solo elimina el documento Firestore
  try {
    const deleteAuthUser = firebase.functions().httpsCallable("deleteAuthUser");
    await deleteAuthUser({ uid, email: userData?.email });
    // La Cloud Function ya hace el audit log y borra Firestore
    return;
  } catch (fnErr) {
    // Cloud Function no disponible — solo borrar Firestore
    console.warn("Cloud Function no disponible, borrando solo Firestore:", fnErr.message);
  }

  // Fallback: solo borrar documento Firestore
  await db.collection("users").doc(uid).delete();
  await writeAuditLog("USER_DELETED_FIRESTORE_ONLY", {
    targetUid: uid,
    targetEmail: userData?.email,
    note: "Auth no eliminado — deploy Cloud Function para eliminación completa"
  });
}

// ── MULTI-ADMIN ────────────────────────────────────────────
async function promoteToAdmin(uid) {
  const userData = await getUserDoc(uid);
  await db.collection("users").doc(uid).update({ role: "admin" });
  await writeAuditLog("USER_PROMOTED_ADMIN", { targetUid: uid, targetEmail: userData?.email });
}

async function demoteToUser(uid) {
  const userData = await getUserDoc(uid);
  await db.collection("users").doc(uid).update({ role: "user" });
  await writeAuditLog("USER_DEMOTED_USER", { targetUid: uid, targetEmail: userData?.email });
}

// ── ESTADÍSTICAS ───────────────────────────────────────────
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
  const pct = total > 0 ? Math.round((win / total) * 100) : 0;
  return { win, loss, draw, total, pct };
}

// ── RESETEO ────────────────────────────────────────────────
async function deleteAllResults() {
  const snap = await db.collection("results").get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  await writeAuditLog("STATS_RESET", { count: snap.size });
}

async function deleteAllSignalsAndResults() {
  const [sigSnap, resSnap] = await Promise.all([
    db.collection("signals").get(),
    db.collection("results").get()
  ]);
  const total = sigSnap.size + resSnap.size;
  // Firestore batch limit = 500
  const chunks = [];
  let batch = db.batch(); let count = 0;
  const addToBatch = (doc) => {
    batch.delete(doc.ref); count++;
    if (count === 499) { chunks.push(batch); batch = db.batch(); count = 0; }
  };
  sigSnap.forEach(addToBatch);
  resSnap.forEach(addToBatch);
  if (count > 0) chunks.push(batch);
  await Promise.all(chunks.map(b => b.commit()));
  await writeAuditLog("FULL_RESET", { signalsDeleted: sigSnap.size, resultsDeleted: resSnap.size });
}

// ── AUDIT LOGS ─────────────────────────────────────────────
async function getAuditLogs(limit = 50) {
  const snap = await db.collection("audit_logs")
    .orderBy("timestamp", "desc").limit(limit).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
