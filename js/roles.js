// ============================================================
// ROLES.JS — Gestión de roles y redirección
// ============================================================

const ADMIN_EMAIL = "damoatrader1015@gmail.com";

// Obtener documento del usuario desde Firestore
async function getUserDoc(uid) {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return snap.data();
}

// Redirigir según rol
async function redirectByRole(user) {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // Admin check por email (fallback rápido)
  if (user.email === ADMIN_EMAIL) {
    window.location.href = "admin.html";
    return;
  }

  // Verificar Firestore para role persistido
  try {
    const userData = await getUserDoc(user.uid);
    if (!userData) {
      // Usuario nuevo sin doc, crear doc user
      await db.collection("users").doc(user.uid).set({
        uid: user.uid,
        nombre: user.displayName || user.email.split("@")[0],
        email: user.email,
        role: "user",
        activo: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      window.location.href = "sala.html";
      return;
    }

    if (!userData.activo) {
      await auth.signOut();
      showAuthError("Tu cuenta ha sido bloqueada por el administrador.");
      return;
    }

    if (userData.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "sala.html";
    }
  } catch (e) {
    console.error("Error obteniendo rol:", e);
    window.location.href = "sala.html";
  }
}

// Proteger página admin — llamar al inicio de admin.html
async function requireAdmin() {
  return new Promise((resolve, reject) => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      unsub();
      if (!user) { window.location.href = "index.html"; return; }
      const userData = await getUserDoc(user.uid);
      if (!userData || userData.role !== "admin") {
        window.location.href = "sala.html";
        return;
      }
      resolve(userData);
    });
  });
}

// Proteger página sala — llamar al inicio de sala.html
async function requireAuth() {
  return new Promise((resolve, reject) => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      unsub();
      if (!user) { window.location.href = "index.html"; return; }
      const userData = await getUserDoc(user.uid);
      if (!userData || !userData.activo) {
        await auth.signOut();
        window.location.href = "index.html";
        return;
      }
      resolve(userData);
    });
  });
}

function showAuthError(msg) {
  const el = document.getElementById("auth-error");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}
