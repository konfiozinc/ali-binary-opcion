// ============================================================
// ADMIN-CONTROLLER.JS v2.0 — Panel completo
// ============================================================

let currentSignalId  = null;
let unsubSignals     = null;
let unsubUsers       = null;
let currentAdminUser = null;

// ── INIT ─────────────────────────────────────────────────
async function initAdmin() {
  currentAdminUser = await requireAdmin();
  document.getElementById("admin-name").textContent = currentAdminUser.nombre || "Admin";
  showTab("signals");
}

// ── TABS ──────────────────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("active");
  document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
  if (tab === "signals")   startSignalListener();
  if (tab === "users")     startUsersListener();
  if (tab === "stats")     loadStats();
  if (tab === "audit")     loadAuditLogs();
  if (tab === "dashboard") loadDashboard();
  if (tab === "bot")       loadBotPanel();
}

// ── SEÑALES ───────────────────────────────────────────────
function startSignalListener() {
  if (unsubSignals) unsubSignals();
  unsubSignals = listenSignals(renderSignals);
}

function renderSignals(signals) {
  const tbody = document.getElementById("signals-table-body");
  if (!signals.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Sin señales aún</td></tr>`; return;
  }
  tbody.innerHTML = signals.map(s => {
    const isCall = s.direction === "CALL";
    const dir    = `<span class="badge ${isCall?'call':'put'}">${isCall?'▲ CALL':'▼ PUT'}</span>`;
    const status = statusBadge(s.status);
    const botTag = s.source === "bot" ? `<span style="font-size:10px;color:#ffc800">🤖</span>` : "";
    return `<tr>
      <td>${s.asset} ${botTag}</td>
      <td>${s.broker}</td>
      <td>${dir}</td>
      <td><strong style="color:var(--accent);font-size:15px">${s.entryTime || "—"}</strong></td>
      <td>${s.expiration} min</td>
      <td>${status}</td>
      <td class="actions">
        <button class="btn-icon" onclick="openEditModal('${s.id}')" title="Editar" style="background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.4)">✏️</button>
        <button onclick="markResult('${s.id}','win')"  class="btn-result win-btn">✅ WIN</button>
        <button onclick="markResult('${s.id}','loss')" class="btn-result loss-btn">❌ LOSS</button>
        <button onclick="markResult('${s.id}','draw')" class="btn-result draw-btn">➖ DOJI</button>
        <button class="btn-icon" onclick="confirmDelete('${s.id}')" title="Eliminar" style="background:rgba(255,51,102,0.1);border:1px solid rgba(255,51,102,0.3)">🗑️</button>
      </td>
    </tr>`;
  }).join("");
}

function statusBadge(status) {
  const map = {
    pending: `<span class="badge pending">⏳ Pendiente</span>`,
    win:     `<span class="badge win-b">✅ WIN</span>`,
    loss:    `<span class="badge loss-b">❌ LOSS</span>`,
    draw:    `<span class="badge draw-b">➖ DOJI</span>`
  };
  return map[status] || status;
}

async function submitSignal() {
  const btn = document.getElementById("btn-create-signal");
  const asset    = document.getElementById("sig-asset").value || document.getElementById("sig-asset-input")?.value;
  const broker   = document.getElementById("sig-broker").value;
  const direction= document.getElementById("sig-direction").value;
  const mm       = String(document.getElementById("sig-entry-min").value || "0").padStart(2,"0");
  const ss       = String(document.getElementById("sig-entry-sec").value || "0").padStart(2,"0");
  const entryTime= mm + ":" + ss;
  const expiration= document.getElementById("sig-expiry").value;

  if (!asset || !broker) { showToast("Completa todos los campos", "error"); return; }
  btn.disabled = true; btn.textContent = "Enviando…";
  try {
    await createSignal({ asset, broker, direction, entryTime, expiration });
    showToast("✅ Señal enviada", "success");
    if (document.getElementById("sig-entry-min")) document.getElementById("sig-entry-min").value = "";
    if (document.getElementById("sig-entry-sec")) document.getElementById("sig-entry-sec").value = "";
  } catch(e) { showToast("Error: " + e.message, "error"); }
  btn.disabled = false; btn.textContent = "📡 ENVIAR SEÑAL";
}

async function openEditModal(id) {
  currentSignalId = id;
  const s = await getSignal(id); if (!s) return;
  document.getElementById("edit-asset").value     = s.asset     || "";
  document.getElementById("edit-broker").value    = s.broker    || "";
  document.getElementById("edit-direction").value = s.direction || "CALL";
  document.getElementById("edit-entry").value     = s.entryTime || "";
  document.getElementById("edit-expiry").value    = s.expiration|| "";
  document.getElementById("edit-modal").style.display = "flex";
}

async function saveEditSignal() {
  if (!currentSignalId) return;
  try {
    await updateSignal(currentSignalId, {
      asset:      document.getElementById("edit-asset").value.trim(),
      broker:     document.getElementById("edit-broker").value.trim(),
      direction:  document.getElementById("edit-direction").value,
      entryTime:  document.getElementById("edit-entry").value,
      expiration: document.getElementById("edit-expiry").value.trim()
    });
    showToast("✅ Señal actualizada", "success");
    closeEditModal();
  } catch(e) { showToast("Error: " + e.message, "error"); }
}

function closeEditModal() {
  document.getElementById("edit-modal").style.display = "none";
  currentSignalId = null;
}

async function markResult(id, result) {
  try {
    await setSignalResult(id, result);
    const lbl = { win:"✅ WIN", loss:"❌ LOSS", draw:"➖ DOJI" };
    showToast(lbl[result] + " registrado", "success");
    loadStats();
  } catch(e) { showToast("Error: " + e.message, "error"); }
}

function confirmDelete(id) {
  if (confirm("¿Eliminar esta señal?")) deleteSignal(id).then(() => showToast("Señal eliminada","info"));
}

// ── USUARIOS ─────────────────────────────────────────────
function startUsersListener() {
  if (unsubUsers) unsubUsers();
  unsubUsers = listenUsers(renderUsers);
}

function renderUsers(users) {
  const tbody = document.getElementById("users-table-body");
  tbody.innerHTML = users.map(u => {
    const isAdmin    = u.role === "admin";
    const isPrincipal= u.email === "damoatrader1015@gmail.com";
    const status     = u.activo
      ? `<span class="badge active-b">Activo</span>`
      : `<span class="badge blocked-b">Bloqueado</span>`;
    const blockBtn   = u.activo
      ? `<button class="btn-sm block-btn" onclick="blockUser('${u.uid}')">🚫 Bloquear</button>`
      : `<button class="btn-sm unblock-btn" onclick="unblockUser('${u.uid}')">✅ Activar</button>`;
    const promoteBtn = !isAdmin
      ? `<button class="btn-sm promote-btn" onclick="confirmPromote('${u.uid}','${(u.nombre||u.email).replace(/'/g,"")}')">⬆️ Admin</button>`
      : (!isPrincipal ? `<button class="btn-sm demote-btn" onclick="confirmDemote('${u.uid}','${(u.nombre||u.email).replace(/'/g,"")}')">⬇️ User</button>` : `<span style="font-size:11px;color:var(--accent)">👑 Principal</span>`);
    return `<tr>
      <td>${u.nombre || "—"}</td>
      <td style="font-size:12px">${u.email}</td>
      <td><span class="badge ${isAdmin?'admin-b':'user-b'}">${u.role}</span></td>
      <td>${status}</td>
      <td class="actions" style="flex-wrap:wrap;gap:5px">
        ${promoteBtn}
        ${!isPrincipal ? blockBtn : ""}
        ${!isPrincipal ? `<button class="btn-sm del-btn" onclick="confirmDeleteUser('${u.uid}')">🗑️</button>` : ""}
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="5" class="empty-row">Sin usuarios</td></tr>`;
}

async function confirmPromote(uid, nombre) {
  if (confirm(`¿Dar rol ADMIN a "${nombre}"?\nPodrá enviar señales y gestionar usuarios.`)) {
    await promoteToAdmin(uid);
    showToast(`✅ ${nombre} ahora es Admin`, "success");
  }
}
async function confirmDemote(uid, nombre) {
  if (confirm(`¿Quitar Admin a "${nombre}"?\nVolverá a ser usuario normal.`)) {
    await demoteToUser(uid);
    showToast(`${nombre} ahora es Usuario`, "info");
  }
}
async function confirmDeleteUser(uid) {
  if (confirm("¿Eliminar este usuario?")) {
    await deleteUserDoc(uid);
    showToast("Usuario eliminado", "info");
  }
}

// ── ESTADÍSTICAS ─────────────────────────────────────────
async function loadStats() {
  const stats = await getSignalStats();
  const set = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
  set("stat-total", stats.total);
  set("stat-win",   stats.win);
  set("stat-loss",  stats.loss);
  set("stat-draw",  stats.draw);
  set("stat-pct",   stats.pct + "%");
  const bar = document.getElementById("win-bar");
  if (bar) bar.style.width = stats.pct + "%";
}

// ── RESET ────────────────────────────────────────────────
async function confirmResetStats() {
  if (!confirm("¿Borrar TODAS las estadísticas WIN/LOSS/DOJI?\nLas señales del historial se mantienen.")) return;
  try {
    await deleteAllResults();
    await loadStats();
    showToast("✅ Estadísticas borradas", "success");
  } catch(e) { showToast("Error: " + e.message, "error"); }
}

async function confirmResetAll() {
  if (!confirm("⚠️ ¿Borrar TODO? Señales + estadísticas.\nEsta acción no se puede deshacer.")) return;
  if (!confirm("Confirma: se borrará TODO el historial permanentemente.")) return;
  try {
    await deleteAllSignalsAndResults();
    await loadStats();
    showToast("✅ Todo el historial borrado", "success");
  } catch(e) { showToast("Error: " + e.message, "error"); }
}

// ── AUDIT LOGS ───────────────────────────────────────────
async function loadAuditLogs() {
  const logs = await getAuditLogs(100);
  const tbody = document.getElementById("audit-table-body");
  if (!logs.length) { tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Sin registros</td></tr>`; return; }
  tbody.innerHTML = logs.map(l => {
    const ts = l.timestamp ? l.timestamp.toDate().toLocaleString("es-CO") : "—";
    const details = JSON.stringify(l.details || {}).substring(0, 80);
    return `<tr>
      <td style="font-size:11px;color:var(--muted)">${ts}</td>
      <td><span class="badge admin-b" style="font-size:10px">${l.action}</span></td>
      <td style="font-size:12px">${l.email || "—"}</td>
      <td style="font-size:11px;color:var(--muted)">${details}</td>
    </tr>`;
  }).join("");
}

