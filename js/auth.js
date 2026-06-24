// Admin email — debe coincidir con SUPER_ADMIN en roles.js
const ADMIN_EMAIL = "damoa1510qtrading@gmail.com";

// ============================================================
// AUTH.JS — Autenticación Firebase
// ============================================================

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
    // Validar dominio de email real (bloquear dominios falsos)
    const blockedDomains = ["d.com", "test.com", "fake.com", "example.com", "mailinator.com", "tempmail.com", "guerrillamail.com", "yopmail.com"];
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain || blockedDomains.includes(domain)) {
      return { success: false, error: "Usa un correo real para registrarte." };
    }

    // Validar que el dominio tenga al menos un punto con extensión válida
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
      return { success: false, error: "El correo no parece válido. Usa un correo real." };
    }

    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid  = cred.user.uid;
    const role = email === ADMIN_EMAIL ? "admin" : "user";

    // Guardar en Firestore
    await db.collection("users").doc(uid).set({
      uid,
      nombre,
      email,
      role,
      activo: true,
      emailVerified: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Enviar email de verificación
    try {
      await cred.user.sendEmailVerification();
    } catch(e) {
      console.warn("[Auth] No se pudo enviar verificación:", e.message);
    }

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
    "auth/user-not-found":         "Usuario no encontrado.",
    "auth/wrong-password":         "Contraseña incorrecta.",
    "auth/invalid-email":          "Email inválido.",
    "auth/email-already-in-use":   "Este email ya está registrado.",
    "auth/weak-password":          "La contraseña debe tener al menos 6 caracteres.",
    "auth/too-many-requests":      "Demasiados intentos. Intenta más tarde.",
    "auth/network-request-failed": "Error de red. Verifica tu conexión.",
    "auth/invalid-credential":     "Credenciales incorrectas. Verifica tu email y contraseña.",
    "auth/invalid-login-credentials": "Credenciales incorrectas. Verifica tu email y contraseña."
  };
  return errors[code] || "Error desconocido: " + code;
}
