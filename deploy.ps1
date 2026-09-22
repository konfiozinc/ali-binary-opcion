# ============================================================
# DEPLOY.PS1 — Alí Binary Options Pro
# Publica las reglas de Firestore y las Cloud Functions.
#
# Requisitos:
#   1) Firebase CLI instalado:  npm install -g firebase-tools
#   2) Sesión iniciada:          firebase login
#   3) El secreto del bot ya está en functions\.env (gitignored,
#      NO se sube a GitHub). Verifica que exista antes de desplegar.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File deploy.ps1
# ============================================================

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ""
Write-Host "======== ALÍ BINARY OPTIONS PRO — DEPLOY ========" -ForegroundColor Cyan

# ── 0. Verificaciones previas ───────────────────────────────
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] No se encontró 'firebase'. Instálalo con: npm install -g firebase-tools" -ForegroundColor Red
    exit 1
}

$envPath = Join-Path $root "functions\.env"
if (-not (Test-Path $envPath)) {
    Write-Host "[AVISO] No existe functions\.env. Crea el archivo con:" -ForegroundColor Yellow
    Write-Host "        APPALI_SIGNAL_SECRET=TU_SECRETO_FUERTE" -ForegroundColor Yellow
    Write-Host "        (sin este secreto, postSignal rechazará todo: fail-closed)" -ForegroundColor Yellow
} else {
    Write-Host "[OK] functions\.env presente (secreto del bot)." -ForegroundColor Green
}

# ── 1. Reglas de Firestore ─────────────────────────────────
Write-Host ""
Write-Host "==> 1/3 Publicando reglas de Firestore..." -ForegroundColor Cyan
firebase deploy --only firestore:rules
if ($LASTEXITCODE -ne 0) { throw "Falló el deploy de reglas." }

# ── 2. Instalar dependencias de las funciones ───────────────
Write-Host ""
Write-Host "==> 2/3 Instalando dependencias de Cloud Functions..." -ForegroundColor Cyan
Push-Location (Join-Path $root "functions")
npm install
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Falló npm install." }
Pop-Location

# ── 3. Desplegar Cloud Functions ────────────────────────────
Write-Host ""
Write-Host "==> 3/3 Desplegando Cloud Functions..." -ForegroundColor Cyan
firebase deploy --only functions
if ($LASTEXITCODE -ne 0) { throw "Falló el deploy de funciones." }

Write-Host ""
Write-Host "======== DEPLOY COMPLETADO ========" -ForegroundColor Green
Write-Host "Recordatorio: las custom claims se propagan solas vía syncAdminClaim." -ForegroundColor Green
Write-Host "El claim tarda hasta 1 h (o fuerza refresh con getIdToken(true))." -ForegroundColor Green
