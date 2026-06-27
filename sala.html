// ============================================================
// SALA-CONTROLLER.JS — Release 1.0
// Correcciones: cronómetro HH:MM, sonido con persistencia,
// botón instalar PWA, botón activar sonido
// ============================================================

let unsubSalaSignals = null;
let currentUser      = null;
let prevActiveIds    = null;
let timerIntervals   = {};
let audioEnabled     = false;
let deferredInstall  = null;

// ── INIT ─────────────────────────────────────────────────────
async function initSala() {
  currentUser = await requireAuth();
  document.getElementById("user-name").textContent =
    currentUser.nombre || currentUser.email;

  initAudio();
  initPWA();
  checkNotifSupport();
  startSignalListener();
  loadSalaStats();
}

// ═══════════════════════════════════════════════════════════
// AUDIO — Persistencia + Botón explícito
// ═══════════════════════════════════════════════════════════
function initAudio() {
  // Leer preferencia guardada
  const saved = localStorage.getItem("audioEnabled");
  if (saved === "true") {
    audioEnabled = true;
    updateAudioBtn(true);
  } else {
    // Mostrar aviso si no está activado
    updateAudioBtn(false);
  }
}

function toggleAudio() {
  if (!audioEnabled) {
    enableAudio();
  } else {
    disableAudio();
  }
}

function enableAudio() {
  const audio = document.getElementById("alertAudio");
  if (!audio) { audioEnabled = true; localStorage.setItem("audioEnabled","true"); updateAudioBtn(true); return; }

  // Reproducir silenciosamente para desbloquear
  const originalVol = audio.volume;
  audio.volume = 0.01;
  audio.currentTime = 0;
  audio.play().then(() => {
    setTimeout(() => { audio.pause(); audio.currentTime = 0; audio.volume = originalVol; }, 300);
    audioEnabled = true;
    localStorage.setItem("audioEnabled", "true");
    updateAudioBtn(true);
    showSalaToast("🔊 Sonido activado", "success");
  }).catch(() => {
    // Fallback: marcar como activado y confiar en interacción futura
    audioEnabled = true;
    localStorage.setItem("audioEnabled", "true");
    updateAudioBtn(true);
    showSalaToast("🔊 Sonido activado", "success");
  });
}

function disableAudio() {
  audioEnabled = false;
  localStorage.setItem("audioEnabled", "false");
  updateAudioBtn(false);
  showSalaToast("🔇 Sonido desactivado", "info");
}

function updateAudioBtn(enabled) {
  const btn = document.getElementById("btn-audio");
  if (!btn) return;
  if (enabled) {
    btn.textContent = "🔊 SONIDO ON";
    btn.style.background = "rgba(0,255,136,0.15)";
    btn.style.borderColor = "rgba(0,255,136,0.5)";
    btn.style.color = "#00ff88";
  } else {
    btn.textContent = "🔇 ACTIVAR SONIDO";
    btn.style.background = "rgba(255,200,0,0.1)";
    btn.style.borderColor = "rgba(255,200,0,0.4)";
    btn.style.color = "#ffc800";
  }
}

// ═══════════════════════════════════════════════════════════
// PWA — Capturar e instalar
// ═══════════════════════════════════════════════════════════
function initPWA() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
    const btn = document.getElementById("btn-install");
    if (btn) btn.style.display = "inline-flex";
  });

  window.addEventListener("appinstalled", () => {
    const btn = document.getElementById("btn-install");
    if (btn) btn.style.display = "none";
    deferredInstall = null;
    showSalaToast("✅ App instalada correctamente", "success");
  });
}

function installApp() {
  if (!deferredInstall) {
    showSalaToast("Usa el menú del navegador → 'Instalar aplicación'", "info");
    return;
  }
  deferredInstall.prompt();
  deferredInstall.userChoice.then(result => {
    if (result.outcome === "accepted") {
      showSalaToast("✅ Instalando app…", "success");
    }
    deferredInstall = null;
  });
}

