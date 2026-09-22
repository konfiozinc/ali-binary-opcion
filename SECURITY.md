# 🔐 SECURITY.md — Alí Binary Options Pro

Documento de seguridad y robustez. Resume las correcciones aplicadas y las
acciones pendientes que requieren configuración en Firebase Console.

---

## 1. Correcciones aplicadas en este cambio

| # | Hallazgo | Severidad | Corrección |
|---|----------|-----------|------------|
| 1 | `audit_logs`: cualquier usuario autenticado podía inyectar logs falsos | 🔴 Crítica | `allow create` ahora exige `uid == request.auth.uid`, `email == token.email` y `action` válido (string, 1–80 chars). Los logs son inmutables (`update: if false`). Los logs del sistema se escriben desde Cloud Functions con Admin SDK. |
| 2 | `isAdmin()` con `get()` frágil/ineficiente en reglas | 🔴 Crítica | Se añadió `request.auth.token.admin == true` (custom claims) como vía rápida + fallback transitorio de 1 sola lectura. Se creó `syncAdminClaim` para sincronizar claims automáticamente. |
| 3 | **Escalada de privilegios**: un usuario podía auto-asignarse `role: "admin"` al crear su documento | 🔴 Crítica | `allow create` en `users` ahora fuerza `role == "user"` (solo el SuperAdmin obtiene `admin`). |
| 4 | Email del SuperAdmin inconsistente entre archivos | 🔴 Crítica | Unificado en `damoatrader1015@gmail.com` (reglas, auth, roles, admin, functions, README). Fuente única frontend: `window.SUPER_ADMIN_EMAIL`. |
| 5 | Falta de validación en registro | 🟠 Alta | Validación en `registerUser()` y `loginUser()` (email regex, contraseña ≥ 6, campos vacíos). Uso de `cred.user.email` canónico para Firestore. |
| 6 | Service Worker con caché agresiva | 🟠 Alta | Reescrito: HTML/navegación → **network-first**; assets estáticos → **cache-first** con revalidación; `CACHE_VERSION` con limpieza automática de cachés viejas. |
| 7 | Redirección potencialmente infinita | 🟠 Alta | `navigate()` con guarda anti-bucle en `roles.js` + flag `_redirecting` con `try/catch` en `index.html`. |
| 8 | Sonido no fiable en iOS | 🟠 Media | AudioContext único reutilizable + `unlockAudioOnInteraction()` en el primer tap/clic/tecla. |
| 9 | Secreto del bot con fallback inseguro | 🔴 Crítica | `APPALI_SIGNAL_SECRET` ahora es *fail-closed*: sin secreto configurado, `postSignal` rechaza todo (401). |
| 10 | Sin rate limiting en señales | 🟠 Alta | `postSignal` (vía del bot/scanner) limita a 1 señal cada 10 s (429). |

---

## 2. Acciones pendientes en Firebase Console (manual)

### 2.1 Publicar las reglas de Firestore
1. Firebase Console → **Firestore Database** → pestaña **Rules**.
2. Pega el contenido de [`firebase.rules`](./firebase.rules) y pulsa **Publicar**.
3. Verifica: un usuario normal ya no puede crear `users/{uid}` con `role: "admin"`.

### 2.2 Migrar roles a Custom Claims (recomendado)
Ya está preparado el mecanismo automático (`syncAdminClaim`). Para activarlo:

```bash
cd functions
npm install
firebase deploy --only functions
```

- Al desplegar, cada cambio en `users/{uid}.role` sincroniza el claim `admin`
  del token de ese usuario.
- El claim tarda en propagarse (hasta 1 h) o se fuerza con
  `user.getIdToken(true)` en el cliente. Mientras tanto, el fallback de reglas
  por `role` sigue funcionando, así que **no hay interrupción**.
- Para fijar un claim manualmente desde el panel admin:
  `firebase.functions().httpsCallable("setAdminClaim")({ uid, admin: true })`.

### 2.3 Restringir la API Key y activar App Check
Las credenciales públicas (`apiKey`, `appId`, …) son normales en apps web, pero
deben acotarse:

1. **Restringir API Key** — Google Cloud Console → *APIs & Services* → *Credentials*:
   - *Application restrictions* → **HTTP referrers** → añade
     `konfiozinc.github.io/*` y `localhost` (para desarrollo).
   - *API restrictions* → limita a **Identity Toolkit API**, **Firebase Cloud
     Messaging API** y **Cloud Firestore API**.
2. **App Check** — Firebase Console → **App Check** → registrar la app web con
   reCAPTCHA v3. Después, activar en `js/firebase-config.js` (ya está documentado
   el snippet). ⚠️ No activar sin haber registrado el sitio.

### 2.4 Configurar el secreto del bot
`postSignal` lee `APPALI_SIGNAL_SECRET` desde `functions/.env` (la CLI la carga
como variable de entorno al desplegar). Ese archivo está **gitignored** y ya existe
localmente; verifica que tenga un valor fuerte:

```
APPALI_SIGNAL_SECRET=TU_SECRETO_LARGO_Y_ALEATORIO
```

El scanner debe enviar `{ secret, asset, direction, entryTime, expiration, ... }`
con ese mismo valor. Sin secreto, la función rechaza todo (fail-closed).
(Alternativa más robusta: migrar a Secret Manager con `firebase functions:secrets:set`
y `runWith({ secrets: [...] })`.)

### 2.5 Desplegar reglas + funciones (un solo comando)
En la máquina donde esté la CLI (`npm i -g firebase-tools` + `firebase login`):

```powershell
powershell -ExecutionPolicy Bypass -File deploy.ps1
```

Esto publica `firebase.rules`, instala dependencias y despliega las funciones.
Requiere el proyecto `ali-binary-options` (ya configurado en `.firebaserc`).

---

## 3. Recomendaciones pendientes (mejora continua)

| Mejora | Prioridad | Notas |
|--------|-----------|-------|
| Rate limiting también para señales creadas por admin desde el cliente | Media | El panel admin está protegido por `isAdmin()`, pero un límite server-side vía Cloud Function `createSignal` sería más robusto. |
| Paginación en historial y usuarios | Media | Hoy se cargan hasta 100+ docs (`get()`). Usar `limit()` + cursores. |
| Pruebas automatizadas | Alta | Añadir tests de reglas (Firestore Rules Unit Tests) y de UI (login/registro/señal). |
| Modo offline con UI | Media | La persistencia de Firestore ya está; falta indicador de "sin conexión". |
| Internacionalización (i18n) | Baja | Textos hardcodeados en español. |
| Rotación de claves / auditoría de acceso | Media | Revisar periódicamente quién tiene acceso a la consola y a `.secrets/`. |

---

## 4. Secretos

- `functions/.env` está **gitignored** (no se versiona).
- `.secrets/` del workspace local **nunca** debe subirse a GitHub.
- Nunca pongas el `APPALI_SIGNAL_SECRET` ni la clave privada del service account
  en el repositorio.
