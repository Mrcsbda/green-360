import { Link, router } from 'expo-router';
import { Bot, CalendarDays, ChevronRight, KeyRound } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { container } from '@/core/providers/container';
import { colors, segmentColors } from '@/core/theme/tokens';
import { todayIso } from '@/core/utils/dates';
import { formatCOPShort, formatDate, formatMonth } from '@/core/utils/format';
import { KpiGrid } from '@/modules/analytics/presentation/CommercialAnalytics';
import { bySegment, salesOverTime } from '@/modules/analytics/domain/analytics';
import { useAuthStore } from '@/modules/auth/application/authStore';
import { useDataset, useInsightContext } from '@/modules/customers/presentation/hooks';
import { licenseStatus } from '@/modules/services/licenses/domain/license';
import { useAsync } from '@/shared/hooks/useAsync';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { ChartCard, Donut, TimeLine } from '@/shared/components/charts';
import { Badge, Card, ErrorState, LoadingState, PageHeader, SectionTitle } from '@/shared/components/ui';

export default function OverviewScreen() {
  const user = useAuthStore((s) => s.session?.user);
  const { data, isLoading, error, refetch } = useDataset();
  const ctx = useInsightContext();
  const { isWide } = useBreakpoint();
  const alerts = useAsync(() => (ctx ? container.insights.alerts(ctx) : null), [ctx]);
  const ops = useAsync(async () => {
    const [lic, tr] = await Promise.all([container.licenses.list(), container.trainings.list()]);
    const hoy = todayIso();
    return {
      porVencer: lic.filter((l) => licenseStatus(l, hoy).estado === 'por_vencer').length,
      vencidas: lic.filter((l) => licenseStatus(l, hoy).estado === 'vencida').length,
      proximas: tr.filter((t) => t.estado === 'programada' && t.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 3),
    };
  }, []);

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error?.message ?? 'No se pudieron cargar los datos'} onRetry={() => refetch()} />;
  const serie = salesOverTime(data.views, data.sales, data.valueCOP, data.rules);
  const seg = bySegment(data.views);

  return (
    <View className="gap-6">
      <PageHeader title={`Hola, ${user?.nombre ?? ''}`} subtitle={`Resumen general de operaciones · datos al ${formatDate(data.rules.fechaReferencia)}`} />
      <KpiGrid views={data.views} rules={data.rules} />
      <View className="flex-row flex-wrap gap-4">
        <ChartCard title="Ventas mensuales (COP)" subtitle="Ventas confirmadas, todos los clientes" className="min-w-[320px] basis-[480px]">
          {serie ? <TimeLine data={serie.map((p) => ({ label: formatMonth(p.mes), value: Math.round(p.valor) }))} format={formatCOPShort} /> : <Text className="text-sm text-gray-500">No hay fechas suficientes.</Text>}
        </ChartCard>
        <ChartCard title="Clientes por segmento" subtitle="Clasificación por reglas configurables">
          <Donut centerLabel="clientes" data={seg.map((s) => ({ label: s.label, value: s.value, pct: s.pct, color: segmentColors[s.segment] }))} />
        </ChartCard>
      </View>
      <View className="flex-row flex-wrap gap-4">
        <Card className="flex-1 min-w-[300px]">
          <SectionTitle title="Alertas comerciales prioritarias" subtitle="Reglas sobre los datos actuales" right={!isWide ? <Link href="/asistente" asChild><Pressable className="flex-row items-center gap-1"><Bot size={14} color={colors.brand} /><Text className="text-xs text-accent font-medium">Abrir asistente</Text></Pressable></Link> : undefined} />
          {alerts.loading ? <LoadingState label="Calculando alertas…" /> : (alerts.data ?? []).slice(0, 5).map((a) => (
            <Pressable key={a.id} disabled={!a.customerId} accessibilityRole={a.customerId ? 'link' : undefined}
              onPress={() => a.customerId && router.push({ pathname: '/clientes/[id]', params: { id: a.customerId } })}
              className="py-2 px-2 -mx-2 rounded-lg border-b border-gray-100 gap-1 hover:bg-gray-50">
              <View className="flex-row items-center gap-2">
                <Badge label={a.prioridad} tone={a.prioridad === 'alta' ? 'red' : a.prioridad === 'media' ? 'amber' : 'gray'} />
                <Text className={a.customerId ? 'text-sm font-medium text-accent flex-1' : 'text-sm font-medium text-gray-900 flex-1'} numberOfLines={1}>{a.titulo}</Text>
                {a.customerId ? <ChevronRight size={14} color={colors.muted} /> : null}
              </View>
              <Text className="text-xs text-gray-600">{a.motivo}</Text>
            </Pressable>
          ))}
        </Card>
        <Card className="flex-1 min-w-[300px]">
          <SectionTitle title="Servicios y operaciones" subtitle="Licencias y próximas capacitaciones" right={<Link href="/servicios" asChild><Pressable><Text className="text-xs text-accent font-medium">Ver módulo</Text></Pressable></Link>} />
          {ops.data ? (
            <View className="gap-3">
              <View className="flex-row gap-3">
                <View className="flex-1 p-3 rounded-lg bg-amber-50 border border-amber-200"><KeyRound size={14} color={colors.warning} /><Text className="text-xl font-bold text-gray-900 mt-1">{ops.data.porVencer}</Text><Text className="text-xs text-gray-600">Licencias por vencer (30 días)</Text></View>
                <View className="flex-1 p-3 rounded-lg bg-red-50 border border-red-200"><KeyRound size={14} color={colors.danger} /><Text className="text-xl font-bold text-gray-900 mt-1">{ops.data.vencidas}</Text><Text className="text-xs text-gray-600">Licencias vencidas</Text></View>
              </View>
              <Text className="text-xs font-semibold text-gray-500 uppercase">Próximas capacitaciones</Text>
              {ops.data.proximas.length ? ops.data.proximas.map((t) => (
                <View key={t.id} className="flex-row items-center gap-2"><CalendarDays size={14} color={colors.muted} /><Text className="text-sm text-gray-800 flex-1" numberOfLines={1}>{t.nombre}</Text><Text className="text-xs text-gray-500">{formatDate(t.fecha)} {t.hora}</Text></View>
              )) : <Text className="text-sm text-gray-500">No hay capacitaciones programadas.</Text>}
            </View>
          ) : <LoadingState />}
        </Card>
      </View>
    </View>
  );
}
