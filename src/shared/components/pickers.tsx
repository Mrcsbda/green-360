// Selectores de fecha y hora con el estilo de la app (mismo diseño en web, iOS y Android, claro y oscuro).
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal as RNModal, Pressable, Text, View } from 'react-native';
import { colors } from '@/core/theme/tokens';
import { todayIso } from '@/core/utils/dates';
import { cn } from './ui';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const pad = (n: number) => String(n).padStart(2, '0');
const label = (iso: string) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

function FieldShell({ label: l, error, icon: Icon, text, placeholder, onPress, onClear, className }: {
  label?: string; error?: string; icon: typeof CalendarDays; text: string; placeholder: string; onPress: () => void; onClear?: () => void; className?: string;
}) {
  return (
    <View className={cn('gap-1', className)}>
      {l ? <Text className="text-xs font-medium text-gray-700">{l}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`${l ?? placeholder}: ${text || 'sin seleccionar'}`} onPress={onPress}
        className={cn('flex-row items-center gap-2 bg-white border rounded-lg px-3 py-2 hover:border-primary', error ? 'border-red-400' : 'border-gray-300')}>
        <View className="p-1 rounded-md bg-primary-50"><Icon size={14} color={colors.primary} /></View>
        <Text className={cn('flex-1 text-sm', text ? 'text-gray-900' : 'text-gray-400')} numberOfLines={1}>{text || placeholder}</Text>
        {onClear && text ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Borrar fecha" hitSlop={8} onPress={onClear}><X size={14} color={colors.muted} /></Pressable>
        ) : null}
      </Pressable>
      {error ? <Text className="text-xs text-danger">{error}</Text> : null}
    </View>
  );
}

function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Cerrar" onPress={onClose} className="flex-1 bg-black/50 items-center justify-center p-4">
        {/* Pressable interno evita que un toque dentro de la tarjeta cierre el selector */}
        <Pressable onPress={() => {}} className="w-full max-w-[340px] bg-white rounded-2xl border border-gray-200 p-4 gap-3">{children}</Pressable>
      </Pressable>
    </RNModal>
  );
}

