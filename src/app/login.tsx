import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, router } from 'expo-router';
import { Lock, ScanSearch } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { colors } from '@/core/theme/tokens';
import { useAuthStore } from '@/modules/auth/application/authStore';
import { loginSchema, type LoginForm } from '@/modules/auth/domain/auth';
import { Button, ErrorState, Input } from '@/shared/components/ui';
import { ThemeToggle } from '@/shared/layout/ThemeToggle';

export default function LoginScreen() {
  const { session, hydrated, login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema), defaultValues: { username: '', password: '' },
  });
  if (hydrated && session) return <Redirect href="/" />;

  const onSubmit = handleSubmit(async (f) => {
    setError(null);
    try {
      await login(f.username, f.password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión');
    }
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-gray-50">
      <ScrollView contentContainerClassName="flex-grow items-center justify-center p-4">
        <View className="absolute top-4 right-4"><ThemeToggle /></View>
        <View className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-6 gap-5">
          <View className="items-center gap-2">
            <View className="w-12 h-12 rounded-xl bg-primary items-center justify-center"><ScanSearch size={24} color={colors.onPrimary} /></View>
            <Text accessibilityRole="header" className="text-xl font-bold text-gray-900">Green 360°</Text>
            <Text className="text-sm text-gray-500 text-center">Dashboard de operaciones y gestión comercial</Text>
          </View>
          <Controller control={control} name="username" render={({ field }) => (
            <Input label="Usuario o correo" autoCapitalize="none" autoComplete="username" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.username?.message} placeholder="usuario@empresa.com" />
          )} />
          <Controller control={control} name="password" render={({ field }) => (
            <Input label="Contraseña" secureTextEntry autoComplete="password" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message} onSubmitEditing={() => onSubmit()} />
          )} />
          {error ? <ErrorState message={error} /> : null}
          <Button label="Iniciar sesión" icon={Lock} onPress={onSubmit} loading={isSubmitting} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
