// Componentes base del sistema de diseño (estilo del template: tarjetas blancas, bordes gray-200, rounded-xl).
import type { LucideIcon } from 'lucide-react-native';
import { AlertTriangle, Inbox, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Modal as RNModal, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '@/core/theme/tokens';

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>{children}</View>;
}

export function SectionTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-2 mb-3">
      <View className="flex-1 min-w-[200px]">
        <Text accessibilityRole="header" className="text-base font-semibold text-gray-900">{title}</Text>
        {subtitle ? <Text className="text-xs text-gray-500 mt-0.5">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View className="flex-row flex-wrap items-end justify-between gap-3 mb-5">
      <View className="flex-1 min-w-[220px]">
        <Text accessibilityRole="header" className="text-2xl font-bold text-gray-900">{title}</Text>
        {subtitle ? <Text className="text-sm text-gray-500 mt-1">{subtitle}</Text> : null}
      </View>
      {right ? <View className="flex-row flex-wrap gap-2">{right}</View> : null}
    </View>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
// Función (no constante) para que los íconos tomen la paleta del modo activo.
const btn = (v: BtnVariant): { box: string; text: string; icon: string } => ({
  primary: { box: 'bg-primary border-primary', text: 'text-on-primary', icon: colors.onPrimary },
  secondary: { box: 'bg-white border-gray-300', text: 'text-gray-800', icon: colors.text },
  ghost: { box: 'bg-transparent border-transparent', text: 'text-gray-700', icon: colors.text },
  danger: { box: 'bg-white border-red-200', text: 'text-danger', icon: colors.danger },
  success: { box: 'bg-positive border-positive', text: 'text-on-primary', icon: colors.onPrimary },
})[v];

export function Button({ label, onPress, variant = 'primary', icon: Icon, disabled, loading, size = 'md', accessibilityLabel }: {
  label: string; onPress?: () => void; variant?: BtnVariant; icon?: LucideIcon; disabled?: boolean; loading?: boolean; size?: 'sm' | 'md'; accessibilityLabel?: string;
}) {
  const v = btn(variant);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      className={cn('flex-row items-center justify-center gap-2 rounded-lg border hover:opacity-90', size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2.5', v.box, (disabled || loading) && 'opacity-50')}
    >
      {loading ? <ActivityIndicator size="small" color={v.icon} /> : Icon ? <Icon size={16} color={v.icon} /> : null}
      <Text className={cn('font-medium', size === 'sm' ? 'text-xs' : 'text-sm', v.text)}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon: Icon, onPress, label, color }: { icon: LucideIcon; onPress: () => void; label: string; color?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} className="p-2 rounded-lg hover:bg-gray-100">
      <Icon size={18} color={color ?? colors.text} />
    </Pressable>
  );
}

export function Badge({ label, tone = 'gray', dot }: { label: string; tone?: 'gray' | 'green' | 'teal' | 'lime' | 'red' | 'amber' | 'primary'; dot?: string }) {
  const t = {
    gray: 'bg-gray-100 text-gray-700', green: 'bg-green-100 text-green-800', teal: 'bg-teal-100 text-teal-800', lime: 'bg-lime-100 text-lime-800',
    red: 'bg-red-100 text-red-800', amber: 'bg-amber-100 text-amber-800', primary: 'bg-primary-50 text-primary',
  }[tone];
  const [bg, fg] = t.split(' ');
  return (
    <View className={cn('flex-row items-center self-start gap-1.5 px-2 py-0.5 rounded-full', bg)}>
      {dot ? <View style={{ backgroundColor: dot }} className="w-2 h-2 rounded-full" /> : null}
      <Text className={cn('text-xs font-medium', fg)}>{label}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={cn('flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border', selected ? 'bg-primary border-primary' : 'bg-white border-gray-300')}
    >
      {color ? <View style={{ backgroundColor: color }} className="w-2.5 h-2.5 rounded-full" /> : null}
      <Text className={cn('text-xs font-medium', selected ? 'text-on-primary' : 'text-gray-700')}>{label}</Text>
    </Pressable>
  );
}

export function Input({ label, error, className, ...props }: TextInputProps & { label?: string; error?: string; className?: string }) {
  return (
    <View className={cn('gap-1', className)}>
      {label ? <Text className="text-xs font-medium text-gray-700">{label}</Text> : null}
      <TextInput
        accessibilityLabel={label ?? props.placeholder}
        placeholderTextColor={colors.muted}
        className={cn('bg-white border rounded-lg px-3 py-2 text-sm text-gray-900', error ? 'border-red-400' : 'border-gray-300')}
        {...props}
      />
      {error ? <Text className="text-xs text-danger">{error}</Text> : null}
    </View>
  );
}

/** Selector de una opción con chips (funciona igual en web y en móvil). */
export function Select<T extends string>({ label, value, options, onChange, error, allowEmpty }: {
  label?: string; value: T | ''; options: readonly { value: T; label: string }[] | readonly T[]; onChange: (v: T | '') => void; error?: string; allowEmpty?: string;
}) {
  const opts = (options as readonly (T | { value: T; label: string })[]).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <View className="gap-1">
      {label ? <Text className="text-xs font-medium text-gray-700">{label}</Text> : null}
      <View className="flex-row flex-wrap gap-1.5">
        {allowEmpty ? <Chip label={allowEmpty} selected={value === ''} onPress={() => onChange('')} /> : null}
        {opts.map((o) => <Chip key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} />)}
      </View>
      {error ? <Text className="text-xs text-danger">{error}</Text> : null}
    </View>
  );
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} className="gap-3 p-2">
      {[0, 1, 2].map((i) => <View key={i} className="h-16 rounded-xl bg-gray-100" />)}
      <View className="flex-row items-center gap-2"><ActivityIndicator color={colors.primary} /><Text className="text-sm text-gray-500">{label}</Text></View>
    </View>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <View className="items-center justify-center py-10 px-4 gap-2">
      <Inbox size={28} color={colors.muted} />
      <Text className="text-sm font-semibold text-gray-800 text-center">{title}</Text>
      {description ? <Text className="text-xs text-gray-500 text-center max-w-md">{description}</Text> : null}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" className="flex-row flex-wrap items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
      <AlertTriangle size={18} color={colors.danger} />
      <Text className="flex-1 text-sm text-red-800 min-w-[180px]">{message}</Text>
      {onRetry ? <Button label="Reintentar" size="sm" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning'; children: ReactNode }) {
  const cls = { info: 'bg-teal-50 border-teal-200', success: 'bg-green-50 border-green-200', warning: 'bg-amber-50 border-amber-200' }[tone];
  const txt = { info: 'text-teal-900', success: 'text-green-900', warning: 'text-amber-900' }[tone];
  return <View accessibilityRole={tone === 'info' ? undefined : 'alert'} className={cn('p-3 rounded-lg border', cls)}><Text className={cn('text-xs', txt)}>{children}</Text></View>;
}

