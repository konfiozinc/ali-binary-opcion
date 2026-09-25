// ============================================================
// ALÍ BINARY OPTIONS PRO — Cloud Functions
// 1) postSignal  : recibe la señal del scanner (AppALI) y la publica
//    en Firestore + envía push FCM a los usuarios activos.
// 2) deleteAuthUser : elimina usuario de Auth + Firestore (admin).
// ============================================================
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Email del SuperAdmin. Debe coincidir con firebase.rules (isSuperAdmin)
// y con window.SUPER_ADMIN_EMAIL (js/firebase-config.js).
const SUPER_ADMIN_EMAIL = "damoatrader1015@gmail.com";

// Anti-spam en postSignal: una señal cada 10 segundos.
const SIGNAL_COOLDOWN_MS = 10000;

// Secreto compartido scanner <-> función (functions/.env).
// Fail-closed: si no está configurado, NO se aceptan señales.
const SIGNAL_SECRET = process.env.APPALI_SIGNAL_SECRET;

async function isAdmin(uid) {
  const doc = await admin.firestore().collection("users").doc(uid).get();
  return doc.exists && doc.data().role === "admin";
}

// ── CUSTOM CLAIMS ──────────────────────────────────────────
// Sincroniza el claim `admin` del token con el rol en Firestore.
// Así firebase.rules puede usar request.auth.token.admin == true
// sin leer Firestore en cada operación.
exports.syncAdminClaim = functions.firestore
  .document("users/{uid}")
  .onWrite(async (change, context) => {
    const uid  = context.params.uid;
    const data = change.after.exists ? change.after.data() : null;
    const isAdminRole = data && data.role === "admin";
    try {
      await admin.auth().setCustomUserClaims(uid, isAdminRole ? { admin: true } : null);
      console.log(`[claims] ${uid} → admin=${isAdminRole}`);
    } catch (e) {
      console.warn("syncAdminClaim error:", e.message);
    }
  });

// Permite a un admin fijar/retirar el claim manualmente (opcional).
exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "No autenticado");
  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError("permission-denied", "Solo admins pueden gestionar claims");
  }
  const { uid, admin } = data || {};
  if (!uid) throw new functions.https.HttpsError("invalid-argument", "Se requiere uid");
  await admin.auth().setCustomUserClaims(uid, admin ? { admin: true } : null);
  return { success: true, uid, admin: !!admin };
});

// ============================================================
// 1) postSignal (HTTP) — publica una señal del scanner
// ============================================================
exports.postSignal = functions.https.onRequest(async (req, res) => {
  // CORS básico
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "use POST" }); return; }

  const data = req.body || {};
  if (!SIGNAL_SECRET || data.secret !== SIGNAL_SECRET) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  // Validación mínima
  if (!data.asset || !data.direction || (data.direction !== "CALL" && data.direction !== "PUT")) {
    res.status(400).json({ ok: false, error: "asset y direction (CALL/PUT) son obligatorios" });
    return;
  }

  try {
    // Anti-spam: máximo 1 señal cada SIGNAL_COOLDOWN_MS
    const recent = await admin.firestore()
      .collection("signals")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    if (!recent.empty) {
      const last = recent.docs[0].data().createdAt;
      if (last && last.toMillis && (Date.now() - last.toMillis()) < SIGNAL_COOLDOWN_MS) {
        res.status(429).json({ ok: false, error: "rate_limited", retryInMs: SIGNAL_COOLDOWN_MS });
        return;
      }
    }

    const signal = {
      asset: data.asset,
      broker: data.broker || "IQ Option",
      direction: data.direction,
      entryTime: data.entryTime || null,          // "HH:MM" hora COT
      expiration: parseInt(data.expiration, 10) || 1,
      status: "pending",
      source: "bot",
      botName: data.botName || "AppALI",
      strategy: data.strategy || "GSR",
      confidence: data.confidence ?? null,
      rsi: data.rsi ?? null,
      damoa: data.damoa ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const ref = await admin.firestore().collection("signals").add(signal);

    // ── Push FCM a usuarios activos con token ──
    const usersSnap = await admin.firestore()
      .collection("users")
      .where("activo", "==", true)
      .get();
    const tokens = [];
    usersSnap.forEach(d => { const t = d.data().fcmToken; if (t) tokens.push(t); });

    if (tokens.length) {
      const msg = {
        notification: {
          title: "📡 Nueva señal — Alí Binary",
          body: `${signal.asset} ${signal.direction} · Entrada ${signal.entryTime || "ya"}`
        },
        data: { url: "./sala.html", asset: signal.asset, direction: signal.direction },
        android: { priority: "high" },
        webpush: { headers: { TTL: "60" } }
      };
      try {
        const r = await admin.messaging().sendEachForMulticast({ tokens, ...msg });
        console.log(`FCM enviado a ${r.successCount}/${tokens.length} dispositivos`);
      } catch (e) {
        console.warn("FCM send error:", e.message);
      }
    }

    await admin.firestore().collection("audit_logs").add({
      action: "BOT_SIGNAL_CREATED",
      details: { signalId: ref.id, asset: signal.asset, direction: signal.direction },
      uid: "system", email: "scanner", timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ ok: true, id: ref.id });
  } catch (e) {
    console.error("postSignal error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ============================================================
// 2) deleteAuthUser (callable) — borra Auth + Firestore
// ============================================================
exports.deleteAuthUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "No autenticado");
  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError("permission-denied", "Solo admins pueden eliminar usuarios");
  }
  const { uid, email } = data || {};
  if (!uid) throw new functions.https.HttpsError("invalid-argument", "Se requiere uid");
  if (email === SUPER_ADMIN_EMAIL) {
    throw new functions.https.HttpsError("permission-denied", "No puedes eliminar al SuperAdmin");
  }
  try {
    await admin.auth().deleteUser(uid);
    await admin.firestore().collection("users").doc(uid).delete();
    await admin.firestore().collection("audit_logs").add({
      action: "USER_AUTH_DELETED",
      details: { targetUid: uid, targetEmail: email || "unknown" },
      uid: context.auth.uid, email: context.auth.token.email || "admin",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: `Usuario ${uid} eliminado` };
  } catch (err) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});

