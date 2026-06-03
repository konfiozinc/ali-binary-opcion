// ============================================================
// SALA-CONTROLLER.JS v3.0
// Flujo: Admin envía señal → Firestore → Sala recibe → SONIDO
// ============================================================

let unsubSalaSignals = null;
let currentUser      = null;
let prevActiveIds    = new Set();
let timerIntervals   = {};

// ── INIT ────────────────────────────────────────────────────
async function initSala() {
  currentUser = await requireAuth();
  document.getElementById("user-name").textContent = currentUser.nombre || currentUser.email;
  startSignalListener();
  loadSalaStats();
}

// ── LISTENER TIEMPO REAL ─────────────────────────────────────
function startSignalListener() {
  if (unsubSalaSignals) unsubSalaSignals();
  unsubSalaSignals = listenSignals(renderSalaSignals);
}

function renderSalaSignals(signals) {
  const active  = signals.filter(s => s.status === "pending");
  const history = signals.filter(s => s.status !== "pending");

  // Detectar señales NUEVAS (IDs que no estaban antes)
  const currentIds = new Set(active.map(s => s.id));
  const hasNew     = active.some(s => !prevActiveIds.has(s.id));
  if (hasNew && prevActiveIds.size > 0) {
    // Solo suena si ya había señales antes (no en la carga inicial)
    playAlertSound();
  }
  prevActiveIds = currentIds;

  renderActiveSignals(active);
  renderHistorySignals(history);
  loadSalaStats();
}

// ── SEÑALES ACTIVAS ───────────────────────────────────────────
function renderActiveSignals(signals) {
  const container = document.getElementById("active-signals");
  Object.values(timerIntervals).forEach(clearInterval);
  timerIntervals = {};

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
    const cls    = isCall ? "call" : "put";
    return `
      <div class="signal-card ${cls} animate-in">
        <div class="signal-direction ${cls}">
          <span class="dir-arrow">${isCall ? "▲" : "▼"}</span>
          <span class="dir-label">${s.direction}</span>
        </div>
        <div class="signal-info">
          <div class="signal-asset">${s.asset}</div>
          <div class="signal-meta">
            <span>🏦 ${s.broker}</span>
            <span>⏰ Entrada: <strong style="font-size:18px;color:var(--accent);letter-spacing:1px">${s.entryTime}</strong></span>
            <span>⏱️ ${s.expiration} min</span>
          </div>
        </div>
        <div class="signal-timer">
          <div class="timer-circle" id="timer-${s.id}">
            <span id="timer-val-${s.id}">--:--</span>
          </div>
        </div>
      </div>`;
  }).join("");

  signals.forEach(s => startSignalTimer(s));
}

// ── TIMER ──────────────────────────────────────────────────────
function startSignalTimer(signal) {
  const el     = document.getElementById("timer-val-" + signal.id);
  const circle = document.getElementById("timer-" + signal.id);
  if (!el || !signal.entryTime) return;

  const tick = () => {
    if (!document.getElementById("timer-val-" + signal.id)) {
      clearInterval(timerIntervals[signal.id]); return;
    }
    const now  = new Date();
    const [mm, ss] = signal.entryTime.split(":").map(Number);
    const entry = new Date();
    entry.setHours(now.getHours(), mm, ss, 0);
    let diff = Math.floor((entry - now) / 1000);
    if (diff < -60) diff += 3600;

    if (diff <= 0) {
      el.textContent = "¡YA!";
      el.style.color = "#00ff88";
      if (circle) { circle.style.borderColor = "#00ff88"; circle.style.boxShadow = "0 0 20px rgba(0,255,136,0.6)"; }
    } else {
      const m = String(Math.floor(diff / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      el.textContent = `${m}:${s}`;
      if (circle) {
        if (diff <= 10)      { el.style.color = "#ff3366"; circle.style.borderColor = "#ff3366"; }
        else if (diff <= 30) { el.style.color = "#ffc800"; circle.style.borderColor = "#ffc800"; }
        else                 { el.style.color = "var(--accent)"; circle.style.borderColor = "rgba(0,212,255,0.4)"; }
      }
    }
  };
  tick();
  timerIntervals[signal.id] = setInterval(tick, 1000);
}

// ── HISTORIAL ─────────────────────────────────────────────────
function renderHistorySignals(signals) {
  const tbody = document.getElementById("history-body");
  if (!signals.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Sin historial aún</td></tr>`;
    return;
  }
  tbody.innerHTML = signals.slice(0, 40).map(s => {
    const isCall = s.direction === "CALL";
    const dir    = `<span class="badge ${isCall ? "call" : "put"}">${isCall ? "▲ CALL" : "▼ PUT"}</span>`;
    return `<tr>
      <td><strong>${s.asset}</strong></td>
      <td>${dir}</td>
      <td>${s.entryTime || "—"}</td>
      <td>${resultBadge(s.status)}</td>
    </tr>`;
  }).join("");
}

function resultBadge(status) {
  return {
    win:  `<span class="badge win-b">✅ WIN</span>`,
    loss: `<span class="badge loss-b">❌ LOSS</span>`,
    draw: `<span class="badge draw-b">➖ DOJI</span>`
  }[status] || `<span class="badge pending">⏳ Pendiente</span>`;
}

// ── ESTADÍSTICAS ───────────────────────────────────────────────
async function loadSalaStats() {
  const stats = await getSignalStats();
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  set("sala-total", stats.total);
  set("sala-win",   stats.win);
  set("sala-loss",  stats.loss);
  set("sala-draw",  stats.draw);
  set("sala-pct",   stats.pct + "%");
  const bar = document.getElementById("sala-win-bar");
  if (bar) bar.style.width = stats.pct + "%";
}

// ── SONIDO DE ALERTA ───────────────────────────────────────────
// Usa el elemento <audio> con mixkit para máxima compatibilidad
function playAlertSound() {
  try {
    const audio = document.getElementById("alertAudio");
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => playFallbackBeep());
    } else {
      playFallbackBeep();
    }
  } catch(e) {
    playFallbackBeep();
  }
}

// Fallback con Web Audio API si el archivo no carga
function playFallbackBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.ratio.value = 20;
    comp.connect(ctx.destination);

    function note(freq, start, dur, vol) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
      gain.gain.setValueAtTime(vol, ctx.currentTime + start + dur - 0.03);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(comp);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    }
    note(1200, 0.00, 0.12, 1.0);
    note(1200, 0.17, 0.12, 1.0);
    note(1200, 0.34, 0.12, 1.0);
    note(1400, 0.55, 0.45, 1.0);
  } catch(e) {}
}

// ── TOAST ──────────────────────────────────────────────────────
function showSalaToast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  const c = document.getElementById("toast-container");
  if (c) {
    c.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 4000);
  }
}

function formatSalaTime(date) {
  return date.toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
