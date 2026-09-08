# INFORME — ALÍ BINARY OPTIONS PRO (app web)

**Ruta:** `C:\Users\usuario29\Documents\BOT\Alí Binary Opcion`
**Repo:** github.com/konfiozinc/ali-binary-opcion · **Rama:** main
**Fecha:** sesión actual

---

## 1. Qué es (arquitectura)

PWA **Firebase** (Auth correo/contraseña + Firestore) que publica **señales de trading
binario** a una "sala premium". Flujo actual:

```
index.html (login/registro) → roles.js (admin/user) → admin.html o sala.html
admin.html: el ADMIN crea/edita señales, marca WIN/LOSS/DOJI, gestiona usuarios
sala.html : usuarios ven señales activas + historial + estadísticas, con sonido
            y notificaciones push (FCM)
```

**Modelo de datos Firestore:** `users/{uid}`, `signals/{id}` (asset, broker,
direction, entryTime "HH:MM", expiration, status), `results/{id}`,
`settings/app` (mantenimiento), `audit_logs` (registro de acciones).

> Hoy las señales se **escriben a mano** por el admin. El objetivo declarado:
> que el **scanner (AppALI)** las publique automáticamente.

---

## 2. Problemas detectados y corregidos en esta sesión

### 2.1 Multi-admin por rol NO funcionaba (reglas vs UI)
- `roles.js` permite promover a `role='admin'`, pero `firebase.rules` solo daba
  permisos al email fijo → un admin promovido **abría el panel pero TODAS sus
  escrituras eran denegadas** por Firestore.
- **Corregido:** `isAdmin()` ahora lee el rol desde `users/{uid}` (o el email
  superadmin). Alineado con la UI.

### 2.2 Push (FCM): el usuario no podía guardar su token
- `saveFCMToken()` actualiza su propio documento `users/{uid}`, pero las reglas
  solo permitían `write: if isAdmin()` → **la actualización se denegaba** y los
  tokens nunca se guardaban (push masivo sin destinatarios).
- **Corregido:** regla `update` propia restringida solo a los campos
  `fcmToken/fcmUpdatedAt/fcmDevice` (no puede cambiarse rol/activo).

### 2.3 `audit_logs` no existía en las reglas → se denegaba todo
- `writeAuditLog()` escribe en `audit_logs`, pero las reglas no la cubrían →
  **ningún registro se guardaba** (la pestaña "Audit" y "actividad reciente"
  siempre vacías).
- **Corregido:** reglas para `audit_logs` (append autenticado, lectura/borrado
  admin). *Limitación:* al ser escritura cliente es falsable; el audit "serio"
  debería pasar por Cloud Functions (recomendado).

### 2.4 Auto-expiración de señales: código listo pero NUNCA invocado
- `startAutoExpire()`/`autoExpireSignals()` existían pero nada las llamaba → las
  señales `pending` quedaban eternas.
- **Corregido:** se invoca desde `admin.html` (solo el admin puede escribir el
  status según reglas; cada 2 min limpia las vencidas).

### 2.5 PWA/Service Worker con rutas absolutas rotas en GitHub Pages
- `index.html` registraba `'/sw.js'` (raíz del dominio) y `sala.html`
  `'/ali-binary-opcion/sw.js'` → inconsistente; `manifest.json` usaba
  `start_url:"/index.html"`. En GitHub Pages (que sirve en subcarpeta) el
  offline/instalación fallaba o apuntaba a la raíz.
- **Corregido:** todo relativo (`sw.js`, `start_url:"./index.html"`, `scope:"./"`).

### 2.6 Webhook de bot muerto e inseguro en el cliente (eliminado)
- `receiveBotWebhook()` con un secreto hardcodeado **no lo llamaba nadie** y, por
  estar en el navegador, no puede recibir HTTP (concepto inválido) + secreto
  expuesto.
- **Eliminado.** Se conserva `createBotSignal()` (esquema estándar de la señal
  de bot) y se documenta que la integración real será servidor→servidor.

---

## 3. Pendientes de configuración (no código, hay que publicar/desplegar)

1. **Publicar `firebase.rules`** en Firebase Console → Firestore → Reglas
   (los cambios en el repo NO aplican solos). Con ellos quedan activos: admin
   por rol, FCM propio y audit_logs.
2. **Desplegar la Cloud Function** `deleteAuthUser` (`CLOUD_FUNCTION_ELIMINAR_
   USUARIO.js` → `functions/index.js` + `firebase deploy --only functions`) para
   que "Eliminar usuario" borre también de Auth (hoy solo borra Firestore y deja
   una nota en audit).
