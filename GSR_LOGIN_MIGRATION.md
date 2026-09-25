# Migración Login GSR → Firebase (proyecto `ali-binary-options`)

Sustituye el backend PHP (`verificar_login.php` / `validar_sesion.php`) por
Cloud Functions. El front de `App GSR` ahora llama a:

- `https://us-central1-ali-binary-options.cloudfunctions.net/verificarLogin`
- `https://us-central1-ali-binary-options.cloudfunctions.net/validarSesion`

## Schema Firestore

### `cuentas/{trader_id}` (el doc id es el trader_id de 9 dígitos)
| Campo | Tipo | Descripción |
|---|---|---|
| `trader_id` | string | ID IQ Option de 9 dígitos |
| `nombre` | string | Primer nombre |
| `activo` | bool | `false` = cuenta bloqueada → devuelve `sin_acceso` |
| `licencia_hasta` | timestamp | Vencimiento de la licencia (fuente de verdad) |
| `acceso_temporal` | bool | `true` = acceso de prueba gratis |
| `updatedAt` | timestamp | Última actualización |

### `sesiones/{token}`
| Campo | Tipo | Descripción |
|---|---|---|
| `trader_id` | string | Cuenta asociada |
| `nombre` | string | Nombre |
| `recordar` | bool | `true` = 30 días; `false` = 24 h |
| `ip` | string | IP de origen |
| `es_pwa` / `event_id` / `fbc` / `fbp` | string | Tracking que envía el front |
| `expira` | timestamp | Vencimiento de la sesión |
| `createdAt` | timestamp | Creación |

### `rate_limits/login_<ip>`
Contador de intentos por IP (ventana 60 s, máx 10). Se borra/recicla solo.

## Importar cuentas

1. Configura el secreto (una sola vez):
   ```
   firebase functions:secrets:set GSR_IMPORT_SECRET
   ```

2. Llamar al endpoint (ejemplo con `curl`):
   ```
   curl -X POST https://us-central1-ali-binary-options.cloudfunctions.net/importarCuentas \
     -H "Content-Type: application/json" \
     -d '{"secret":"TU_SECRETO","cuentas":[
           {"trader_id":"123456789","nombre":"Juan","licencia_hasta":"2025-12-31"},
           {"trader_id":"987654321","nombre":"Ana","licencia_dias":30}
         ]}'
   ```
   `licencia_hasta` (ISO) y `licencia_dias` (entero) son alternativos.

## Deploy

```
powershell -ExecutionPolicy Bypass -File deploy.ps1
```
o manualmente:
```
firebase deploy --only firestore:rules
firebase deploy --only functions
```

## Notas
- **CORS**: por defecto `*`. Para restringirlo, configura el secreto
  `GSR_CORS_ORIGIN` con el origen de GitHub Pages (ej. `https://konfiozinc.github.io`).
- **Reglas**: `cuentas` solo la gestiona un admin autenticado o el backend (Admin SDK);
  `sesiones` y `rate_limits` son solo-backend (inaccesibles desde el cliente).
- Si despliegas las functions en otra región, actualiza `FUNCTIONS_BASE` en
  `BOT\App GSR\js\login.js`.
