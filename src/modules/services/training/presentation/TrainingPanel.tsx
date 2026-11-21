import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, ChevronRight, Plus, Save, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import { container } from '@/core/providers/container';
import { colors, segmentColors } from '@/core/theme/tokens';
import { todayIso } from '@/core/utils/dates';
import { newId } from '@/core/utils/id';
import { formatDate } from '@/core/utils/format';
import { Badge, Button, Card, Chip, cn, EmptyState, ErrorState, IconButton, LoadingState, Modal, SectionTitle } from '@/shared/components/ui';
import { ChoiceField, DateField, TextField, TimeField } from '../../FormFields';
import { useCrud } from '../../useCrud';
import { MODALITIES, TRAINING_STATES, trainingSchema, type Training } from '../domain/training';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DOW = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const STATE_TONE = { programada: 'teal', realizada: 'green', cancelada: 'gray' } as const;
const stateColor = (s: Training['estado']) => ({ programada: segmentColors.frio, realizada: segmentColors.frecuente, cancelada: segmentColors.sin_segmentar })[s];
const pad = (n: number) => String(n).padStart(2, '0');

function TrainingForm({ initial, onDone }: { initial: Training; onDone: () => void }) {
  const { save, remove } = useCrud('trainings', container.trainings);
  const { control, handleSubmit, formState: { errors } } = useForm<Training>({ resolver: zodResolver(trainingSchema), defaultValues: initial });
  const isNew = initial.nombre === '';
  return (
    <>
      <TextField control={control} name="nombre" label="Nombre de la capacitación *" errors={errors} />
      <View className="flex-row flex-wrap gap-3">
        <DateField control={control} name="fecha" label="Fecha *" errors={errors} />
        <TimeField control={control} name="hora" label="Hora *" errors={errors} />
      </View>
      <View className="flex-row flex-wrap gap-3">
        <TextField control={control} name="responsable" label="Responsable *" errors={errors} />
        <TextField control={control} name="cliente" label="Cliente o empresa *" errors={errors} />
      </View>
      <ChoiceField control={control} name="modalidad" label="Modalidad" options={MODALITIES} errors={errors} />
      <ChoiceField control={control} name="estado" label="Estado" options={TRAINING_STATES} errors={errors} />
      <TextField control={control} name="observaciones" label="Observaciones" errors={errors} multiline className="w-full" />
      {save.error ? <ErrorState message={save.error.message} /> : null}
      <View className="flex-row gap-2">
        <Button label="Guardar" icon={Save} loading={save.isPending} onPress={handleSubmit(async (t) => { await save.mutateAsync(t); onDone(); })} />
        {!isNew ? <Button label="Eliminar" icon={Trash2} variant="danger" onPress={async () => { await remove.mutateAsync(initial.id); onDone(); }} /> : null}
      </View>
    </>
  );
}