// ============================================================
// GSR LOGIN (App GSR) — migración del backend PHP a Functions
//   · verificarLogin  : valida trader_id + nombre, rate limit y licencia.
//   · validarSesion   : valida el session_token emitido por verificarLogin.
//   · importarCuentas : importa cuentas IQ Option a Firestore (secreto).
//
// Colecciones Firestore:
//   · cuentas/{trader_id}      → cuenta IQ Option registrada
//   · sesiones/{token}         → sesión activa emitida por el login
//   · rate_limits/login_<ip>   → contador anti fuerza-bruta
// ============================================================
const crypto = require("crypto");

const GSR_CORS_ORIGIN = process.env.GSR_CORS_ORIGIN || "*";
const GSR_IMPORT_SECRET = process.env.GSR_IMPORT_SECRET;
const LOGIN_MAX_INTENTOS = 10;
const LOGIN_WINDOW_MS = 60 * 1000;

function setCors(res) {
  res.set("Access-Control-Allow-Origin", GSR_CORS_ORIGIN);
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

// Lee el body tanto si Functions ya lo parseó como si viene crudo.
function getBody(req) {
  if (req.body && typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return (req.body && typeof req.body === "object") ? req.body : {};
}

// Convierte un valor de fecha (Timestamp/Date/string) a milisegundos.
function toMillis(v) {
  if (!v) return null;
  if (typeof v.toMillis === "function") return v.toMillis();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.getTime();
}

// Días de licencia restantes (entero >= 0).
function calcularDiasRestantes(licenciaHasta) {
  const ms = toMillis(licenciaHasta);
  if (!ms) return 0;
  return Math.max(0, Math.ceil((ms - Date.now()) / (24 * 3600 * 1000)));
}

// Rate limiting por IP usando Firestore (ventana fija de 60s).
async function isRateLimited(ip) {
  const ref = admin.firestore().collection("rate_limits").doc("login_" + ip);
  const now = Date.now();
  try {
    return await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : null;
      if (!data || now > data.resetAt) {
        tx.set(ref, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
        return false;
      }
      if (data.count >= LOGIN_MAX_INTENTOS) return true;
      tx.update(ref, { count: data.count + 1 });
      return false;
    });
  } catch (e) {
    console.warn("isRateLimited error:", e.message);
    return false; // fail-open ante fallo transitorio para no bloquear a usuarios legítimos
  }
}

// ── verificarLogin ─────────────────────────────────────────
exports.verificarLogin = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST") { res.status(405).json({ existe: false, error: "use POST" }); return; }

  const data = getBody(req);
  const traderId = String(data.trader_id || "").trim();
  const nombre = String(data.nombre || "").trim().split(/\s+/)[0];
  const recordar = data.recordar === true || data.recordar === "1" || data.recordar === 1;
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "unknown";

  if (await isRateLimited(ip)) {
    return res.status(200).json({ existe: false, codigo_error: "bloqueado_ip" });
  }

  // Validación servidor: trader_id = 9 dígitos
  if (!/^\d{9}$/.test(traderId)) {
    return res.status(200).json({ existe: false, error: "formato" });
  }
  // Validación servidor: nombre entre 2 y 50 caracteres
  if (nombre.length < 2 || nombre.length > 50) {
    return res.status(200).json({ existe: false, error: "nombre" });
  }

  try {
    const snap = await admin.firestore().collection("cuentas").doc(traderId).get();
    if (!snap.exists) {
      return res.status(200).json({ existe: false });
    }
    const cuenta = snap.data();

    if (cuenta.activo === false) {
      return res.status(200).json({ existe: false, codigo_error: "sin_acceso" });
    }

    const licenciaDias = calcularDiasRestantes(cuenta.licencia_hasta);
    const accesoTemporal = cuenta.acceso_temporal === true && licenciaDias === 0;

    if (licenciaDias === 0 && !accesoTemporal) {
      return res.status(200).json({ existe: false, codigo_error: "prueba_usada" });
    }

    // Emitir sesión
    const token = crypto.randomBytes(32).toString("hex");
    const expiraMs = recordar ? 30 * 24 * 3600 * 1000 : 24 * 3600 * 1000;
    await admin.firestore().collection("sesiones").doc(token).set({
      trader_id: traderId,
      nombre: nombre,
      recordar: recordar,
      ip: ip,
      es_pwa: data.es_pwa || "0",
      event_id: data.event_id || "",
      fbc: data.fbc || "",
      fbp: data.fbp || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expira: new Date(Date.now() + expiraMs)
    });

    return res.status(200).json({
      existe: true,
      licencia_dias: licenciaDias,
      ip: ip,
      session_token: token,
      acceso_temporal: accesoTemporal
    });
  } catch (e) {
    console.error("verificarLogin error:", e);
    return res.status(500).json({ existe: false, error: "server_error" });
  }
});