3. **FCM:** revisar en Firebase Console que el par `messagingSenderId`/`appId` y
   el VAPID son del proyecto real `ali-binary-options` (los valores presentes
   parecen reales). Para push automático por señal hará falta un disparador.

---

## 4. Código que no sirve / se quitó

| Elemento | Acción |
|---|---|
| `receiveBotWebhook` + `BOT_SECRET` (signal-controller.js) | Eliminado (muerto e inseguro) |
| CSS responsive suelto al final de `index.html` (sin commitear) | Conservado y commiteado (mejora menor) |
| Resto de archivos | En uso (index/sala/admin, controladores, sw, manifest, cloud function de referencia) |

---

## 5. Mejoras propuestas (por impacto)

1. **Auditoría real vía Cloud Functions** (no desde el cliente): eventos
   confiables y no falsables.
2. **Push por señal (FCM topic/multicast)** desde un disparador de Firestore:
   al crearse `signals` → enviar notificación a tokens de `users` activos
   (elimina el "botón activar notificación" manual por usuario).
3. **Expiración robusta:** comparar con `Date.now()`/hora del broker, no con
   "hora de hoy" local; guardar `entryTime` en **epoch UTC** además del HH:MM
   (evita confusiones de zona horaria entre el admin y los usuarios).
4. **Estadísticas creíbles:** hoy WIN/LOSS los marca el admin a mano. Con el
   scanner se podrán registrar resultados automáticamente y calcular
   win-rate/expectancy reales.
5. **Formato de activo unificado** ("EUR/USD", "EUR/USD (OTC)", nunca "(OP)") y
   normalizar al publicar (ver §6).

---

## 6. Integración futura Scanner ↔ App (plan recomendado)

El scanner AppALI ya genera señales M1 (solo activos a 1 minuto, nombre para
pegar sin "(OP)"). Para que la sala las reciba en tiempo real:

**Opción A (recomendada) — Cloud Function HTTP + Firestore + FCM:**
```
[Scanner app_ali.py] --POST JSON--> [Cloud Function https.onRequest] 
        → valida secreto (server-side) → escribe Firestore signals/{id}
        → dispara push FCM a los tokens activos → sala.html muestra al instante
```
- Ventajas: sin credenciales en el cliente, único punto de validación,
  notificaciones incluidas, y reglas Firestore intactas (la función usa Admin).
- Requiere: desplegar 1 función + el scanner hace `urllib`/`requests` al URL de
  la función (el scanner ya tiene patrón de POST al puente WhatsApp).

**Opción B — El scanner escribe Firestore directo (cuenta de servicio):**
- Con `google-cloud-firestore` y un JSON de cuenta de servicio en el equipo del
  scanner (server-to-server; ignora reglas). Más simple si no se quiere
  desplegar funciones, pero añade manejo de credenciales en el equipo.

**Contrato del documento `signals` (compatible con `createBotSignal`):**
```jsonc
{
  "asset":      "EUR/USD",          // o "EUR/USD (OTC)"; NUNCA "(OP)"
  "broker":     "IQ Option",
  "direction":  "CALL" | "PUT",
  "entryTime":  "HH:MM",            // hora COT de entrada
  "expiration": 1,                  // minutos (scanner = 1)
  "status":     "pending",
  "source":     "bot",
  "botName":    "AppALI",
  "strategy":   "GSR",
  "confidence": 85,
  "rsi":        82.3,               // opcional, se muestra en la sala
  "damoa":      12.4
}
```
La sala ya suena + cronómetro + historial con ese esquema; el scanner debe
enviar `entryTime` en hora Colombia (ya la calcula) y el nombre de activo con
la nomenclatura del broker (`EUR/USD` real, `EUR/USD (OTC)` OTC).

**Extra deseable:** que el scanner pueda LEER `signals`/`results` (Firestore
REST o la Cloud Function) para retroalimentar el backtest con resultados reales.

---

## 7. Resumen de cambios en esta sesión

| Archivo | Cambio |
|---|---|
| `firebase.rules` | Admin por rol + update FCM propio + `audit_logs` |
| `manifest.json` | `start_url`/`scope` relativos (GitHub Pages) |
| `index.html` | SW relativo + conservado el CSS responsive |
| `sala.html` | SW relativo (antes ruta absoluta) |
| `admin.html` | Auto-expiración de señales conectada |
| `js/signal-controller.js` | Eliminado webhook muerto/inseguro; nota de integración |
| `INFORME_ALI_BINARY.md` | Este informe |

> Pendiente operativo: publicar `firebase.rules` en Firebase Console y (cuando
> se quiera) desplegar la Cloud Function de integración con el scanner.