export function TrainingPanel() {
  const { list } = useCrud('trainings', container.trainings);
  const today = todayIso();
  const [cursor, setCursor] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 });
  const [selected, setSelected] = useState<string>(today);
  const [estado, setEstado] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [editing, setEditing] = useState<Training | null>(null);

  const items = useMemo(() => (list.data ?? []).filter((t) => (!estado || t.estado === estado) && (!modalidad || t.modalidad === modalidad)), [list.data, estado, modalidad]);
  const byDay = useMemo(() => {
    const m = new Map<string, Training[]>();
    for (const t of items) m.set(t.fecha, [...(m.get(t.fecha) ?? []), t]);
    return m;
  }, [items]);

  const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
  const offset = (first.getUTCDay() + 6) % 7; // lunes primero
  const days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${cursor.y}-${pad(cursor.m + 1)}-${pad(i + 1)}`)];
  const move = (d: number) => setCursor(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));
  const dayItems = (byDay.get(selected) ?? []).sort((a, b) => a.hora.localeCompare(b.hora));
  const blank = (): Training => ({ id: newId('CAP'), nombre: '', fecha: selected, hora: '09:00', responsable: '', cliente: '', modalidad: 'virtual', estado: 'programada', observaciones: '' });

  if (list.isLoading) return <LoadingState />;
  if (list.error) return <ErrorState message={list.error.message} onRetry={() => list.refetch()} />;

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap items-center gap-2">
        <Chip label="Todos los estados" selected={!estado} onPress={() => setEstado('')} />
        {TRAINING_STATES.map((s) => <Chip key={s} label={s} color={stateColor(s)} selected={estado === s} onPress={() => setEstado(s)} />)}
        <View className="w-px h-5 bg-gray-300 mx-1" />
        <Chip label="Toda modalidad" selected={!modalidad} onPress={() => setModalidad('')} />
        {MODALITIES.map((m) => <Chip key={m} label={m} selected={modalidad === m} onPress={() => setModalidad(m)} />)}
      </View>
      <View className="flex-row flex-wrap gap-4">
        <Card className="flex-1 min-w-[300px]">
          <View className="flex-row items-center justify-between mb-3">
            <IconButton icon={ChevronLeft} label="Mes anterior" onPress={() => move(-1)} />
            <Text className="text-base font-semibold text-gray-900">{MONTHS[cursor.m]} {cursor.y}</Text>
            <IconButton icon={ChevronRight} label="Mes siguiente" onPress={() => move(1)} />
          </View>
          <View className="flex-row">{DOW.map((d) => <Text key={d} className="flex-1 text-center text-xs font-semibold text-gray-500 pb-1">{d}</Text>)}</View>
          <View className="flex-row flex-wrap">
            {cells.map((d, i) => {
              const ev = d ? byDay.get(d) ?? [] : [];
              return (
                <View key={i} style={{ width: `${100 / 7}%` }} className="p-0.5">
                  {d ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`${formatDate(d)}: ${ev.length} capacitaciones`} onPress={() => setSelected(d)}
                      className={cn('h-14 rounded-lg p-1 border', d === selected ? 'border-primary bg-primary-50' : 'border-gray-100', d === today && 'border-accent')}>
                      <Text className={cn('text-xs', d === today ? 'font-bold text-accent' : 'text-gray-700')}>{Number(d.slice(8))}</Text>
                      <View className="flex-row flex-wrap gap-0.5 mt-1">{ev.slice(0, 4).map((t) => <View key={t.id} style={{ backgroundColor: stateColor(t.estado) }} className="w-2 h-2 rounded-full" />)}</View>
                    </Pressable>
                  ) : <View className="h-14" />}
                </View>
              );
            })}
          </View>
        </Card>
        <Card className="flex-1 min-w-[280px]">
          <SectionTitle title={`Capacitaciones del ${formatDate(selected)}`} right={<Button label="Nueva" icon={Plus} size="sm" onPress={() => setEditing(blank())} />} />
          {dayItems.length ? dayItems.map((t) => (
            <Pressable key={t.id} onPress={() => setEditing(t)} className="py-2.5 border-b border-gray-100 gap-1">
              <View className="flex-row items-center gap-2"><Text className="text-sm font-semibold text-gray-900 flex-1">{t.hora} · {t.nombre}</Text><Badge label={t.estado} tone={STATE_TONE[t.estado]} /></View>
              <Text className="text-xs text-gray-600">{t.cliente} · {t.responsable} · {t.modalidad}</Text>
              {t.observaciones ? <Text className="text-xs text-gray-500">{t.observaciones}</Text> : null}
            </Pressable>
          )) : <EmptyState title="Sin capacitaciones este día" description="Selecciona otro día o crea una nueva." />}
          <Text className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-1">Próximas</Text>
          {items.filter((t) => t.fecha >= today && t.estado === 'programada').sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)).slice(0, 4).map((t) => (
            <Pressable key={t.id} onPress={() => { setSelected(t.fecha); setCursor({ y: Number(t.fecha.slice(0, 4)), m: Number(t.fecha.slice(5, 7)) - 1 }); }} className="flex-row gap-2 py-1">
              <Text className="text-xs text-gray-500 w-20">{formatDate(t.fecha)}</Text><Text className="text-xs text-gray-800 flex-1" numberOfLines={1}>{t.nombre}</Text>
            </Pressable>
          ))}
        </Card>
      </View>
      <Modal visible={!!editing} onClose={() => setEditing(null)} title={editing?.nombre ? 'Editar capacitación' : 'Nueva capacitación'}>
        {editing ? <TrainingForm key={editing.id} initial={editing} onDone={() => setEditing(null)} /> : null}
      </Modal>
    </View>
  );
}
