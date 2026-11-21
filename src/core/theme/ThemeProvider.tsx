import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';
import { Fragment, useLayoutEffect, type ReactNode } from 'react';
import { Appearance, View } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { setPaletteScheme, type Scheme } from './tokens';

interface ThemeState { scheme: Scheme; toggle: () => void }

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      scheme: Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
      toggle: () => set({ scheme: get().scheme === 'dark' ? 'light' : 'dark' }),
    }),
    { name: 'g360.theme.v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Aplica el modo (clase `dark` → variables CSS) y vuelve a montar el árbol para que íconos y gráficas tomen la paleta nueva. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useThemeStore((s) => s.scheme);
  setPaletteScheme(scheme);
  useLayoutEffect(() => { colorScheme.set(scheme); }, [scheme]);
  return <View className="flex-1 bg-gray-50"><Fragment key={scheme}>{children}</Fragment></View>;
}
