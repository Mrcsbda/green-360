import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CheckCircle2, Clock, Plus, Save, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { container } from '@/core/providers/container';
import { todayIso } from '@/core/utils/dates';
import { formatDate } from '@/core/utils/format';
import { newId } from '@/core/utils/id';
import { KpiCard } from '@/shared/components/charts';
import { DataTable, type Column } from '@/shared/components/DataTable';
import { Badge, Button, Card, ErrorState, LoadingState, Modal } from '@/shared/components/ui';
import { ChoiceField, DateField, TextField } from '../../FormFields';
import { useCrud } from '../../useCrud';
import { LICENSE_TYPES, licenseSchema, licenseStatus, POR_VENCER_DIAS, type License, type LicenseStatus } from '../domain/license';

const ST: Record<LicenseStatus, { label: string; tone: 'green' | 'amber' | 'red' }> = {
  vigente: { label: 'Vigente', tone: 'green' }, por_vencer: { label: 'Por vencer', tone: 'amber' }, vencida: { label: 'Vencida', tone: 'red' },
};

function LicenseForm({ initial, isNew, onDone }: { initial: License; isNew: boolean; onDone: () => void }) {
  const { save, remove } = useCrud('licenses', container.licenses);
  const { control, handleSubmit, formState: { errors } } = useForm<License>({ resolver: zodResolver(licenseSchema), defaultValues: initial });
  return (
    <>
      <View className="flex-row flex-wrap gap-3">
        <TextField control={control} name="id" label="Identificador *" errors={errors} />
        <TextField control={control} name="producto" label="Producto o solución *" errors={errors} />
      </View>
      <View className="flex-row flex-wrap gap-3">
        <TextField control={control} name="proveedor" label="Proveedor *" errors={errors} />
        <TextField control={control} name="cliente" label="Cliente asociado *" errors={errors} />
      </View>
      <ChoiceField control={control} name="tipo" label="Tipo de licencia" options={LICENSE_TYPES} errors={errors} />
      <View className="flex-row flex-wrap gap-3">
        <DateField control={control} name="activacion" label="Activación *" errors={errors} />
        <DateField control={control} name="vencimiento" label="Vencimiento *" errors={errors} />
        <TextField control={control} name="usuariosAutorizados" label="Usuarios / equipos *" errors={errors} numeric />
      </View>
      <TextField control={control} name="observaciones" label="Observaciones" errors={errors} multiline className="w-full" />
      {save.error ? <ErrorState message={save.error.message} /> : null}
      <View className="flex-row gap-2">
        <Button label="Guardar" icon={Save} loading={save.isPending} onPress={handleSubmit(async (l) => { await save.mutateAsync(l); onDone(); })} />
        {!isNew ? <Button label="Eliminar" icon={Trash2} variant="danger" onPress={async () => { await remove.mutateAsync(initial.id); onDone(); }} /> : null}
      </View>
    </>
  );
}

export function LicensesPanel() {
  const { list } = useCrud('licenses', container.licenses);
  const hoy = todayIso();
  const [filter, setFilter] = useState<LicenseStatus | ''>('');
  const [editing, setEditing] = useState<{ l: License; isNew: boolean } | null>(null);
  const rows = useMemo(() => (list.data ?? []).map((l) => ({ ...l, ...licenseStatus(l, hoy) })), [list.data, hoy]);
  type Row = (typeof rows)[number];
  const count = (s: LicenseStatus) => rows.filter((r) => r.estado === s).length;

  const cols: Column<Row>[] = [
    { key: 'id', header: 'ID', width: 100, render: (r) => r.id, sortValue: (r) => r.id },
    { key: 'p', header: 'Producto', width: 180, render: (r) => r.producto, sortValue: (r) => r.producto },
    { key: 'pv', header: 'Proveedor', width: 140, render: (r) => r.proveedor, sortValue: (r) => r.proveedor },
    { key: 't', header: 'Tipo', width: 150, render: (r) => r.tipo },
    { key: 'c', header: 'Cliente', width: 190, render: (r) => r.cliente, sortValue: (r) => r.cliente },
    { key: 'a', header: 'Activación', width: 110, render: (r) => formatDate(r.activacion), sortValue: (r) => r.activacion },
    { key: 'v', header: 'Vencimiento', width: 110, render: (r) => formatDate(r.vencimiento), sortValue: (r) => r.vencimiento },
    { key: 'u', header: 'Usuarios', width: 90, align: 'right', render: (r) => String(r.usuariosAutorizados), sortValue: (r) => r.usuariosAutorizados },
    { key: 'e', header: 'Vigencia', width: 170, render: (r) => <View className="gap-0.5"><Badge label={ST[r.estado].label} tone={ST[r.estado].tone} /><Text className="text-[11px] text-gray-500">{r.dias < 0 ? `Venció hace ${-r.dias} días` : `Vence en ${r.dias} días`}</Text></View>, sortValue: (r) => r.dias },
    { key: 'o', header: 'Observaciones', width: 220, render: (r) => r.observaciones || '—' },
  ];
  const blank: License = { id: newId('LIC'), producto: '', proveedor: '', tipo: 'Suscripción anual', cliente: '', activacion: hoy, vencimiento: hoy, usuariosAutorizados: 1, observaciones: '' };

  if (list.isLoading) return <LoadingState />;
  if (list.error) return <ErrorState message={list.error.message} onRetry={() => list.refetch()} />;
  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-3">
        <KpiCard title="Vigentes" value={String(count('vigente'))} icon={CheckCircle2} tone="positive" onPress={() => setFilter(filter === 'vigente' ? '' : 'vigente')} />
        <KpiCard title={`Por vencer (≤ ${POR_VENCER_DIAS} días)`} value={String(count('por_vencer'))} icon={Clock} tone="teal" onPress={() => setFilter(filter === 'por_vencer' ? '' : 'por_vencer')} />
        <KpiCard title="Vencidas" value={String(count('vencida'))} icon={AlertTriangle} tone="red" onPress={() => setFilter(filter === 'vencida' ? '' : 'vencida')} />
      </View>
      <Card>
        <View className="flex-row flex-wrap items-center justify-between gap-2 mb-3">
          <Text className="text-sm text-gray-600">{filter ? `Filtrando: ${ST[filter].label}` : 'Todas las licencias'}</Text>
          <View className="flex-row gap-2">
            {filter ? <Button label="Quitar filtro" size="sm" variant="ghost" onPress={() => setFilter('')} /> : null}
            <Button label="Nueva licencia" icon={Plus} size="sm" onPress={() => setEditing({ l: blank, isNew: true })} />
          </View>
        </View>
        <DataTable rows={rows.filter((r) => !filter || r.estado === filter)} columns={cols} rowKey={(r) => r.id} initialSort={{ key: 'e', dir: 'asc' }}
          onRowPress={(r) => { const { estado: _e, dias: _d, ...l } = r; setEditing({ l, isNew: false }); }} emptyTitle="No hay licencias en este estado" />
      </Card>
      <Modal visible={!!editing} onClose={() => setEditing(null)} title={editing?.isNew ? 'Nueva licencia' : 'Editar licencia'}>
        {editing ? <LicenseForm key={editing.l.id} initial={editing.l} isNew={editing.isNew} onDone={() => setEditing(null)} /> : null}
      </Modal>
    </View>
  );
}
