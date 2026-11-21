// iOS / Android: la sesión de Firebase Auth se guarda en AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { firebaseConfig } from './config';

// getReactNativePersistence solo existe en la build react-native de firebase/auth (los tipos por defecto no lo declaran).
const { getReactNativePersistence } = FirebaseAuth as unknown as {
  getReactNativePersistence: (s: typeof AsyncStorage) => FirebaseAuth.Persistence;
};

let auth: FirebaseAuth.Auth | null = null;
export function getFirebaseAuth(): FirebaseAuth.Auth {
  if (auth) return auth;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  try {
    auth = FirebaseAuth.initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    auth = FirebaseAuth.getAuth(app); // ya inicializado (recarga en caliente)
  }
  return auth;
}
