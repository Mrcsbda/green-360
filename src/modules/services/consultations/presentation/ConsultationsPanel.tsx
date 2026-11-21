import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save, Search, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';
import { container } from '@/core/providers/container';
import { colors } from '@/core/theme/tokens';
import { todayIso } from '@/core/utils/dates';
import { formatDate } from '@/core/utils/format';
import { newId } from '@/core/utils/id';
import { DataTable, type Column } from '@/shared/components/DataTable';
import { Badge, Button, Card, ErrorState, LoadingState, Modal, Select } from '@/shared/components/ui';
import { ChoiceField, DateField, TextField } from '../../FormFields';
import { DatePicker } from '@/shared/components/pickers';
import { useCrud } from '../../useCrud';
import {
  CONSULTATION_STATES, consultationSchema, EMPTY_CONSULTATION_FILTERS, filterConsultations, QUERY_TYPES, SERVICE_CATEGORIES,
  type Consultation, type ConsultationFilters,
} from '../domain/consultation';

const STATE = { abierta: { label: 'Abierta', tone: 'teal' }, en_proceso: { label: 'En proceso', tone: 'amber' }, cerrada: { label: 'Cerrada', tone: 'gray' } } as const;

function ConsultationForm({ initial, isNew, onDone }: { initial: Consultation; isNew: boolean; onDone: () => void }) {
  const { save, remove } = useCrud('consultations', container.consultations);
  const { control, handleSubmit, formState: { errors } } = useForm<Consultation>({ resolver: zodResolver(consultationSchema), defaultValues: initial });
  return (
    <>
      <View className="flex-row flex-wrap gap-3">
        <TextField control={control} name="cliente" label="Cliente *" errors={errors} />
        <TextField control={control} name="baseDatos" label="Nombre de la base de datos *" errors={errors} />
      </View>
      <ChoiceField control={control} name="tipo" label="Tipo de consulta" options={QUERY_TYPES} errors={errors} />
      <ChoiceField control={control} name="categoria" label="Categoría del servicio" options={SERVICE_CATEGORIES} errors={errors} />
      <View className="flex-row flex-wrap gap-3">
        <DateField control={control} name="fecha" label="Fecha de registro *" errors={errors} />
        <TextField control={control} name="responsable" label="Responsable *" errors={errors} />
      </View>
      <ChoiceField control={control} name="estado" label="Estado" options={CONSULTATION_STATES.map((s) => ({ value: s, label: STATE[s].label }))} errors={errors} />
      <TextField control={control} name="observaciones" label="Observaciones" errors={errors} multiline className="w-full" />
      {save.error ? <ErrorState message={save.error.message} /> : null}
      <View className="flex-row gap-2">
        <Button label="Guardar" icon={Save} loading={save.isPending} onPress={handleSubmit(async (c) => { await save.mutateAsync(c); onDone(); })} />
        {!isNew ? <Button label="Eliminar" icon={Trash2} variant="danger" onPress={async () => { await remove.mutateAsync(initial.id); onDone(); }} /> : null}
      </View>
    </>
  );
}

