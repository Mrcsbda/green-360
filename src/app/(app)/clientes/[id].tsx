import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Mail, MapPin, Pencil, Phone, User } from 'lucide-react-native';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { colors } from '@/core/theme/tokens';
import { formatCOP, formatCOPShort, formatDate } from '@/core/utils/format';
import type { Sale } from '@/modules/customers/domain/customer';
import { SegmentBadge } from '@/modules/customers/presentation/SegmentBadge';
import { useDataset } from '@/modules/customers/presentation/hooks';
import { DataTable, type Column } from '@/shared/components/DataTable';
import { KpiCard } from '@/shared/components/charts';
import { Badge, Button, Card, ErrorState, LoadingState, PageHeader, SectionTitle } from '@/shared/components/ui';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useDataset();
  const c = data?.views.find((v) => v.id === id);
  const sales = useMemo(() => (data?.sales ?? []).filter((s) => s.customerId === id).sort((a, b) => b.fecha.localeCompare(a.fecha)), [data, id]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!c || !data) return <ErrorState message="Cliente no encontrado" />;

  const saleCols: Column<Sale>[] = [
    { key: 'f', header: 'Fecha', width: 110, render: (s) => formatDate(s.fecha), sortValue: (s) => s.fecha },
    { key: 'id', header: 'Venta', width: 100, render: (s) => s.id },
    { key: 'p', header: 'Producto', width: 220, render: (s) => s.producto, sortValue: (s) => s.producto },
    { key: 'q', header: 'Cant.', width: 70, align: 'right', render: (s) => String(s.cantidad) },
    { key: 'm', header: 'Moneda', width: 80, render: (s) => s.moneda },
    { key: 'v', header: 'Valor COP', width: 140, align: 'right', render: (s) => formatCOP(data.valueCOP(s)), sortValue: (s) => data.valueCOP(s) },
    { key: 'e', header: 'Estado', width: 110, render: (s) => <Badge label={s.estado} tone={s.estado === 'Confirmada' ? 'green' : 'gray'} /> },
  ];


  return (
    <View className="gap-4">
      <View className="self-start"><Button label="Volver" icon={ArrowLeft} variant="ghost" size="sm" onPress={() => (router.canGoBack() ? router.back() : router.replace('/clientes'))} /></View>
      <PageHeader title={c.empresa} subtitle={`${c.id} · ${c.sector} · alta ${formatDate(c.fechaAlta)}`}
        right={<Button label="Editar" icon={Pencil} variant="secondary" onPress={() => router.push({ pathname: '/clientes/form', params: { id: c.id } })} />} />

      <View className="flex-row flex-wrap gap-4">
        <Card className="flex-1 min-w-[280px] gap-3">
          <SectionTitle title="Contacto" />
          {[[User, c.contacto], [Mail, c.email], [Phone, c.telefono], [MapPin, c.ciudad]].map(([Icon, v], i) => {
            const I = Icon as typeof User;
            return <View key={i} className="flex-row items-center gap-2"><I size={14} color={colors.muted} /><Text className="text-sm text-gray-800">{(v as string) || '—'}</Text></View>;
          })}
          <Text className="text-xs text-gray-500">Canal preferido: <Text className="font-semibold text-gray-800">{c.canal}</Text></Text>
        </Card>
        <Card className="flex-1 min-w-[300px] gap-2">
          <SectionTitle title="Segmento comercial" subtitle="Clasificación automática · motivo y variables usadas" right={<SegmentBadge segment={c.segment} />} />
          <Text className="text-sm text-gray-900">{c.segmento.motivo}</Text>
          {c.segmento.evidencia.map((e) => <Text key={e} className="text-xs text-gray-500">• {e}</Text>)}
        </Card>
      </View>

      <View className="flex-row flex-wrap gap-3">
        <KpiCard title="Valor acumulado" value={formatCOPShort(c.valorAcumulado)} hint="Ventas confirmadas" />
        <KpiCard title="Compras" value={String(c.numCompras)} hint={`${c.compras12m} en 12 meses · ${c.numAnuladas} anuladas`} />
        <KpiCard title="Última compra" value={formatDate(c.ultimaCompra)} hint={c.diasSinCompra === null ? 'Sin compras' : `Hace ${c.diasSinCompra} días`} />
        <KpiCard title="Intervalo promedio" value={c.intervaloPromedio ? `${Math.round(c.intervaloPromedio)} días` : '—'} hint={c.proximaCompraEstimada ? `Próxima estimada: ${formatDate(c.proximaCompraEstimada)} (regla)` : 'Sin datos suficientes'} />
      </View>

      <Card>
        <SectionTitle title="Historial de compras" subtitle="USD convertido a COP con la TRM de la fecha de la venta" />
        <DataTable rows={sales} columns={saleCols} rowKey={(s) => s.id} pageSize={8} emptyTitle="Este cliente no tiene compras registradas" />
      </Card>
    </View>
  );
}
