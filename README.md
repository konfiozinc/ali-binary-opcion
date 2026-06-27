# ALI BINARY OPTIONS PRO — Guía de Configuración

## Estructura del Proyecto
```
/
├── index.html          ← Login / Registro
├── admin.html          ← Panel Administrador (solo damoa1510qtrading@gmail.com)
├── sala.html           ← Sala Premium usuarios
├── manifest.json       ← PWA Manifest
├── sw.js               ← Service Worker
├── firebase.rules      ← Reglas de seguridad Firestore
└── js/
    ├── firebase-config.js
    ├── auth.js
    ├── roles.js
    ├── signal-controller.js
    ├── users-controller.js
    ├── admin-controller.js
    └── sala-controller.js
```

---

## PASO 1 — Crear proyecto Firebase

1. Ve a https://console.firebase.google.com
2. Clic en **"Agregar proyecto"** → nombre: `ali-binary-options`
3. Desactiva Google Analytics si no lo necesitas
4. **Authentication** → Activar → Correo/contraseña
5. **Firestore** → Crear base de datos → modo **producción**
6. **Hosting** (opcional) → Activar

---

## PASO 2 — Obtener credenciales

1. En tu proyecto Firebase → **⚙️ Configuración del proyecto**
2. Baja a **"Tus apps"** → Agrega app web `</>`
3. Copia el objeto `firebaseConfig`
4. Abre `js/firebase-config.js` y **reemplaza** los valores:

```js
const firebaseConfig = {
  apiKey:            "TU_API_KEY",          // ← cambiar
  authDomain:        "ali-binary-options.firebaseapp.com",
  projectId:         "ali-binary-options",
  storageBucket:     "ali-binary-options.appspot.com",
  messagingSenderId: "TU_SENDER_ID",         // ← cambiar
  appId:             "TU_APP_ID"             // ← cambiar
};
```

---

## PASO 3 — Aplicar reglas Firestore

1. En Firebase Console → **Firestore** → **Reglas**
2. Copia el contenido de `firebase.rules` y pégalo
3. Clic en **Publicar**

---

## PASO 4 — Crear cuenta Admin

1. Abre `index.html` en el navegador
2. Ve a la pestaña **REGISTRO**
3. Regístrate con el email: `damoatrader1015@gmail.com`
4. Serás redirigido automáticamente al panel admin

---

## PASO 5 — Publicar en GitHub Pages

```bash
# Inicializar repositorio
git init
git add .
git commit -m "Initial: Ali Binary Options Pro"

# Subir a GitHub
git remote add origin https://github.com/TU_USUARIO/ali-binary-options.git
git push -u origin main

# En GitHub: Settings → Pages → Source: main branch
```

**Importante:** GitHub Pages sirve desde HTTPS → PWA funcionará correctamente.

---

## PASO 6 — Instalar como PWA

- **Android:** Chrome → menú ⋮ → "Instalar aplicación"
- **iPhone:** Safari → compartir → "Agregar a pantalla de inicio"
- **Desktop:** Chrome → icono instalar en barra de URL

---

## Funcionalidades

| Función | Admin | Usuario |
|---------|-------|---------|
| Login / Registro | ✅ | ✅ |
| Ver señales activas | ✅ | ✅ |
| Ver historial | ✅ | ✅ |
| Crear señal | ✅ | ❌ |
| Editar señal | ✅ | ❌ |
| Marcar WIN/LOSS/DRAW | ✅ | ❌ |
| Gestionar usuarios | ✅ | ❌ |
| Bloquear usuarios | ✅ | ❌ |
| Ver estadísticas | ✅ | ✅ |

---

## Estructura Firestore

```
users/{uid}
  uid, nombre, email, role, activo, createdAt

signals/{id}
  asset, broker, direction, entryTime, expiration, status, createdAt

results/{id}
  signalId, result, createdAt

settings/{doc}
  version, maintenance
```

---

## Soporte
Propietario: Darwin Montalvo  
Admin email: damoatrader1015@gmail.com