// ── DASHBOARD AVANZADO ───────────────────────────────────
async function loadDashboard() {
  // Obtener datos
  const [stats, usersSnap, signalsSnap] = await Promise.all([
    getSignalStats(),
    db.collection("users").get(),
    db.collection("signals").orderBy("createdAt","desc").limit(100).get()
  ]);

  const totalUsers  = usersSnap.size;
  const adminUsers  = usersSnap.docs.filter(d => d.data().role === "admin").length;
  const activeUsers = usersSnap.docs.filter(d => d.data().activo).length;

  const set = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
  set("dash-total-users",  totalUsers);
  set("dash-active-users", activeUsers);
  set("dash-admin-count",  adminUsers);
  set("dash-signals-total",signalsSnap.size);
  set("dash-win",   stats.win);
  set("dash-loss",  stats.loss);
  set("dash-draw",  stats.draw);
  set("dash-pct",   stats.pct + "%");

  // Distribución por activo
  const assetMap = {};
  signalsSnap.forEach(d => {
    const a = d.data().asset || "N/A";
    assetMap[a] = (assetMap[a] || 0) + 1;
  });
  const topAssets = Object.entries(assetMap).sort((a,b) => b[1]-a[1]).slice(0,5);
  const assetEl = document.getElementById("dash-top-assets");
  if (assetEl) assetEl.innerHTML = topAssets.map(([a,c]) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:13px">${a}</span>
      <span class="badge admin-b" style="font-size:11px">${c} señales</span>
    </div>`
  ).join("");

  // Actividad últimas 7 señales
  const recentEl = document.getElementById("dash-recent-signals");
  if (recentEl) {
    const recent = signalsSnap.docs.slice(0,7);
    recentEl.innerHTML = recent.map(d => {
      const s  = d.data();
      const ts = s.createdAt ? s.createdAt.toDate().toLocaleString("es-CO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";
      const st = { win:"✅","loss":"❌","draw":"➖","pending":"⏳" }[s.status] || "⏳";
      return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
        <span>${st} <strong>${s.asset}</strong> ${s.direction}</span>
        <span style="color:var(--muted)">${ts}</span>
      </div>`;
    }).join("") || "<p style='color:var(--muted);font-size:13px'>Sin actividad reciente</p>";
  }
}

