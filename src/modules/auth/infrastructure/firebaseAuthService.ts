import { FirebaseError } from 'firebase/app';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { authReady } from '@/core/firebase/app';
import { getFirebaseAuth } from '@/core/firebase/auth';
import { loginEmailDomain } from '@/core/firebase/config';
import { InvalidCredentialsError, type AuthService, type Session } from '../domain/auth';

const toEmail = (username: string) => (username.includes('@') || !loginEmailDomain ? username.trim() : `${username.trim()}@${loginEmailDomain}`);

const toSession = (u: { uid: string; email: string | null; displayName: string | null }): Session => {
  const local = (u.email ?? '').split('@')[0];
  return { user: { username: local, nombre: u.displayName || local, rol: 'Operaciones' }, token: u.uid, expiresAt: Number.MAX_SAFE_INTEGER };
};

/** Firebase Auth (correo y contraseña). Firebase renueva el token; la sesión vive mientras Firebase la mantenga. */
export const firebaseAuthService: AuthService = {
  async login(username, password) {
    try {
      const cred = await signInWithEmailAndPassword(getFirebaseAuth(), toEmail(username), password);
      return toSession(cred.user);
    } catch (e) {
      if (e instanceof FirebaseError && ['auth/invalid-credential', 'auth/invalid-email', 'auth/user-not-found', 'auth/wrong-password'].includes(e.code)) {
        throw new InvalidCredentialsError();
      }
      if (e instanceof FirebaseError && e.code === 'auth/too-many-requests') throw new Error('Demasiados intentos. Espera unos minutos.');
      if (e instanceof FirebaseError && e.code === 'auth/network-request-failed') throw new Error('Sin conexión. Revisa tu red e inténtalo de nuevo.');
      throw e;
    }
  },
  async logout() { await signOut(getFirebaseAuth()); },
  async restore() {
    const u = await authReady();
    return u ? toSession(u) : null;
  },
};
