import { Link, router, usePathname } from 'expo-router';
import { LogOut, Menu, ScanSearch, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MENU } from '@/core/navigation/menu';
import { colors } from '@/core/theme/tokens';
import { formatDate } from '@/core/utils/format';
import { AIAssistantPanel } from '@/modules/ai-insights/presentation/AIAssistantPanel';
import { useAuthStore } from '@/modules/auth/application/authStore';
import { useDataset } from '@/modules/customers/presentation/hooks';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { cn, IconButton } from '@/shared/components/ui';
import { ThemeToggle } from './ThemeToggle';

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));

function Logo() {
  return (
    <View className="flex-row items-center gap-2.5">
      <View className="w-8 h-8 rounded-lg bg-primary items-center justify-center"><ScanSearch size={18} color={colors.onPrimary} /></View>
      <View>
        <Text className="text-base font-semibold text-gray-900">Green 360°</Text>
        <Text className="text-[10px] text-gray-500 -mt-0.5">Operaciones y gestión comercial</Text>
      </View>
    </View>
  );
}

function Sidebar({ onNavigate, isWide }: { onNavigate?: () => void; isWide: boolean }) {
  const path = usePathname();
  const { session, logout } = useAuthStore();
  return (
    <View className="flex-1 bg-white">
      <View className="h-16 px-4 justify-center border-b border-gray-200"><Logo /></View>
      <ScrollView className="flex-1" contentContainerClassName="py-4 px-2 gap-6">
        {MENU.map((sec) => (
          <View key={sec.label}>
            <Text className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{sec.label}</Text>
            <View className="gap-1">
              {sec.items.filter((it) => !(isWide && it.wideHidden)).map((it) => {
                const active = isActive(path, it.href);
                return (
                  <Link key={it.href} href={it.href as never} asChild>
                    <Pressable onPress={onNavigate} accessibilityRole="link" accessibilityState={{ selected: active }}
                      className={cn('flex-row items-center gap-3 px-3 py-2 rounded-md', active ? 'bg-primary-50' : 'hover:bg-gray-50')}>
                      <it.icon size={16} color={active ? colors.primary : colors.muted} />
                      <Text className={cn('text-sm', active ? 'font-semibold text-primary' : 'text-gray-700')}>{it.label}</Text>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
      <View className="px-3 py-4 border-t border-gray-200 gap-3">
        <View className="flex-row items-center gap-2.5">
          <View className="w-8 h-8 rounded-full bg-primary-50 items-center justify-center"><Text className="text-xs font-bold text-primary">{session?.user.nombre.slice(0, 2).toUpperCase()}</Text></View>
          <View className="flex-1">
            <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>{session?.user.nombre}</Text>
            <Text className="text-xs text-gray-500">{session?.user.rol}</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={async () => { await logout(); router.replace('/login'); }} className="flex-row items-center gap-2 px-3 py-2 rounded-md border border-gray-200">
          <LogOut size={14} color={colors.danger} />
          <Text className="text-sm text-danger">Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TopBar({ onMenu }: { onMenu?: () => void }) {
  const { data } = useDataset();
  return (
    <View className="h-16 px-4 flex-row items-center gap-3 border-b border-gray-200 bg-white">
      {onMenu ? <IconButton icon={Menu} label="Abrir menú" onPress={onMenu} /> : null}
      {onMenu ? <View className="flex-1"><Logo /></View> : <View className="flex-1" />}
      {data ? (
        <Text className="text-xs text-gray-500 hidden sm:flex">Datos al {formatDate(data.rules.fechaReferencia)}</Text>
      ) : null}
      <ThemeToggle />
    </View>
  );
}

/** Escritorio: menú + análisis + panel IA. Tableta: menú + análisis. Móvil: menú en cajón y módulos apilados. */
export function AppShell({ children }: { children: ReactNode }) {
  const { isMobile, isWide } = useBreakpoint();
  const [drawer, setDrawer] = useState(false);
  return (
    <SafeAreaView edges={['top']} className="flex-1 flex-row bg-white">
      {!isMobile ? <View className="w-64 border-r border-gray-200"><Sidebar isWide={isWide} /></View> : null}
      <View className="flex-1 min-w-0">
        <TopBar onMenu={isMobile ? () => setDrawer(true) : undefined} />
        <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-3 sm:p-6">{children}</ScrollView>
      </View>
      {isWide ? <View className="w-96"><AIAssistantPanel /></View> : null}
      <Modal visible={isMobile && drawer} transparent animationType="fade" onRequestClose={() => setDrawer(false)}>
        <View className="flex-1 flex-row">
          <SafeAreaView className="w-72 bg-white">
            <View className="absolute right-2 top-3 z-10"><IconButton icon={X} label="Cerrar menú" onPress={() => setDrawer(false)} /></View>
            <Sidebar isWide={false} onNavigate={() => setDrawer(false)} />
          </SafeAreaView>
          <Pressable accessibilityLabel="Cerrar menú" className="flex-1 bg-black/50" onPress={() => setDrawer(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