// ── BOT IQ OPTION PANEL ──────────────────────────────────
function loadBotPanel() {
  const el = document.getElementById("bot-status");
  if (el) el.textContent = "Desconectado — Configurar credenciales";
}

async function testBotSignal() {
  const asset     = document.getElementById("bot-asset")?.value || "EUR/USD";
  const direction = document.getElementById("bot-direction")?.value || "CALL";
  const expiry    = document.getElementById("bot-expiry")?.value || "1";
  try {
    const now = new Date();
    const mm  = String(now.getMinutes() + 2).padStart(2,"0");
    const ss  = "00";
    await createBotSignal({
      asset, direction, expiration: expiry,
      entryTime: mm + ":" + ss,
      botName: "IQBot-Manual",
      strategy: "Manual Test",
      confidence: 85
    });
    showToast("✅ Señal de bot enviada", "success");
  } catch(e) { showToast("Error: " + e.message, "error"); }
}

// ── UTILS ─────────────────────────────────────────────────
function updateDirColor(sel) {
  if (!sel) return;
  if (sel.value === "CALL") {
    sel.style.color = "#00ff88"; sel.style.background = "rgba(0,255,136,0.08)"; sel.style.borderColor = "rgba(0,255,136,0.3)";
  } else {
    sel.style.color = "#ff3366"; sel.style.background = "rgba(255,51,102,0.08)"; sel.style.borderColor = "rgba(255,51,102,0.3)";
  }
}

