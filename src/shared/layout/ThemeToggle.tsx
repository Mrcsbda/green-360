import { Moon, Sun } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useThemeStore } from '@/core/theme/ThemeProvider';
import { colors } from '@/core/theme/tokens';

export function ThemeToggle() {
  const { scheme, toggle } = useThemeStore();
  const dark = scheme === 'dark';
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: dark }} accessibilityLabel={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      onPress={toggle} hitSlop={6} className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100">
      {dark ? <Sun size={16} color={colors.warning} /> : <Moon size={16} color={colors.primary} />}
    </Pressable>
  );
}
