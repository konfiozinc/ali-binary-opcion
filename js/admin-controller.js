// ============================================================
// ADMIN-CONTROLLER.JS — Lógica UI del Panel Admin
// ============================================================

let currentSignalId = null;
let unsubSignals    = null;
let unsubUsers      = null;
let currentAdminUser = null;

// ─── INIT ────────────────────────────────────────────────────
async function initAdmin() {
  currentAdminUser = await requireAdmin();
  document.getElementById("admin-name").textContent = currentAdminUser.nombre || "Admin";

  // Cargar tab inicial
  showTab("signals");
  loadStats();
}

// ─── TABS ─────────────────────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("active");
  document.querySelector(`[data-tab="${tab}"]`).classList.add("active");

  if (tab === "signals") startSignalListener();
  if (tab === "users")   startUsersListener();
  if (tab === "stats")   loadStats();
}

// ─── SEÑALES ──────────────────────────────────────────────────
function startSignalListener() {
  if (unsubSignals) unsubSignals();
  unsubSignals = listenSignals(renderSignals);
}

function renderSignals(signals) {
  const tbody = document.getElementById("signals-table-body");
  if (!signals.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Sin señales aún</td></tr>`;
    return;
  }
  tbody.innerHTML = signals.map(s => {
    const dir = s.direction === "CALL"
      ? `<span class="badge call">▲ CALL</span>`
      : `<span class="badge put">▼ PUT</span>`;
    const status = statusBadge(s.status);
    const time   = s.createdAt ? formatTime(s.createdAt.toDate()) : "—";
    return `
      <tr>
        <td>${s.asset || "—"}</td>
        <td>${s.broker || "—"}</td>
        <td>${dir}</td>
        <td>${s.entryTime || "—"}</td>
        <td>${s.expiration || "—"}</td>
        <td>${status}</td>
        <td class="actions">
          <button class="btn-icon edit" onclick="openEditModal('${s.id}')" title="Editar">✏️</button>
          <button class="btn-icon win"  onclick="markResult('${s.id}','win')"  title="WIN">✅</button>
          <button class="btn-icon loss" onclick="markResult('${s.id}','loss')" title="LOSS">❌</button>
          <button class="btn-icon draw" onclick="markResult('${s.id}','draw')" title="DRAW">➖</button>
          <button class="btn-icon del"  onclick="confirmDelete('${s.id}')"     title="Eliminar">🗑️</button>
        </td>
      </tr>`;
  }).join("");
}

function statusBadge(status) {
  const map = {
    pending: `<span class="badge pending">⏳ Pendiente</span>`,
    win:     `<span class="badge win-b">✅ WIN</span>`,
    loss:    `<span class="badge loss-b">❌ LOSS</span>`,
    draw:    `<span class="badge draw-b">➖ DRAW</span>`
  };
  return map[status] || status;
}

// Crear señal
async function submitSignal() {
  const btn  = document.getElementById("btn-create-signal");
  const asset     = document.getElementById("sig-asset").value;
  const broker    = document.getElementById("sig-broker").value;
  const direction = document.getElementById("sig-direction").value;
  const mm        = String(document.getElementById("sig-entry-min").value || "0").padStart(2,"0");
  const ss        = String(document.getElementById("sig-entry-sec").value || "0").padStart(2,"0");
  const entryTime = mm + ":" + ss;
  const expiration= document.getElementById("sig-expiry").value;

  if (!asset || !broker || !entryTime) {
    showToast("Completa todos los campos", "error"); return;
  }

  btn.disabled = true;
  btn.textContent = "Enviando…";
  try {
    await createSignal({ asset, broker, direction, entryTime, expiration });
    showToast("✅ Señal enviada en tiempo real", "success");
    clearSignalForm();
  } catch(e) {
    showToast("Error: " + e.message, "error");
  }
  btn.disabled = false;
  btn.textContent = "Enviar Señal";
}

function clearSignalForm() {
  document.getElementById("sig-entry-min").value = "";
  document.getElementById("sig-entry-sec").value = "";
  document.getElementById("sig-direction").value = "CALL";
}

// Editar señal
async function openEditModal(id) {
  currentSignalId = id;
  const signal = await getSignal(id);
  if (!signal) return;
  document.getElementById("edit-asset").value     = signal.asset     || "";
  document.getElementById("edit-broker").value    = signal.broker    || "";
  document.getElementById("edit-direction").value = signal.direction || "CALL";
  document.getElementById("edit-entry").value     = signal.entryTime || "";
  document.getElementById("edit-expiry").value    = signal.expiration|| "";
  document.getElementById("edit-modal").style.display = "flex";
}

async function saveEditSignal() {
  if (!currentSignalId) return;
  const data = {
    asset:      document.getElementById("edit-asset").value.trim(),
    broker:     document.getElementById("edit-broker").value.trim(),
    direction:  document.getElementById("edit-direction").value,
    entryTime:  document.getElementById("edit-entry").value,
    expiration: document.getElementById("edit-expiry").value.trim()
  };
  try {
    await updateSignal(currentSignalId, data);
    showToast("✅ Señal actualizada", "success");
    closeEditModal();
  } catch(e) {
    showToast("Error: " + e.message, "error");
  }
}

function closeEditModal() {
  document.getElementById("edit-modal").style.display = "none";
  currentSignalId = null;
}

async function markResult(id, result) {
  try {
    await setSignalResult(id, result);
    const labels = { win: "✅ WIN", loss: "❌ LOSS", draw: "➖ DRAW" };
    showToast(labels[result] + " registrado", "success");
    loadStats();
  } catch(e) {
    showToast("Error: " + e.message, "error");
  }
}

function confirmDelete(id) {
  if (confirm("¿Eliminar esta señal?")) {
    deleteSignal(id).then(() => showToast("Señal eliminada", "info"));
  }
}

// ─── USUARIOS ─────────────────────────────────────────────────
function startUsersListener() {
  if (unsubUsers) unsubUsers();
  unsubUsers = listenUsers(renderUsers);
}

function renderUsers(users) {
  const tbody = document.getElementById("users-table-body");
  tbody.innerHTML = users.map(u => {
    const status = u.activo
      ? `<span class="badge active-b">Activo</span>`
      : `<span class="badge blocked-b">Bloqueado</span>`;
    const blockBtn = u.activo
      ? `<button class="btn-icon block" onclick="blockUser('${u.uid}')">🚫</button>`
      : `<button class="btn-icon unblock" onclick="unblockUser('${u.uid}')">✅</button>`;
    const isAdmin = u.role === "admin";
    return `
      <tr>
        <td>${u.nombre || "—"}</td>
        <td>${u.email}</td>
        <td><span class="badge ${isAdmin?'admin-b':'user-b'}">${u.role}</span></td>
        <td>${status}</td>
        <td class="actions">
          ${!isAdmin ? blockBtn : ""}
          ${!isAdmin ? `<button class="btn-icon del" onclick="confirmDeleteUser('${u.uid}')">🗑️</button>` : ""}
        </td>
      </tr>`;
  }).join("") || `<tr><td colspan="5" class="empty-row">Sin usuarios</td></tr>`;
}

async function confirmDeleteUser(uid) {
  if (confirm("¿Eliminar este usuario?")) {
    await deleteUserDoc(uid);
    showToast("Usuario eliminado", "info");
  }
}

// ─── ESTADÍSTICAS ─────────────────────────────────────────────
async function loadStats() {
  const stats = await getSignalStats();
  const el = id => document.getElementById(id);
  if (el("stat-total")) el("stat-total").textContent = stats.total;
  if (el("stat-win"))   el("stat-win").textContent   = stats.win;
  if (el("stat-loss"))  el("stat-loss").textContent  = stats.loss;
  if (el("stat-draw"))  el("stat-draw").textContent  = stats.draw;
  if (el("stat-pct"))   el("stat-pct").textContent   = stats.pct + "%";

  // Barra de efectividad
  const bar = document.getElementById("win-bar");
  if (bar) bar.style.width = stats.pct + "%";
}

// ─── UTILS ────────────────────────────────────────────────────
function formatTime(date) {
  return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function showToast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.getElementById("toast-container").appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 3500);
}
