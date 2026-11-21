// Web: persistencia de sesión en el navegador (IndexedDB). La versión nativa está en auth.native.ts.
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

export const getFirebaseAuth = (): Auth => getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig));
