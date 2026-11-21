// Variables públicas de Firebase (el apiKey web de Firebase es un identificador, no un secreto:
// la seguridad la dan Firebase Auth y las reglas de firestore.rules).
// Deben leerse con process.env.EXPO_PUBLIC_* literal para que Expo las incluya en el bundle.
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

/** Dominio para iniciar sesión con usuario corto (operativo1 → operativo1@<dominio>). */
export const loginEmailDomain = process.env.EXPO_PUBLIC_LOGIN_EMAIL_DOMAIN ?? '';

export const firebaseEnabled = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