export function DatePicker({ value, onChange, label: l, error, placeholder = 'Seleccionar fecha', allowClear, min, max, className }: {
  value: string; onChange: (iso: string) => void; label?: string; error?: string; placeholder?: string; allowClear?: boolean; min?: string; max?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const base = value || todayIso();
  const [cursor, setCursor] = useState({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
  const [years, setYears] = useState(false);
  const today = todayIso();

  const show = () => { const b = value || today; setCursor({ y: Number(b.slice(0, 4)), m: Number(b.slice(5, 7)) - 1 }); setYears(false); setOpen(true); };
  const pick = (iso: string) => { onChange(iso); setOpen(false); };
  const move = (d: number) => setCursor(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));
  const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${cursor.y}-${pad(cursor.m + 1)}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  const disabled = (iso: string) => (!!min && iso < min) || (!!max && iso > max);
  const yearStart = cursor.y - 7;

  return (
    <>
      <FieldShell label={l} error={error} icon={CalendarDays} text={value ? label(value) : ''} placeholder={placeholder} onPress={show}
        onClear={allowClear ? () => onChange('') : undefined} className={className} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View className="flex-row items-center justify-between">
          <Pressable accessibilityRole="button" accessibilityLabel={years ? 'Años anteriores' : 'Mes anterior'} onPress={() => (years ? setCursor((c) => ({ ...c, y: c.y - 12 })) : move(-1))} className="p-2 rounded-full hover:bg-gray-100">
            <ChevronLeft size={18} color={colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Elegir año" onPress={() => setYears(!years)} className="px-3 py-1.5 rounded-full bg-primary-50">
            <Text className="text-sm font-semibold text-primary">{years ? `${yearStart} – ${yearStart + 11}` : `${MONTHS[cursor.m]} ${cursor.y}`}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={years ? 'Años siguientes' : 'Mes siguiente'} onPress={() => (years ? setCursor((c) => ({ ...c, y: c.y + 12 })) : move(1))} className="p-2 rounded-full hover:bg-gray-100">
            <ChevronRight size={18} color={colors.text} />
          </Pressable>
        </View>

        {years ? (
          <View className="flex-row flex-wrap">
            {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => (
              <View key={y} style={{ width: '25%' }} className="p-1">
                <Pressable accessibilityRole="button" onPress={() => { setCursor((c) => ({ ...c, y })); setYears(false); }}
                  className={cn('py-2.5 rounded-lg items-center', y === cursor.y ? 'bg-primary' : 'hover:bg-gray-100')}>
                  <Text className={cn('text-sm', y === cursor.y ? 'font-semibold text-on-primary' : 'text-gray-800')}>{y}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View>
            <View className="flex-row">{DOW.map((d, i) => <Text key={i} className="flex-1 text-center text-[11px] font-semibold text-gray-500 pb-1">{d}</Text>)}</View>
            <View className="flex-row flex-wrap">
              {cells.map((d, i) => {
                const sel = d === value;
                const off = !!d && disabled(d);
                return (
                  <View key={i} style={{ width: `${100 / 7}%` }} className="items-center py-0.5">
                    {d ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={label(d)} accessibilityState={{ selected: sel, disabled: off }} disabled={off} onPress={() => pick(d)}
                        className={cn('w-9 h-9 rounded-full items-center justify-center', sel ? 'bg-primary' : d === today ? 'border border-accent' : 'hover:bg-primary-50', off && 'opacity-30')}>
                        <Text className={cn('text-sm', sel ? 'font-semibold text-on-primary' : d === today ? 'font-semibold text-accent' : 'text-gray-800')}>{Number(d.slice(8))}</Text>
                      </Pressable>
                    ) : <View className="w-9 h-9" />}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View className="flex-row items-center justify-between border-t border-gray-200 pt-3">
          <Pressable accessibilityRole="button" onPress={() => pick(today)} disabled={disabled(today)} className="px-3 py-1.5 rounded-lg bg-primary-50">
            <Text className="text-xs font-semibold text-primary">Hoy</Text>
          </Pressable>
          <View className="flex-row gap-2">
            {allowClear && value ? <Pressable accessibilityRole="button" onPress={() => pick('')} className="px-3 py-1.5"><Text className="text-xs font-medium text-danger">Borrar</Text></Pressable> : null}
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} className="px-3 py-1.5"><Text className="text-xs font-medium text-gray-600">Cancelar</Text></Pressable>
          </View>
        </View>
      </Sheet>
    </>
  );
}

const HOURS = Array.from({ length: 16 }, (_, i) => pad(i + 6)); // 06–21
const MINUTES = ['00', '15', '30', '45'];

export function TimePicker({ value, onChange, label: l, error, className }: { value: string; onChange: (hhmm: string) => void; label?: string; error?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(value.slice(0, 2) || '09');
  const [m, setM] = useState(value.slice(3, 5) || '00');
  const show = () => { setH(value.slice(0, 2) || '09'); setM(MINUTES.includes(value.slice(3, 5)) ? value.slice(3, 5) : '00'); setOpen(true); };
  const cell = (txt: string, sel: boolean, onPress: () => void) => (
    <Pressable key={txt} accessibilityRole="button" accessibilityState={{ selected: sel }} onPress={onPress}
      className={cn('w-12 py-2 rounded-lg items-center', sel ? 'bg-primary' : 'bg-gray-50 hover:bg-primary-50')}>
      <Text className={cn('text-sm', sel ? 'font-semibold text-on-primary' : 'text-gray-800')}>{txt}</Text>
    </Pressable>
  );
  return (
    <>
      <FieldShell label={l} error={error} icon={Clock} text={value} placeholder="Seleccionar hora" onPress={show} className={className} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <Text className="text-center text-2xl font-bold text-gray-900">{h}:{m}</Text>
        <Text className="text-xs font-semibold text-gray-500 uppercase">Hora</Text>
        <View className="flex-row flex-wrap gap-1.5">{HOURS.map((x) => cell(x, x === h, () => setH(x)))}</View>
        <Text className="text-xs font-semibold text-gray-500 uppercase">Minutos</Text>
        <View className="flex-row flex-wrap gap-1.5">{MINUTES.map((x) => cell(x, x === m, () => setM(x)))}</View>
        <View className="flex-row justify-end gap-2 border-t border-gray-200 pt-3">
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} className="px-3 py-1.5"><Text className="text-xs font-medium text-gray-600">Cancelar</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { onChange(`${h}:${m}`); setOpen(false); }} className="px-4 py-1.5 rounded-lg bg-primary"><Text className="text-xs font-semibold text-on-primary">Aceptar</Text></Pressable>
        </View>
      </Sheet>
    </>
  );
}