export function ConsultationsPanel() {
  const { list } = useCrud('consultations', container.consultations);
  const [f, setF] = useState<ConsultationFilters>(EMPTY_CONSULTATION_FILTERS);
  const [editing, setEditing] = useState<{ c: Consultation; isNew: boolean } | null>(null);
  const rows = useMemo(() => filterConsultations(list.data ?? [], f), [list.data, f]);
  const responsables = useMemo(() => [...new Set((list.data ?? []).map((c) => c.responsable))].sort(), [list.data]);
  const set = <K extends keyof ConsultationFilters>(k: K) => (v: ConsultationFilters[K]) => setF((x) => ({ ...x, [k]: v }));
  const activos = Object.values(f).filter(Boolean).length;

  const cols: Column<Consultation>[] = [
    { key: 'id', header: 'Código', width: 100, render: (c) => c.id, sortValue: (c) => c.id },
    { key: 'c', header: 'Cliente', width: 170, render: (c) => c.cliente, sortValue: (c) => c.cliente },
    { key: 'b', header: 'Base de datos', width: 170, render: (c) => c.baseDatos, sortValue: (c) => c.baseDatos },
    { key: 't', header: 'Tipo', width: 170, render: (c) => c.tipo, sortValue: (c) => c.tipo },
    { key: 'cat', header: 'Categoría', width: 170, render: (c) => c.categoria, sortValue: (c) => c.categoria },
    { key: 'f', header: 'Fecha', width: 100, render: (c) => formatDate(c.fecha), sortValue: (c) => c.fecha },
    { key: 'r', header: 'Responsable', width: 140, render: (c) => c.responsable, sortValue: (c) => c.responsable },
    { key: 'e', header: 'Estado', width: 110, render: (c) => <Badge label={STATE[c.estado].label} tone={STATE[c.estado].tone} />, sortValue: (c) => c.estado },
    { key: 'o', header: 'Observaciones', width: 240, render: (c) => c.observaciones || '—' },
  ];
  const blank: Consultation = { id: newId('REG'), cliente: '', baseDatos: '', tipo: 'Consulta documental', categoria: 'Gestión documental', fecha: todayIso(), responsable: '', estado: 'abierta', observaciones: '' };

  if (list.isLoading) return <LoadingState />;
  if (list.error) return <ErrorState message={list.error.message} onRetry={() => list.refetch()} />;
  return (
    <View className="gap-4">
      <Card className="gap-3">
        <View className="flex-row items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3">
          <Search size={16} color={colors.muted} />
          <TextInput value={f.q} onChangeText={set('q')} placeholder="Buscar por código, cliente, base u observaciones" placeholderTextColor={colors.muted} accessibilityLabel="Búsqueda de registros" className="flex-1 py-2 text-sm text-gray-900" />
        </View>
        <Select label="Tipo de consulta" value={f.tipo} options={QUERY_TYPES} onChange={set('tipo')} allowEmpty="Todos" />
        <Select label="Categoría del servicio" value={f.categoria} options={SERVICE_CATEGORIES} onChange={set('categoria')} allowEmpty="Todas" />
        <Select label="Estado" value={f.estado} options={CONSULTATION_STATES.map((s) => ({ value: s, label: STATE[s].label }))} onChange={set('estado')} allowEmpty="Todos" />
        <Select label="Responsable" value={f.responsable} options={responsables} onChange={set('responsable')} allowEmpty="Todos" />
        <View className="flex-row flex-wrap gap-3">
          <DatePicker className="w-52" label="Desde" value={f.desde} onChange={set('desde')} allowClear max={f.hasta || undefined} />
          <DatePicker className="w-52" label="Hasta" value={f.hasta} onChange={set('hasta')} allowClear min={f.desde || undefined} />
        </View>
        {activos ? <View className="flex-row items-center gap-3"><Text className="text-xs text-gray-600">{rows.length} de {list.data?.length ?? 0} registros</Text><Button label="Limpiar filtros" icon={X} size="sm" variant="ghost" onPress={() => setF(EMPTY_CONSULTATION_FILTERS)} /></View> : null}
      </Card>
      <Card>
        <View className="flex-row justify-end mb-3"><Button label="Nuevo registro" icon={Plus} size="sm" onPress={() => setEditing({ c: blank, isNew: true })} /></View>
        <DataTable rows={rows} columns={cols} rowKey={(c) => c.id} initialSort={{ key: 'f', dir: 'desc' }} onRowPress={(c) => setEditing({ c, isNew: false })}
          emptyTitle="Ningún registro cumple los filtros" emptyDescription="Ajusta la búsqueda o limpia los filtros." />
      </Card>
      <Modal visible={!!editing} onClose={() => setEditing(null)} title={editing?.isNew ? 'Nuevo registro de consulta' : `Registro ${editing?.c.id ?? ''}`}>
        {editing ? <ConsultationForm key={editing.c.id} initial={editing.c} isNew={editing.isNew} onDone={() => setEditing(null)} /> : null}
      </Modal>
    </View>
  );
}
