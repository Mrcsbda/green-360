import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { container } from '@/core/providers/container';
import type { Session } from '../domain/auth';

interface AuthState {
  session: Session | null;
  hydrated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/** Sesión persistida (sobrevive a recargas). Expira según `expiresAt`. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      hydrated: false,
      login: async (username, password) => {
        set({ session: await container.auth.login(username, password) });
      },
      logout: async () => {
        const s = get().session;
        if (s) await container.auth.logout(s);
        set({ session: null });
      },
    }),
    {
      name: 'g360.session.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ session: s.session }),
      onRehydrateStorage: () => (state) => {
        container.auth.restore(state?.session ?? null)
          .then((session) => useAuthStore.setState({ session, hydrated: true }))
          .catch(() => useAuthStore.setState({ session: null, hydrated: true }));
      },
    },
  ),
);
