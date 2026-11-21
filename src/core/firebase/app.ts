import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseConfig } from './config';
import { getFirebaseAuth } from './auth';

export const firebaseApp = () => (getApps().length ? getApp() : initializeApp(firebaseConfig));

let db: Firestore | null = null;
export function firestore(): Firestore {
  // ignoreUndefinedProperties: los campos opcionales vacíos (p. ej. fechaAlta) no rompen la escritura
  db ??= initializeFirestore(firebaseApp(), { ignoreUndefinedProperties: true });
  return db;
}

let ready: Promise<User | null> | null = null;
/** Resuelve cuando Firebase Auth restauró (o no) la sesión guardada. */
export function authReady(): Promise<User | null> {
  ready ??= new Promise((resolve) => {
    const off = onAuthStateChanged(getFirebaseAuth(), (u) => { off(); resolve(u); });
  });
  return ready;
}

/** Firestore exige usuario autenticado (ver firestore.rules). */
export async function requireUser(): Promise<User> {
  const u = getFirebaseAuth().currentUser ?? (await authReady());
  if (!u) throw new Error('La sesión expiró. Inicia sesión de nuevo.');
  return u;
}
