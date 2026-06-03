// ============================================================
// ROLES.JS v2.0 — Multi-admin por Firestore role='admin'
// ============================================================

const SUPER_ADMIN = "damoatrader1015@gmail.com";

async function getUserDoc(uid) {
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? snap.data() : null;
}

function isAdminRole(userData) {
  return userData && userData.role === "admin";
}

// Redirigir según rol
async function redirectByRole(user) {
  if (!user) { window.location.href = "index.html"; return; }
  try {
    let userData = await getUserDoc(user.uid);
    if (!userData) {
      const role = user.email === SUPER_ADMIN ? "admin" : "user";
      userData = {
        uid: user.uid, nombre: user.displayName || user.email.split("@")[0],
        email: user.email, role, activo: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection("users").doc(user.uid).set(userData);
      await writeAuditLog("USER_REGISTERED", { email: user.email, role });
    }
    if (!userData.activo) {
      await auth.signOut();
      showAuthError("Tu cuenta ha sido bloqueada por el administrador.");
      return;
    }
    await writeAuditLog("USER_LOGIN", { email: user.email, role: userData.role });
    window.location.href = isAdminRole(userData) ? "admin.html" : "sala.html";
  } catch(e) {
    console.error("redirectByRole error:", e);
    window.location.href = user.email === SUPER_ADMIN ? "admin.html" : "sala.html";
  }
}

// Proteger admin.html
async function requireAdmin() {
  return new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      unsub();
      if (!user) { window.location.href = "index.html"; return; }
      try {
        const userData = await getUserDoc(user.uid);
        if (!userData || !userData.activo) { await auth.signOut(); window.location.href = "index.html"; return; }
        if (!isAdminRole(userData)) { window.location.href = "sala.html"; return; }
        resolve(userData);
      } catch(e) {
        if (user.email === SUPER_ADMIN) resolve({ nombre: "Admin", email: user.email, role: "admin", activo: true });
        else window.location.href = "sala.html";
      }
    });
  });
}

// Proteger sala.html
async function requireAuth() {
  return new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      unsub();
      if (!user) { window.location.href = "index.html"; return; }
      try {
        const userData = await getUserDoc(user.uid);
        if (!userData || !userData.activo) { await auth.signOut(); window.location.href = "index.html"; return; }
        resolve(userData);
      } catch(e) { resolve({ nombre: user.email, email: user.email, role: "user", activo: true }); }
    });
  });
}

function showAuthError(msg) {
  const el = document.getElementById("auth-error") || document.getElementById("login-error");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}
