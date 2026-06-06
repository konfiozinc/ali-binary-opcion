// ============================================================
// CLOUD FUNCTION — deleteUser
// Archivo: functions/index.js en tu proyecto Firebase
// 
// INSTRUCCIONES DE DEPLOY:
// 1. npm install -g firebase-tools
// 2. firebase login
// 3. firebase init functions (en la raíz del proyecto)
// 4. Pegar este código en functions/index.js
// 5. firebase deploy --only functions
// ============================================================

const functions  = require("firebase-functions");
const admin      = require("firebase-admin");

admin.initializeApp();

// ── FUNCIÓN: Eliminar usuario de Firebase Auth ───────────────
exports.deleteAuthUser = functions.https.onCall(async (data, context) => {
  // Verificar que quien llama es admin
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "No autenticado");
  }

  // Leer el rol del solicitante desde Firestore
  const callerDoc = await admin.firestore()
    .collection("users")
    .doc(context.auth.uid)
    .get();

  if (!callerDoc.exists || callerDoc.data().role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Solo admins pueden eliminar usuarios");
  }

  const { uid, email } = data;
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere uid");
  }

  // Proteger al superadmin
  const SUPER_ADMIN = "damoatrader1015@gmail.com";
  if (email === SUPER_ADMIN) {
    throw new functions.https.HttpsError("permission-denied", "No puedes eliminar al SuperAdmin");
  }

  try {
    // Eliminar de Firebase Auth
    await admin.auth().deleteUser(uid);

    // Eliminar documento Firestore
    await admin.firestore().collection("users").doc(uid).delete();

    // Audit log
    await admin.firestore().collection("audit_logs").add({
      action:    "USER_AUTH_DELETED",
      details:   { targetUid: uid, targetEmail: email || "unknown" },
      uid:       context.auth.uid,
      email:     context.auth.token.email || "admin",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: `Usuario ${uid} eliminado de Auth y Firestore` };
  } catch (err) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});
