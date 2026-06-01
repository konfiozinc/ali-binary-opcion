// ============================================================
// FIREBASE CONFIG — ALI BINARY OPTIONS PRO
// Reemplaza estos valores con los de tu proyecto Firebase
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDRfZYY3d4ul1PJEp-KMHMYfbkT6QULk3U",
  authDomain: "ali-binary-options.firebaseapp.com",
  databaseURL: "https://ali-binary-options-default-rtdb.firebaseio.com",
  projectId: "ali-binary-options",
  storageBucket: "ali-binary-options.firebasestorage.app",
  messagingSenderId: "215991454083",
  appId: "1:215991454083:web:97423f29d542dcfc74ceb6",
  measurementId: "G-CDXNMWGHJD"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Exportar servicios globales
const auth = firebase.auth();
const db   = firebase.firestore();

// Persistencia de sesión LOCAL (sobrevive cierre de pestaña)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
