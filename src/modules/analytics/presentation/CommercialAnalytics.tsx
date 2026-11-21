import { Activity, DollarSign, Snowflake, Star, Users } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { colors, segmentColors } from '@/core/theme/tokens';
import { formatCOPShort, formatMonth, formatNumber, formatPct } from '@/core/utils/format';
import type { Sale } from '@/modules/customers/domain/customer';
import type { CustomerView, SegmentationRules } from '@/modules/customers/domain/segmentation';
import { useFiltersStore } from '@/modules/customers/presentation/filtersStore';
import { Bars, ChartCard, Donut, KpiCard, KpiGrid as KpiCardsGrid, TimeLine } from '@/shared/components/charts';
import { Card, EmptyState } from '@/shared/components/ui';
import { byChannel, byCity, bySegment, kpis, salesOverTime } from '../domain/analytics';

export function KpiGrid({ views, rules }: { views: CustomerView[]; rules: SegmentationRules }) {
  const k = kpis(views, rules);
  const toggle = useFiltersStore((s) => s.toggle);
  return (
    <KpiCardsGrid>
      <KpiCard title="Total de clientes" value={formatNumber(k.total)} icon={Users} />
      <KpiCard title="Clientes frecuentes" value={formatNumber(k.frecuentes)} hint={`${rules.frecuenteMinCompras12m}+ compras en 12 meses`} icon={Star} tone="positive" onPress={() => toggle('segments', 'frecuente')} />
      <KpiCard title="Clientes fríos" value={formatNumber(k.frios)} hint={`Más de ${rules.frioDiasSinCompra} días sin compra`} icon={Snowflake} tone="teal" onPress={() => toggle('segments', 'frio')} />
      <KpiCard title="Ventas acumuladas" value={formatCOPShort(k.valorAcumulado)} hint="Ventas confirmadas en COP" icon={DollarSign} />
      <KpiCard title="Sin actividad reciente" value={formatNumber(k.sinActividadReciente)} hint={`Más de ${rules.inactividadDias} días o sin compras`} icon={Activity} tone="gray" />
    </KpiCardsGrid>
  );
}

/** Analítica comercial: responde a los filtros activos (recibe los clientes ya filtrados). */
export function CommercialAnalytics({ views, rules, sales, valueCOP }: { views: CustomerView[]; rules: SegmentationRules; sales: Sale[]; valueCOP: (s: Sale) => number }) {
  const toggle = useFiltersStore((s) => s.toggle);
  if (!views.length) return <Card><EmptyState title="No hay clientes con estos filtros" description="Ajusta o limpia los filtros para ver indicadores y gráficos." /></Card>;
  const seg = bySegment(views);
  const totalValor = seg.reduce((a, s) => a + s.valor, 0);
  const serie = salesOverTime(views, sales, valueCOP, rules);
  return (
    <View className="gap-4">
      <KpiGrid views={views} rules={rules} />
      <View className="flex-row flex-wrap gap-4">
        <ChartCard title="Clientes por ciudad" subtitle="Toca una barra para filtrar por esa ciudad">
          <Bars data={byCity(views).map((d) => ({ label: d.label, value: d.value, pct: d.pct, color: colors.chart[0] }))} onPressBar={(d) => toggle('ciudades', d.label)} />
        </ChartCard>
        <ChartCard title="Distribución por segmento" subtitle="Toca un segmento para ver su detalle">
          <Donut centerLabel="clientes" onPressSlice={(label) => { const s = seg.find((x) => x.label === label); if (s) toggle('segments', s.segment); }}
            data={seg.map((s) => ({ label: s.label, value: s.value, pct: s.pct, color: segmentColors[s.segment] }))} />
        </ChartCard>
      </View>
      <View className="flex-row flex-wrap gap-4">
        <ChartCard title="Clientes por canal preferido" subtitle="Toca una barra para filtrar por canal">
          <Bars data={byChannel(views).map((d) => ({ label: d.label, value: d.value, pct: d.pct, color: colors.chart[3] }))} onPressBar={(d) => toggle('canales', d.label)} />
        </ChartCard>
        <ChartCard title="Detalle por segmento" subtitle="Clientes, participación y valor acumulado">
          <View className="gap-2">
            {seg.map((s) => (
              <View key={s.segment} className="flex-row items-center gap-2 py-1.5 border-b border-gray-100">
                <View style={{ backgroundColor: segmentColors[s.segment] }} className="w-3 h-3 rounded-sm" />
                <Text className="text-sm text-gray-800 flex-1">{s.label}</Text>
                <Text className="text-xs text-gray-600 w-24 text-right">{s.value} · {formatPct(s.pct)}</Text>
                <Text className="text-xs font-semibold text-gray-900 w-28 text-right">{formatCOPShort(s.valor)}{totalValor ? ` · ${formatPct(s.valor / totalValor, 0)}` : ''}</Text>
              </View>
            ))}
          </View>
        </ChartCard>
      </View>
      <ChartCard title="Evolución mensual de ventas (COP)" subtitle="Ventas confirmadas de los clientes visibles; USD convertido con la TRM de cada fecha">
        {serie ? <TimeLine data={serie.map((p) => ({ label: formatMonth(p.mes), value: Math.round(p.valor) }))} format={formatCOPShort} />
          : <EmptyState title="No hay fechas suficientes" description="Se necesitan ventas en al menos dos meses distintos para mostrar la evolución. Importa un archivo de ventas con fechas." />}
      </ChartCard>
    </View>
  );
}

