// ============================================================
// SALA-CONTROLLER.JS — Sala premium en tiempo real
// ============================================================

let unsubSalaSignals = null;
let timerInterval    = null;
let currentUser      = null;

// ─── INIT ────────────────────────────────────────────────────
async function initSala() {
  currentUser = await requireAuth();
  document.getElementById("user-name").textContent = currentUser.nombre || currentUser.email;
  startSignalListener();
  loadSalaStats();
}

// ─── LISTENER TIEMPO REAL ─────────────────────────────────────
function startSignalListener() {
  // Escuchar TODO (activas + historial reciente)
  unsubSalaSignals = listenSignals(renderSalaSignals);
}

function renderSalaSignals(signals) {
  const active  = signals.filter(s => s.status === "pending");
  const history = signals.filter(s => s.status !== "pending");

  renderActiveSignals(active);
  renderHistorySignals(history);
  loadSalaStats(signals);

  // Notificación de nueva señal
  if (active.length > 0) playBeep();
}

// ─── SEÑALES ACTIVAS ──────────────────────────────────────────
function renderActiveSignals(signals) {
  const container = document.getElementById("active-signals");
  if (!signals.length) {
    container.innerHTML = `
      <div class="no-signal">
        <div class="pulse-dot"></div>
        <p>Esperando señales del administrador…</p>
      </div>`;
    return;
  }

  container.innerHTML = signals.map(s => {
    const isCall = s.direction === "CALL";
    const arrow  = isCall ? "▲" : "▼";
    const cls    = isCall ? "call" : "put";
    return `
      <div class="signal-card ${cls} animate-in">
        <div class="signal-direction ${cls}">
          <span class="dir-arrow">${arrow}</span>
          <span class="dir-label">${s.direction}</span>
        </div>
        <div class="signal-info">
          <div class="signal-asset">${s.asset}</div>
          <div class="signal-meta">
            <span>🏦 ${s.broker}</span>
            <span>⏰ ${s.entryTime}</span>
            <span>⏱️ ${s.expiration} min</span>
          </div>
        </div>
        <div class="signal-timer" id="timer-${s.id}">
          <div class="timer-circle">
            <span id="timer-val-${s.id}">—</span>
          </div>
        </div>
      </div>`;
  }).join("");

  // Iniciar timers para cada señal
  signals.forEach(s => startSignalTimer(s));
}

// ─── TIMER POR SEÑAL ──────────────────────────────────────────
function startSignalTimer(signal) {
  const el = document.getElementById("timer-val-" + signal.id);
  if (!el) return;

  // Parsear entryTime (formato "HH:MM")
  if (!signal.entryTime || !signal.createdAt) { el.textContent = "—"; return; }

  function tick() {
    const now   = new Date();
    const [h,m] = signal.entryTime.split(":").map(Number);
    const entry = new Date();
    entry.setHours(h, m, 0, 0);
    const diff  = Math.floor((entry - now) / 1000);

    if (diff <= 0) {
      el.textContent = "¡YA!";
      el.parentElement.classList.add("pulse");
    } else {
      const mm = String(Math.floor(diff/60)).padStart(2,"0");
      const ss = String(diff % 60).padStart(2,"0");
      el.textContent = `${mm}:${ss}`;
    }
  }
  tick();
  const iv = setInterval(() => {
    if (!document.getElementById("timer-val-" + signal.id)) { clearInterval(iv); return; }
    tick();
  }, 1000);
}

// ─── HISTORIAL ────────────────────────────────────────────────
function renderHistorySignals(signals) {
  const tbody = document.getElementById("history-body");
  if (!signals.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Sin historial</td></tr>`;
    return;
  }
  tbody.innerHTML = signals.slice(0, 30).map(s => {
    const isCall = s.direction === "CALL";
    const dir    = isCall
      ? `<span class="badge call">▲ CALL</span>`
      : `<span class="badge put">▼ PUT</span>`;
    const stat   = resultBadge(s.status);
    const time   = s.createdAt ? formatSalaTime(s.createdAt.toDate()) : "—";
    return `
      <tr>
        <td>${s.asset}</td>
        <td>${dir}</td>
        <td>${s.broker}</td>
        <td>${s.entryTime || "—"}</td>
        <td>${stat}</td>
      </tr>`;
  }).join("");
}

function resultBadge(status) {
  const map = {
    win:  `<span class="badge win-b">✅ WIN</span>`,
    loss: `<span class="badge loss-b">❌ LOSS</span>`,
    draw: `<span class="badge draw-b">➖ DRAW</span>`
  };
  return map[status] || `<span class="badge pending">⏳</span>`;
}

// ─── ESTADÍSTICAS ─────────────────────────────────────────────
async function loadSalaStats(signals) {
  const stats = await getSignalStats();
  const set = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
  set("sala-total", stats.total);
  set("sala-win",   stats.win);
  set("sala-loss",  stats.loss);
  set("sala-draw",  stats.draw);
  set("sala-pct",   stats.pct + "%");
  const bar = document.getElementById("sala-win-bar");
  if (bar) bar.style.width = stats.pct + "%";
}

// ─── AUDIO BEEP ───────────────────────────────────────────────
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain= ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch(e) {}
}

function formatSalaTime(date) {
  return date.toLocaleString("es-CO", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

function showSalaToast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.getElementById("toast-container").appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 3500);
}