// ── validarSesion ──────────────────────────────────────────
exports.validarSesion = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST") { res.status(405).json({ valido: false }); return; }

  const data = getBody(req);
  const token = String(data.token || "").trim();

  if (!token || token.length < 32) {
    return res.status(200).json({ valido: false });
  }

  try {
    const snap = await admin.firestore().collection("sesiones").doc(token).get();
    if (!snap.exists) return res.status(200).json({ valido: false });

    const s = snap.data();
    if (toMillis(s.expira) && toMillis(s.expira) < Date.now()) {
      return res.status(200).json({ valido: false });
    }

    // Revalidar la cuenta por si la licencia venció o la desactivaron.
    const cuentaSnap = await admin.firestore().collection("cuentas").doc(s.trader_id).get();
    if (!cuentaSnap.exists || cuentaSnap.data().activo === false) {
      return res.status(200).json({ valido: false });
    }

    const licenciaDias = calcularDiasRestantes(cuentaSnap.data().licencia_hasta);
    const accesoTemporal = cuentaSnap.data().acceso_temporal === true && licenciaDias === 0;
    if (licenciaDias === 0 && !accesoTemporal) {
      return res.status(200).json({ valido: false });
    }

    return res.status(200).json({
      valido: true,
      trader_id: s.trader_id,
      nombre: s.nombre,
      licencia_dias: licenciaDias
    });
  } catch (e) {
    console.error("validarSesion error:", e);
    return res.status(200).json({ valido: false });
  }
});

// ── importarCuentas (HTTP + secreto) ───────────────────────
exports.importarCuentas = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "use POST" }); return; }

  if (!GSR_IMPORT_SECRET) {
    return res.status(503).json({ ok: false, error: "GSR_IMPORT_SECRET no configurado" });
  }

  const data = getBody(req);
  if (data.secret !== GSR_IMPORT_SECRET) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const cuentas = Array.isArray(data.cuentas) ? data.cuentas : [];
  const preparadas = [];
  for (const c of cuentas) {
    const tid = String(c.trader_id || "").trim();
    if (!/^\d{9}$/.test(tid)) continue;
    const doc = {
      trader_id: tid,
      nombre: String(c.nombre || "").trim(),
      activo: c.activo !== false,
      acceso_temporal: c.acceso_temporal === true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (c.licencia_hasta) {
      doc.licencia_hasta = new Date(c.licencia_hasta);
    } else if (Number(c.licencia_dias) > 0) {
      doc.licencia_hasta = new Date(Date.now() + Number(c.licencia_dias) * 24 * 3600 * 1000);
    }
    preparadas.push({ tid, doc });
  }

  if (!preparadas.length) {
    return res.status(400).json({ ok: false, error: "cuentas[] vacío o sin trader_id válido" });
  }

  const CHUNK = 400;
  for (let i = 0; i < preparadas.length; i += CHUNK) {
    const batch = admin.firestore().batch();
    preparadas.slice(i, i + CHUNK).forEach(({ tid, doc }) => {
      batch.set(admin.firestore().collection("cuentas").doc(tid), doc, { merge: true });
    });
    await batch.commit();
  }

  return res.status(200).json({ ok: true, importadas: preparadas.length });
});