function showToast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  const container = document.getElementById("toast-container");
  if (container) {
    container.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 3500);
  }
}

// ── MÉTRICAS EN TIEMPO REAL ───────────────────────────────
let unsubMetrics = null;

async function loadMetrics() {
  renderMetricsSkeleton();
  await Promise.all([
    loadUserMetrics(),
    loadSignalMetrics(),
    loadRecentActivity()
  ]);
  startPresenceListener();
}

async function loadUserMetrics() {
  const snap = await db.collection("users").get();
  const users = snap.docs.map(d => d.data());
  const total    = users.length;
  const activos  = users.filter(u => u.activo).length;
  const bloqueados = users.filter(u => !u.activo).length;
  const admins   = users.filter(u => u.role === "admin").length;
  const conFCM   = users.filter(u => u.fcmToken).length;

  const el = document.getElementById("metrics-users");
  if (!el) return;
  el.innerHTML = `
    <div class="metric-row"><span>👥 Total usuarios</span><strong>${total}</strong></div>
    <div class="metric-row"><span>✅ Activos</span><strong style="color:#00ff88">${activos}</strong></div>
    <div class="metric-row"><span>🚫 Bloqueados</span><strong style="color:#ff3366">${bloqueados}</strong></div>
    <div class="metric-row"><span>👑 Admins</span><strong style="color:#00d4ff">${admins}</strong></div>
    <div class="metric-row"><span>🔔 Con notif. activadas</span><strong style="color:#ffc800">${conFCM}</strong></div>
  `;
}

