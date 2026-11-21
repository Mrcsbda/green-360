import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: 1 } } });

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}><ThemeProvider>{children}</ThemeProvider></QueryClientProvider>
    </SafeAreaProvider>
  );
}