export function Modal({ visible, onClose, title, children, wide }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 items-center justify-center p-3">
        <View className={cn('bg-white rounded-xl w-full max-h-[92%]', wide ? 'max-w-5xl' : 'max-w-xl')}>
          <View className="flex-row items-center justify-between px-5 h-14 border-b border-gray-200">
            <Text accessibilityRole="header" className="text-base font-semibold text-gray-900 flex-1">{title}</Text>
            <IconButton icon={X} label="Cerrar" onPress={onClose} />
          </View>
          <ScrollView contentContainerClassName="p-5 gap-4">{children}</ScrollView>
        </View>
      </View>
    </RNModal>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (t: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <View accessibilityRole="tablist" className="flex-row flex-wrap gap-1 p-1 bg-gray-100 rounded-lg self-start mb-4">
      {tabs.map((t) => (
        <Pressable key={t.value} accessibilityRole="tab" accessibilityState={{ selected: value === t.value }} onPress={() => onChange(t.value)}
          className={cn('px-3 py-1.5 rounded-md flex-row items-center gap-1.5', value === t.value && 'bg-white border border-gray-200')}>
          <Text className={cn('text-sm', value === t.value ? 'font-semibold text-gray-900' : 'text-gray-600')}>{t.label}</Text>
          {t.count !== undefined ? <Text className="text-xs text-gray-500">{t.count}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

