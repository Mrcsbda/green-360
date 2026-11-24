import { Link, router } from 'expo-router';
import { Bot, CalendarDays, ChevronRight, KeyRound, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { container } from '@/core/providers/container';
import { colors, segmentColors } from '@/core/theme/tokens';
import { todayIso } from '@/core/utils/dates';
import { formatCOPShort, formatDate, formatMonth } from '@/core/utils/format';
import { bySegment, salesOverTime } from '@/modules/analytics/domain/analytics';
import { useColabInsights } from '@/modules/analytics/infrastructure/colabClient';
import { ColabDashboardSection } from '@/modules/analytics/presentation/ColabDashboardSection';
import { KpiGrid } from '@/modules/analytics/presentation/CommercialAnalytics';
import { useAuthStore } from '@/modules/auth/application/authStore';
import { useDataset, useInsightContext } from '@/modules/customers/presentation/hooks';
import { licenseStatus } from '@/modules/services/licenses/domain/license';
import { ChartCard, Donut, TimeLine } from '@/shared/components/charts';
import { Badge, Card, ErrorState, LoadingState, PageHeader, SectionTitle, cn } from '@/shared/components/ui';
import { useAsync } from '@/shared/hooks/useAsync';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';

const COLAB_CLUSTER_COLORS = ['#0F5132', '#16A34A', '#0E7490'];

export default function OverviewScreen() {
  const user = useAuthStore((s) => s.session?.user);
  const { data, isLoading, error, refetch } = useDataset();
  const ctx = useInsightContext();
  const { report } = useColabInsights();
  const { isWide } = useBreakpoint();
  const [donutMode, setDonutMode] = useState<'colab' | 'reglas'>('colab');

  const alerts = useAsync(() => (ctx ? container.insights.alerts(ctx) : null), [ctx]);
  const ops = useAsync(async () => {
    const [lic, tr] = await Promise.all([container.licenses.list(), container.trainings.list()]);
    const hoy = todayIso();
    return {
      porVencer: lic.filter((l) => licenseStatus(l, hoy).estado === 'por_vencer').length,
      vencidas: lic.filter((l) => licenseStatus(l, hoy).estado === 'vencida').length,
      proximas: tr
        .filter((t) => t.estado === 'programada' && t.fecha >= hoy)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .slice(0, 3),
    };
  }, []);

  if (isLoading) return <LoadingState />;
  if (error || !data)
    return <ErrorState message={error?.message ?? 'No se pudieron cargar los datos'} onRetry={() => refetch()} />;

  const serie = salesOverTime(data.views, data.sales, data.valueCOP, data.rules);
  const seg = bySegment(data.views);

  return (
    <View className="gap-6">
      <PageHeader
        title={`Hola, ${user?.nombre ?? ''}`}
        subtitle={`Dashboard operativo Green 360° · datos al ${formatDate(data.rules.fechaReferencia)}`}
        right={
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
              <Sparkles size={13} color={colors.positive} />
              <Text className="text-xs font-semibold text-green-900">GreenSight Colab · MoE activo</Text>
            </View>
            {!isWide ? (
              <Link href="/asistente" asChild>
                <Pressable className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary">
                  <Bot size={14} color={colors.onPrimary} />
                  <Text className="text-xs font-semibold text-on-primary">Abrir Chat IA</Text>
                </Pressable>
              </Link>
            ) : null}
          </View>
        }
      />

      {/* KPIs Comerciales principales */}
      <KpiGrid views={data.views} rules={data.rules} />

      {/* Gráficas comerciales + comparativa directa con Clústeres Colab */}
      <View className="flex-row flex-wrap gap-4">
        <ChartCard
          title="Ventas mensuales (COP)"
          subtitle="Histórico de ventas confirmadas convertido con TRM diaria"
          className="min-w-[320px] basis-[480px]"
        >
          {serie ? (
            <TimeLine
              data={serie.map((p) => ({ label: formatMonth(p.mes), value: Math.round(p.valor) }))}
              format={formatCOPShort}
            />
          ) : (
            <Text className="text-sm text-gray-500">No hay fechas suficientes.</Text>
          )}
        </ChartCard>

        <Card className="flex-1 min-w-[280px]">
          <View className="flex-row flex-wrap items-center justify-between gap-2 mb-3">
            <View className="flex-1 min-w-[160px]">
              <Text className="text-sm font-semibold text-gray-900">
                {donutMode === 'colab' ? 'Clústeres K-Means (Colab)' : 'Clientes por segmento (Reglas)'}
              </Text>
              <Text className="text-xs text-gray-500">
                {donutMode === 'colab'
                  ? 'Agrupación PCA + K-Means del notebook'
                  : 'Clasificación por reglas configurables'}
              </Text>
            </View>
            <View className="flex-row p-0.5 rounded-lg bg-gray-100 border border-gray-200">
              <Pressable
                onPress={() => setDonutMode('colab')}
                className={cn('px-2.5 py-1 rounded-md', donutMode === 'colab' && 'bg-white')}
              >
                <Text className={cn('text-xs', donutMode === 'colab' ? 'font-semibold text-primary' : 'text-gray-600')}>
                  Colab ML
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDonutMode('reglas')}
                className={cn('px-2.5 py-1 rounded-md', donutMode === 'reglas' && 'bg-white')}
              >
                <Text className={cn('text-xs', donutMode === 'reglas' ? 'font-semibold text-primary' : 'text-gray-600')}>
                  Reglas
                </Text>
              </Pressable>
            </View>
          </View>

          {donutMode === 'colab' ? (
            <Donut
              centerLabel="clientes ML"
              data={report.clusters.map((c) => ({
                label: c.label,
                value: c.count,
                pct: c.pct,
                color: COLAB_CLUSTER_COLORS[c.clusterId % 3],
              }))}
            />
          ) : (
            <Donut
              centerLabel="clientes"
              data={seg.map((s) => ({
                label: s.label,
                value: s.value,
                pct: s.pct,
                color: segmentColors[s.segment],
              }))}
            />
          )}
        </Card>
      </View>

      {/* Analítica y Gráficas sincronizadas con Google Colab (PCA, K-Means, GLM Tweedie, MoE) */}
      <ColabDashboardSection views={data.views} />

      {/* Alertas comerciales y Servicios operativos */}
      <View className="flex-row flex-wrap gap-4">
        <Card className="flex-1 min-w-[300px]">
          <SectionTitle
            title="Alertas comerciales prioritarias"
            subtitle="Reglas sobre los datos actuales"
            right={
              !isWide ? (
                <Link href="/asistente" asChild>
                  <Pressable className="flex-row items-center gap-1">
                    <Bot size={14} color={colors.brand} />
                    <Text className="text-xs text-accent font-medium">Abrir asistente</Text>
                  </Pressable>
                </Link>
              ) : undefined
            }
          />
          {alerts.loading ? (
            <LoadingState label="Calculando alertas…" />
          ) : (
            (alerts.data ?? []).slice(0, 5).map((a) => (
              <Pressable
                key={a.id}
                disabled={!a.customerId}
                accessibilityRole={a.customerId ? 'link' : undefined}
                onPress={() => a.customerId && router.push({ pathname: '/clientes/[id]', params: { id: a.customerId } })}
                className="py-2.5 px-2 -mx-2 rounded-lg border-b border-gray-100 gap-1 hover:bg-gray-50"
              >
                <View className="flex-row items-center gap-2">
                  <Badge
                    label={a.prioridad}
                    tone={a.prioridad === 'alta' ? 'red' : a.prioridad === 'media' ? 'amber' : 'gray'}
                  />
                  <Text
                    className={a.customerId ? 'text-sm font-medium text-accent flex-1' : 'text-sm font-medium text-gray-900 flex-1'}
                    numberOfLines={1}
                  >
                    {a.titulo}
                  </Text>
                  {a.customerId ? <ChevronRight size={14} color={colors.muted} /> : null}
                </View>
                <Text className="text-xs text-gray-600">{a.motivo}</Text>
              </Pressable>
            ))
          )}
        </Card>

        <Card className="flex-1 min-w-[300px]">
          <SectionTitle
            title="Servicios y operaciones"
            subtitle="Licencias y próximas capacitaciones"
            right={
              <Link href="/servicios" asChild>
                <Pressable>
                  <Text className="text-xs text-accent font-medium">Ver módulo</Text>
                </Pressable>
              </Link>
            }
          />
          {ops.data ? (
            <View className="gap-3">
              <View className="flex-row gap-3">
                <View className="flex-1 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <KeyRound size={14} color={colors.warning} />
                  <Text className="text-xl font-bold text-gray-900 mt-1">{ops.data.porVencer}</Text>
                  <Text className="text-xs text-gray-600">Licencias por vencer (30 días)</Text>
                </View>
                <View className="flex-1 p-3 rounded-xl bg-red-50 border border-red-200">
                  <KeyRound size={14} color={colors.danger} />
                  <Text className="text-xl font-bold text-gray-900 mt-1">{ops.data.vencidas}</Text>
                  <Text className="text-xs text-gray-600">Licencias vencidas</Text>
                </View>
              </View>
              <Text className="text-xs font-semibold text-gray-500 uppercase">Próximas capacitaciones</Text>
              {ops.data.proximas.length ? (
                ops.data.proximas.map((t) => (
                  <View key={t.id} className="flex-row items-center gap-2 py-1 border-b border-gray-100">
                    <CalendarDays size={14} color={colors.muted} />
                    <Text className="text-sm text-gray-800 flex-1" numberOfLines={1}>
                      {t.nombre}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {formatDate(t.fecha)} {t.hora}
                    </Text>
                  </View>
                ))
              ) : (
                <Text className="text-sm text-gray-500">No hay capacitaciones programadas.</Text>
              )}
            </View>
          ) : (
            <LoadingState />
          )}
        </Card>
      </View>
    </View>
  );
}