// ═══════════════════════════════════════════════════════════
// LISTENER FIRESTORE EN TIEMPO REAL
// ═══════════════════════════════════════════════════════════
function startSignalListener() {
  if (unsubSalaSignals) unsubSalaSignals();
  unsubSalaSignals = listenSignals(renderSalaSignals);
}

function renderSalaSignals(signals) {
  const active  = signals.filter(s => s.status === "pending");
  const history = signals.filter(s => s.status !== "pending");

  if (prevActiveIds === null) {
    // Primera carga — registrar IDs sin sonar
    prevActiveIds = new Set(active.map(s => s.id));
  } else {
    const newSignals = active.filter(s => !prevActiveIds.has(s.id));
    if (newSignals.length > 0) {
      playAlertSound();
      showSalaToast(
        `📡 Nueva señal: ${newSignals[0].asset} ${newSignals[0].direction}`,
        "success"
      );
    }
    prevActiveIds = new Set(active.map(s => s.id));
  }

  renderActiveSignals(active);
  renderHistorySignals(history);
  loadSalaStats();
}

// ═══════════════════════════════════════════════════════════
// SEÑALES ACTIVAS
// ═══════════════════════════════════════════════════════════
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
            <span>⏰ Entrada: <strong style="font-size:18px;color:var(--accent);letter-spacing:2px">${s.entryTime}</strong></span>
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

// ═══════════════════════════════════════════════════════════
// CRONÓMETRO CORREGIDO — HH:MM real
// entryTime formato "HH:MM" (ej: "07:50")
// Calcula diferencia real entre ahora y esa hora del día
// ═══════════════════════════════════════════════════════════
function startSignalTimer(signal) {
  const el     = document.getElementById("timer-val-" + signal.id);
  const circle = document.getElementById("timer-" + signal.id);
  if (!el || !signal.entryTime) return;

  // Parsear HH:MM de la hora de entrada
  const parts = signal.entryTime.split(":");
  const entryHour = parseInt(parts[0], 10);  // HH real
  const entryMin  = parseInt(parts[1], 10);  // MM
  const entrySec  = parts[2] ? parseInt(parts[2], 10) : 0;

  const tick = () => {
    if (!document.getElementById("timer-val-" + signal.id)) {
      clearInterval(timerIntervals[signal.id]);
      return;
    }

    const now = new Date();

    // Construir fecha/hora objetivo (hoy a HH:MM:SS)
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      entryHour,
      entryMin,
      entrySec,
      0
    );

    let diff = Math.floor((target - now) / 1000);

    // Si ya pasó pero fue hace menos de 5 min, mostrar ¡YA!
    // Si pasó hace más tiempo, puede ser para mañana
    if (diff < -300) {
      // Señal para el día siguiente
      target.setDate(target.getDate() + 1);
      diff = Math.floor((target - now) / 1000);
    }

    if (diff <= 0) {
      el.textContent = "¡YA!";
      el.style.color  = "#00ff88";
      if (circle) {
        circle.style.borderColor = "#00ff88";
        circle.style.boxShadow   = "0 0 20px rgba(0,255,136,0.6)";
        circle.classList.add("pulse");
      }
    } else {
      const hh = Math.floor(diff / 3600);
      const mm = Math.floor((diff % 3600) / 60);
      const ss = diff % 60;

      // Si quedan más de 60 min mostrar HH:MM, si no MM:SS
      if (hh > 0) {
        el.textContent = `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
      } else {
        el.textContent = `${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
      }

      if (circle) {
        if (diff <= 10) {
          el.style.color = "#ff3366";
          circle.style.borderColor = "#ff3366";
          circle.style.boxShadow   = "0 0 15px rgba(255,51,102,0.5)";
        } else if (diff <= 60) {
          el.style.color = "#ffc800";
          circle.style.borderColor = "#ffc800";
          circle.style.boxShadow   = "0 0 10px rgba(255,200,0,0.4)";
        } else {
          el.style.color = "var(--accent)";
          circle.style.borderColor = "rgba(0,212,255,0.4)";
          circle.style.boxShadow   = "none";
        }
        circle.classList.remove("pulse");
      }
    }
  };

  tick();
  timerIntervals[signal.id] = setInterval(tick, 1000);
}

