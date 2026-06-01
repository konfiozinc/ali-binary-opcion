// ============================================================
// AUTH.JS — Autenticación Firebase
// ============================================================

const ADMIN_EMAIL = "damoatrader1015@gmail.com";

// ─── LOGIN ───────────────────────────────────────────────────
async function loginUser(email, password) {
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return { success: true, user: cred.user };
  } catch (err) {
    return { success: false, error: translateFirebaseError(err.code) };
  }
}

// ─── REGISTRO ────────────────────────────────────────────────
async function registerUser(email, password, nombre) {
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid  = cred.user.uid;
    const role = email === ADMIN_EMAIL ? "admin" : "user";

    await db.collection("users").doc(uid).set({
      uid,
      nombre,
      email,
      role,
      activo: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, user: cred.user };
  } catch (err) {
    return { success: false, error: translateFirebaseError(err.code) };
  }
}

// ─── LOGOUT ──────────────────────────────────────────────────
async function logoutUser() {
  await auth.signOut();
  window.location.href = "index.html";
}

// ─── RECUPERAR CONTRASEÑA ─────────────────────────────────────
async function resetPassword(email) {
  try {
    await auth.sendPasswordResetEmail(email);
    return { success: true };
  } catch (err) {
    return { success: false, error: translateFirebaseError(err.code) };
  }
}

// ─── OBSERVER DE SESIÓN ──────────────────────────────────────
function onAuthStateChange(callback) {
  return auth.onAuthStateChanged(callback);
}

// ─── TRADUCIR ERRORES ─────────────────────────────────────────
function translateFirebaseError(code) {
  const errors = {
    "auth/user-not-found":       "Usuario no encontrado.",
    "auth/wrong-password":       "Contraseña incorrecta.",
    "auth/invalid-email":        "Email inválido.",
    "auth/email-already-in-use": "Este email ya está registrado.",
    "auth/weak-password":        "La contraseña debe tener al menos 6 caracteres.",
    "auth/too-many-requests":    "Demasiados intentos. Intenta más tarde.",
    "auth/network-request-failed": "Error de red. Verifica tu conexión.",
    "auth/invalid-credential":   "Credenciales incorrectas. Verifica tu email y contraseña."
  };
  return errors[code] || "Error desconocido: " + code;
}