async function loadSignalMetrics() {
  const snap = await db.collection("signals").get();
  const signals = snap.docs.map(d => d.data());
  const total    = signals.length;
  const pending  = signals.filter(s => s.status === "pending").length;
  const win      = signals.filter(s => s.status === "win").length;
  const loss     = signals.filter(s => s.status === "loss").length;
  const draw     = signals.filter(s => s.status === "draw").length;
  const expired  = signals.filter(s => s.status === "expired").length;
  const pct      = (win + loss) > 0 ? Math.round(win / (win + loss) * 100) : 0;

  // Señales por hora (últimas 24h)
  const now = Date.now();
  const byHour = Array(24).fill(0);
  signals.forEach(s => {
    if (!s.createdAt) return;
    const ts = s.createdAt.toDate ? s.createdAt.toDate().getTime() : 0;
    const hoursAgo = Math.floor((now - ts) / 3600000);
    if (hoursAgo < 24) byHour[23 - hoursAgo]++;
  });

  const el = document.getElementById("metrics-signals");
  if (!el) return;
  el.innerHTML = `
    <div class="metric-row"><span>📡 Total señales</span><strong>${total}</strong></div>
    <div class="metric-row"><span>⏳ Pendientes</span><strong style="color:#ffc800">${pending}</strong></div>
    <div class="metric-row"><span>✅ WIN</span><strong style="color:#00ff88">${win}</strong></div>
    <div class="metric-row"><span>❌ LOSS</span><strong style="color:#ff3366">${loss}</strong></div>
    <div class="metric-row"><span>➖ DOJI</span><strong style="color:#aaa">${draw}</strong></div>
    <div class="metric-row"><span>💨 Expiradas auto</span><strong style="color:#7a9ab5">${expired}</strong></div>
    <div class="metric-row"><span>🎯 Efectividad</span><strong style="color:#00d4ff;font-size:18px">${pct}%</strong></div>
  `;

  // Mini gráfica de barras (últimas 24h)
  const maxVal = Math.max(...byHour, 1);
  const chartEl = document.getElementById("metrics-chart");
  if (chartEl) {
    chartEl.innerHTML = byHour.map((v, i) => {
      const h = Math.round((v / maxVal) * 100);
      const label = i % 6 === 0 ? `<div style="font-size:9px;color:var(--muted);margin-top:3px">${23-i}h</div>` : "";
      return `<div style="display:flex;flex-direction:column;align-items:center;flex:1">
        <div style="width:100%;background:rgba(0,212,255,0.08);border-radius:3px;height:60px;display:flex;align-items:flex-end">
          <div style="width:100%;height:${h}%;background:linear-gradient(to top,#00d4ff,#00ff88);border-radius:3px;min-height:${v>0?2:0}px"></div>
        </div>
        ${label}
      </div>`;
    }).join("");
  }
}

async function loadRecentActivity() {
  const snap = await db.collection("audit_logs")
    .orderBy("timestamp", "desc").limit(8).get();

  const el = document.getElementById("metrics-activity");
  if (!el) return;

  if (snap.empty) {
    el.innerHTML = `<p style="color:var(--muted);font-size:12px">Sin actividad reciente</p>`;
    return;
  }

  el.innerHTML = snap.docs.map(d => {
    const l  = d.data();
    const ts = l.timestamp ? l.timestamp.toDate().toLocaleString("es-CO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";
    const icons = {
      SIGNAL_CREATED: "📡", SIGNAL_RESULT: "🏁", SIGNAL_DELETED: "🗑️",
      BOT_SIGNAL_CREATED: "🤖", MAINTENANCE_ON: "🔴", MAINTENANCE_OFF: "🟢",
      USER_BLOCKED: "🚫", USER_UNBLOCKED: "✅"
    };
    const icon = icons[l.action] || "📋";
    return `<div class="metric-row">
      <span>${icon} <span style="color:var(--accent);font-size:11px">${l.action}</span></span>
      <span style="font-size:11px;color:var(--muted)">${ts}</span>
    </div>`;
  }).join("");
}

function startPresenceListener() {
  if (unsubMetrics) unsubMetrics();
  // Escuchar cambios en usuarios en tiempo real
  unsubMetrics = db.collection("users").onSnapshot(() => {
    loadUserMetrics();
  });
}

function renderMetricsSkeleton() {
  ["metrics-users","metrics-signals","metrics-activity"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<p style="color:var(--muted);font-size:12px">Cargando…</p>`;
  });
}
