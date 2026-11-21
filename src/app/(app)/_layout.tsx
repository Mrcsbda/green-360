import { Redirect, Slot } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@/modules/auth/application/authStore';
import { AppShell } from '@/shared/layout/AppShell';

/** Rutas protegidas: sin sesión se redirige al login. */
export default function ProtectedLayout() {
  const { session, hydrated } = useAuthStore();
  if (!hydrated) return <View className="flex-1 items-center justify-center bg-white"><ActivityIndicator /></View>;
  if (!session) return <Redirect href="/login" />;
  return <AppShell><Slot /></AppShell>;
}