// ═══════════════════════════════════════════════════════════
// HISTORIAL
// ═══════════════════════════════════════════════════════════
function renderHistorySignals(signals) {
  const tbody = document.getElementById("history-body");
  if (!signals.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Sin historial aún</td></tr>`;
    return;
  }
  tbody.innerHTML = signals.slice(0, 40).map(s => {
    const isCall = s.direction === "CALL";
    const dir = `<span class="badge ${isCall ? "call" : "put"}">${isCall ? "▲ CALL" : "▼ PUT"}</span>`;
    return `<tr>
      <td><strong>${s.asset}</strong></td>
      <td>${dir}</td>
      <td>${s.entryTime || "—"}</td>
      <td>${resultBadge(s.status)}</td>
    </tr>`;
  }).join("");
}

function resultBadge(status) {
  const map = {
    win:  `<span class="badge win-b">✅ WIN</span>`,
    loss: `<span class="badge loss-b">❌ LOSS</span>`,
    draw: `<span class="badge draw-b">➖ DOJI</span>`
  };
  return map[status] || `<span class="badge pending">⏳ Pendiente</span>`;
}

// ═══════════════════════════════════════════════════════════
// ESTADÍSTICAS
// ═══════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════
// SONIDO — Mixkit + Fallback Web Audio
// ═══════════════════════════════════════════════════════════
function playAlertSound() {
  if (!audioEnabled) {
    // Mostrar aviso visual si el sonido no está activado
    showSalaToast("🔇 Activa el sonido para recibir alertas de audio", "info");
    return;
  }

  const audio = document.getElementById("alertAudio");
  if (audio) {
    audio.currentTime = 0;
    audio.volume = 1.0;
    audio.play().catch(() => playFallbackBeep());
  } else {
    playFallbackBeep();
  }
}

function playFallbackBeep() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.ratio.value = 20;
    comp.connect(ctx.destination);
    [[1200,0.00,0.12],[1200,0.17,0.12],[1200,0.34,0.12],[1500,0.55,0.50]].forEach(([f,t,d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "square"; o.frequency.setValueAtTime(f, ctx.currentTime+t);
      g.gain.setValueAtTime(0, ctx.currentTime+t);
      g.gain.linearRampToValueAtTime(1.0, ctx.currentTime+t+0.01);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime+t+d);
      o.connect(g); g.connect(comp);
      o.start(ctx.currentTime+t); o.stop(ctx.currentTime+t+d+0.05);
    });
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════
// NOTIFICACIONES PUSH
// ═══════════════════════════════════════════════════════════
async function requestNotifPermission() {
  try {
    if (!("Notification" in window)) {
      showSalaToast("Tu navegador no soporta notificaciones", "info");
      return;
    }
    const result = await Notification.requestPermission();
    if (result === "granted") {
      await initFCM();
      showSalaToast("🔔 Notificaciones activadas", "success");
      const btn = document.getElementById("btn-notif");
      if (btn) {
        btn.textContent = "🔔 NOTIF ON";
        btn.style.color = "#00ff88";
        btn.style.borderColor = "rgba(0,255,136,0.5)";
        btn.style.background = "rgba(0,255,136,0.12)";
      }
    } else {
      showSalaToast("Permiso de notificaciones denegado", "info");
    }
  } catch(e) {
    showSalaToast("Error al activar notificaciones", "info");
  }
}

// Mostrar/ocultar botón de notificaciones según soporte del navegador
function checkNotifSupport() {
  const btn = document.getElementById("btn-notif");
  if (!btn) return;
  if ("Notification" in window && Notification.permission !== "denied") {
    btn.style.display = "inline-flex";
    if (Notification.permission === "granted") {
      btn.textContent = "🔔 NOTIF ON";
      btn.style.color = "#00ff88";
      btn.style.borderColor = "rgba(0,255,136,0.5)";
      btn.style.background = "rgba(0,255,136,0.12)";
    }
  }
}
