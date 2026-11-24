import { router } from 'expo-router';
import {
  Activity,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Layers,
  Link2,
  RefreshCw,
  Send,
  Sparkles,
  Upload,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { Circle, G, Line, Rect, Svg, Text as SvgText } from 'react-native-svg';
import { colors } from '@/core/theme/tokens';
import { formatCOPShort, formatNumber, formatPct } from '@/core/utils/format';
import { useChatStore } from '@/modules/ai-insights/application/chatStore';
import type { CustomerView } from '@/modules/customers/domain/segmentation';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { Badge, Button, Card, cn, Modal, Notice, SectionTitle } from '@/shared/components/ui';
import {
  summarizeColabForViews,
  type ColabClusterSummary,
  type ColabCustomerInsight,
  type GreenSightColabReport,
} from '../domain/colabInsights';
import { useColabInsights } from '../infrastructure/colabClient';

const CLUSTER_COLORS = ['#0F5132', '#16A34A', '#0E7490'];
const CLUSTER_DARK_COLORS = ['#34D399', '#86EFAC', '#22D3EE'];

function useContainerWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

/** Gráfica interactiva PCA 2D + K-Means sincronizada con las coordenadas de Google Colab. */
function PcaClusterScatter({
  report,
  activeCluster,
  onSelectCluster,
}: {
  report: GreenSightColabReport;
  activeCluster: number | null;
  onSelectCluster: (cid: number | null) => void;
}) {
  const [w, onLayout] = useContainerWidth();
  const [selectedCustomer, setSelectedCustomer] = useState<ColabCustomerInsight | null>(null);
  const H = 250;
  const PAD = 28;

  const { xs, ys, minX, maxX, minY, maxY } = useMemo(() => {
    const pts = report.customers;
    const xVals = pts.map((p) => p.pca[0]);
    const yVals = pts.map((p) => p.pca[1]);
    const cXs = report.clusters.map((c) => c.centroidPca[0] ?? 0);
    const cYs = report.clusters.map((c) => c.centroidPca[1] ?? 0);
    const allX = [...xVals, ...cXs];
    const allY = [...yVals, ...cYs];
    const mnX = Math.min(...allX, -2) - 0.35;
    const mxX = Math.max(...allX, 2) + 0.35;
    const mnY = Math.min(...allY, -2) - 0.35;
    const mxY = Math.max(...allY, 2) + 0.35;
    return { xs: xVals, ys: yVals, minX: mnX, maxX: mxX, minY: mnY, maxY: mxY };
  }, [report]);

  const usableW = Math.max(220, w);
  const mapX = (x: number) => PAD + ((x - minX) / (maxX - minX || 1)) * (usableW - PAD * 2);
  const mapY = (y: number) => H - PAD - ((y - minY) / (maxY - minY || 1)) * (H - PAD * 2);
  const clusterPalette = colors.primary === '#34D399' ? CLUSTER_DARK_COLORS : CLUSTER_COLORS;

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center gap-1.5">
        <Pressable
          onPress={() => onSelectCluster(null)}
          className={cn(
            'px-2.5 py-1 rounded-full border',
            activeCluster === null ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200',
          )}
        >
          <Text className={cn('text-xs font-medium', activeCluster === null ? 'text-on-primary' : 'text-gray-700')}>
            Todos ({report.customers.length})
          </Text>
        </Pressable>
        {report.clusters.map((cl) => {
          const active = activeCluster === cl.clusterId;
          return (
            <Pressable
              key={cl.clusterId}
              onPress={() => onSelectCluster(active ? null : cl.clusterId)}
              className={cn(
                'flex-row items-center gap-1.5 px-2.5 py-1 rounded-full border',
                active ? 'bg-primary-50 border-primary' : 'bg-gray-50 border-gray-200',
              )}
            >
              <View style={{ backgroundColor: clusterPalette[cl.clusterId % 3] }} className="w-2.5 h-2.5 rounded-full" />
              <Text className="text-xs font-medium text-gray-800">
                C{cl.clusterId} · {cl.label} ({cl.count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View onLayout={onLayout} className="rounded-xl bg-gray-50 border border-gray-200 overflow-hidden">
        {w > 0 ? (
          <Svg width={usableW} height={H}>
            {/* Ejes cartesianos en 0 */}
            <Line
              x1={mapX(0)}
              y1={PAD / 2}
              x2={mapX(0)}
              y2={H - PAD / 2}
              stroke={colors.border}
              strokeDasharray="4,4"
              strokeWidth={1}
            />
            <Line
              x1={PAD / 2}
              y1={mapY(0)}
              x2={usableW - PAD / 2}
              y2={mapY(0)}
              stroke={colors.border}
              strokeDasharray="4,4"
              strokeWidth={1}
            />
            <SvgText x={usableW - PAD - 6} y={mapY(0) - 6} fontSize={10} fill={colors.muted} textAnchor="end">
              PC1 ({formatPct(report.pca.explainedVarianceRatio[0] ?? 0, 1)})
            </SvgText>
            <SvgText x={mapX(0) + 6} y={PAD + 2} fontSize={10} fill={colors.muted}>
              PC2 ({formatPct(report.pca.explainedVarianceRatio[1] ?? 0, 1)})
            </SvgText>

            {/* Puntos de clientes */}
            {report.customers.map((c, idx) => {
              const cx = mapX(xs[idx]);
              const cy = mapY(ys[idx]);
              const dimmed = activeCluster !== null && c.clusterId !== activeCluster;
              const isSelected = selectedCustomer?.id === c.id;
              return (
                <Circle
                  key={c.id}
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 7.5 : 5}
                  fill={clusterPalette[c.clusterId % 3]}
                  opacity={dimmed ? 0.16 : isSelected ? 1 : 0.82}
                  stroke={isSelected ? colors.text : colors.surface}
                  strokeWidth={isSelected ? 2 : 1}
                  onPress={() => setSelectedCustomer(c)}
                />
              );
            })}

            {/* Centroides de clúster */}
            {report.clusters.map((cl) => {
              const cx = mapX(cl.centroidPca[0] ?? 0);
              const cy = mapY(cl.centroidPca[1] ?? 0);
              const dimmed = activeCluster !== null && cl.clusterId !== activeCluster;
              return (
                <G key={`centroid-${cl.clusterId}`} opacity={dimmed ? 0.25 : 1}>
                  <Rect
                    x={cx - 6}
                    y={cy - 6}
                    width={12}
                    height={12}
                    rx={3}
                    fill={colors.surface}
                    stroke={clusterPalette[cl.clusterId % 3]}
                    strokeWidth={2.5}
                  />
                  <SvgText
                    x={cx}
                    y={cy - 10}
                    fontSize={10}
                    fontWeight="bold"
                    fill={colors.text}
                    textAnchor="middle"
                  >
                    C{cl.clusterId}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        ) : (
          <View style={{ height: H }} />
        )}
      </View>

      {selectedCustomer ? (
        <Pressable
          onPress={() => router.push({ pathname: '/clientes/[id]', params: { id: selectedCustomer.id } })}
          className="flex-row flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-primary-50 border border-primary/20"
        >
          <View className="flex-1 min-w-[200px] gap-0.5">
            <Text className="text-xs font-bold text-primary">
              {selectedCustomer.empresa} · {selectedCustomer.ciudad}
            </Text>
            <Text className="text-xs text-gray-700">
              {selectedCustomer.clusterLabel} · Recomendado: {selectedCustomer.productoRecomendado}
            </Text>
            <Text className="text-[11px] text-gray-500">
              GLM: {formatCOPShort(selectedCustomer.demandaGlmCOP)} · MoE: {formatCOPShort(selectedCustomer.demandaMoeCOP)} ·
              Pesos [{selectedCustomer.pesosExpertos.map((w) => w.toFixed(2)).join(', ')}]
            </Text>
          </View>
          <Badge label="Ver ficha →" tone="primary" />
        </Pressable>
      ) : (
        <Text className="text-[11px] text-gray-500">
          Toca cualquier cliente en el plano PCA para inspeccionar su demanda GLM vs MoE y sus pesos de expertos.
        </Text>
      )}
    </View>
  );
}

/** Comparativa de Demanda GLM Tweedie vs Mixture of Experts (MoE) por Producto Green Services. */
function ProductDemandComparison({ report }: { report: GreenSightColabReport }) {
  const maxVal = Math.max(
    1,
    ...report.products.flatMap((p) => [p.demandaGlmCOP, p.demandaMoeCOP]),
  );

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-4">
        <View className="flex-row items-center gap-1.5">
          <View style={{ backgroundColor: colors.chart[3] }} className="w-3 h-3 rounded-sm" />
          <Text className="text-xs text-gray-600">GLM Tweedie (base)</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View style={{ backgroundColor: colors.primary }} className="w-3 h-3 rounded-sm" />
          <Text className="text-xs text-gray-600">MoE Optimizado (PyTorch)</Text>
        </View>
      </View>

      <View className="gap-2.5">
        {report.products.slice(0, 7).map((p) => {
          const wGlm = Math.max(4, Math.round((p.demandaGlmCOP / maxVal) * 100));
          const wMoe = Math.max(4, Math.round((p.demandaMoeCOP / maxVal) * 100));
          const trendPct = (p.tendencia90d * 100).toFixed(0);
          return (
            <View key={p.producto} className="gap-1 pb-2 border-b border-gray-100">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-xs font-semibold text-gray-900 flex-1" numberOfLines={1}>
                  {p.producto}
                </Text>
                <Badge
                  label={p.prioridad === 'alta' ? 'Reposición prioritaria' : 'Estándar'}
                  tone={p.prioridad === 'alta' ? 'green' : 'gray'}
                />
                <Text className="text-xs font-bold text-gray-900 w-20 text-right">
                  {formatCOPShort(p.demandaMoeCOP)}
                </Text>
              </View>
              <View className="gap-1">
                <View className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <View style={{ width: `${wGlm}%`, backgroundColor: colors.chart[3] }} className="h-2 rounded-full" />
                </View>
                <View className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <View style={{ width: `${wMoe}%`, backgroundColor: colors.primary }} className="h-2 rounded-full" />
                </View>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] text-gray-500">
                  {p.ventasConfirmadas} ventas · {p.clientesUnicos} clientes · GLM {formatCOPShort(p.demandaGlmCOP)}
                </Text>
                <Text className={cn('text-[11px] font-medium', p.tendencia90d >= 0 ? 'text-positive' : 'text-warning')}>
                  Tendencia 90d: {p.tendencia90d >= 0 ? `+${trendPct}%` : `${trendPct}%`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Pesos de enrutamiento Mixture of Experts (MoE) por Clúster y acción directa a n8n Chat. */
function MoeRoutingPanel({
  report,
  onLaunchCampaign,
}: {
  report: GreenSightColabReport;
  onLaunchCampaign: (cluster: ColabClusterSummary) => void;
}) {
  const clusterPalette = colors.primary === '#34D399' ? CLUSTER_DARK_COLORS : CLUSTER_COLORS;
  return (
    <View className="gap-3">
      {report.clusters.map((cl) => (
        <View key={cl.clusterId} className="p-3 rounded-xl bg-gray-50 border border-gray-200 gap-2">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View className="flex-row items-center gap-2 flex-1 min-w-[180px]">
              <View style={{ backgroundColor: clusterPalette[cl.clusterId % 3] }} className="w-3 h-3 rounded-full" />
              <Text className="text-sm font-semibold text-gray-900">
                C{cl.clusterId} · {cl.label}
              </Text>
              <Badge label={`${cl.count} clientes (${formatPct(cl.pct, 0)})`} tone="gray" />
            </View>
            <Text className="text-xs font-bold text-primary">MoE: {formatCOPShort(cl.demandaMoeTotalCOP)}</Text>
          </View>

          <Text className="text-xs text-gray-600">{cl.recomendacion}</Text>

          {/* Barra apilada de pesos de expertos [E0, E1, E2] */}
          <View className="gap-1">
            <View className="flex-row h-2.5 rounded-full overflow-hidden bg-gray-200">
              {cl.pesosExpertosPromedio.map((w, idx) => (
                <View
                  key={idx}
                  style={{ width: `${Math.max(4, Math.round(w * 100))}%`, backgroundColor: clusterPalette[idx % 3] }}
                />
              ))}
            </View>
            <View className="flex-row flex-wrap justify-between gap-2">
              {cl.pesosExpertosPromedio.map((w, idx) => (
                <Text key={idx} className="text-[11px] text-gray-500">
                  {report.moeMetrics.expertNames[idx] ?? `Exp ${idx}`}: {formatPct(w, 0)}
                </Text>
              ))}
            </View>
          </View>

          <View className="flex-row flex-wrap items-center justify-between gap-2 pt-1">
            <Text className="text-[11px] text-gray-500">
              Recencia media: {cl.avgRecenciaDias} d · Frec. 12m: {cl.avgFrecuencia12m} · Ticket: {formatCOPShort(cl.avgTicketCOP)}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => onLaunchCampaign(cl)}
              className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-50 border border-primary/20 hover:opacity-90"
            >
              <Send size={12} color={colors.primary} />
              <Text className="text-xs font-semibold text-primary">Campaña MoE en Chat IA</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

export function ColabDashboardSection({ views }: { views: CustomerView[] }) {
  const { report, sourceMode, syncing, lastError, urls, syncFromRemote, importJsonReport, updateUrls } =
    useColabInsights();
  const queuePrompt = useChatStore((s) => s.queuePrompt);
  const { isWide } = useBreakpoint();

  const [activeCluster, setActiveCluster] = useState<number | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [apiInput, setApiInput] = useState(urls.apiUrl || 'http://localhost:8000');
  const [colabInput, setColabInput] = useState(urls.colabInsightsUrl);
  const [n8nInput, setN8nInput] = useState(urls.n8nWebhookUrl);
  const [jsonPaste, setJsonPaste] = useState('');
  const [modalMsg, setModalMsg] = useState<string | null>(null);

  const summary = useMemo(() => summarizeColabForViews(report, views), [report, views]);

  const handleLaunchCampaign = (cl: ColabClusterSummary) => {
    const prompt =
      cl.clusterId === 2
        ? `Redacta y prepara un correo masivo vía n8n usando el modelo MoE para reactivar los clientes del clúster ${cl.label} de Green Services.`
        : cl.clusterId === 0
          ? `Genera una campaña de correo masivo con prompt MoE para los clientes ${cl.label} enfocada en expansión y reposición de servicios documentales.`
          : `Prepara un correo masivo vía n8n con MoE para fidelizar a los clientes ${cl.label} de Green Services.`;
    queuePrompt(prompt);
    if (!isWide) {
      router.push('/asistente');
    }
  };

  const handleSaveConnection = async () => {
    setModalMsg(null);
    await updateUrls({
      apiUrl: apiInput.trim(),
      colabInsightsUrl: colabInput.trim(),
      n8nWebhookUrl: n8nInput.trim(),
    });
    const ok = await syncFromRemote(colabInput.trim() || apiInput.trim(), false);
    if (jsonPaste.trim()) {
      try {
        await importJsonReport(jsonPaste.trim());
        setJsonPaste('');
        setModalMsg('JSON de Colab importado y aplicado en el Dashboard.');
        return;
      } catch (e) {
        setModalMsg(e instanceof Error ? e.message : 'JSON inválido');
        return;
      }
    }
    setModalMsg(ok ? 'Conexión guardada y datos sincronizados desde Colab / Backend.' : 'URLs guardadas (el Dashboard usará datos locales hasta que el servidor responda).');
  };

  return (
    <View className="gap-4">
      {/* Banner de conexión con Google Colab + GreenSight ML */}
      <Card className="gap-3 border-primary/25">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="flex-row items-center gap-3 flex-1 min-w-[260px]">
            <View className="w-10 h-10 rounded-xl bg-primary-50 items-center justify-center border border-primary/20">
              <Cpu size={20} color={colors.primary} />
            </View>
            <View className="flex-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-base font-bold text-gray-900">GreenSight ML · Conectado con Google Colab</Text>
                <Badge
                  label={
                    sourceMode === 'live_api'
                      ? 'Colab / API en vivo'
                      : sourceMode === 'custom_json'
                        ? 'JSON Colab importado'
                        : 'Sincronizado del Notebook'
                  }
                  tone="green"
                />
              </View>
              <Text className="text-xs text-gray-500 mt-0.5">
                Pipeline: PCA ({formatPct(report.pca.cumulativeVariance, 1)} varianza) → K-Means (k={report.metadata.nClusters}) → GLM Tweedie (p={report.metadata.tweedieVarPower}) → MoE PyTorch (R² {report.moeMetrics.r2.toFixed(2)})
              </Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2">
            <Button
              label="Abrir Colab"
              size="sm"
              variant="secondary"
              icon={ExternalLink}
              onPress={() => Linking.openURL(report.metadata.colabNotebookUrl)}
            />
            <Button
              label={syncing ? 'Sincronizando…' : 'Sincronizar'}
              size="sm"
              variant="secondary"
              icon={RefreshCw}
              loading={syncing}
              onPress={() => syncFromRemote(undefined, true)}
            />
            <Button
              label="Conectar Colab / n8n"
              size="sm"
              icon={Link2}
              onPress={() => {
                setApiInput(urls.apiUrl || 'http://localhost:8000');
                setColabInput(urls.colabInsightsUrl);
                setN8nInput(urls.n8nWebhookUrl);
                setModalMsg(null);
                setConfigOpen(true);
              }}
            />
          </View>
        </View>

        {lastError ? (
          <Notice tone="warning">
            No se alcanzó el servidor remoto ({lastError}). Mostrando las predicciones sincronizadas desde `Machine_Learning_GreenSight.ipynb`.
          </Notice>
        ) : null}

        {/* Métricas resumen del modelo Colab */}
        <View className="flex-row flex-wrap gap-3 pt-1">
          <View className="flex-1 min-w-[150px] p-3 rounded-xl bg-gray-50 border border-gray-200">
            <Text className="text-[11px] font-medium text-gray-500">Varianza PCA (3 comp.)</Text>
            <Text className="text-lg font-bold text-gray-900 mt-0.5">{formatPct(report.pca.cumulativeVariance, 2)}</Text>
            <Text className="text-[11px] text-gray-500">Silhouette K-Means: {report.moeMetrics.silhouetteScore.toFixed(2)}</Text>
          </View>
          <View className="flex-1 min-w-[150px] p-3 rounded-xl bg-gray-50 border border-gray-200">
            <Text className="text-[11px] font-medium text-gray-500">Demanda GLM Tweedie</Text>
            <Text className="text-lg font-bold text-gray-900 mt-0.5">{formatCOPShort(summary.totalGlm)}</Text>
            <Text className="text-[11px] text-gray-500">Proyección trimestral base</Text>
          </View>
          <View className="flex-1 min-w-[150px] p-3 rounded-xl bg-green-50 border border-green-200">
            <Text className="text-[11px] font-medium text-green-800">Demanda Optimizada MoE</Text>
            <Text className="text-lg font-bold text-green-900 mt-0.5">{formatCOPShort(summary.totalMoe)}</Text>
            <Text className="text-[11px] text-green-800">
              R² {report.moeMetrics.r2.toFixed(2)} · RMSE {report.moeMetrics.rmse.toFixed(2)} M
            </Text>
          </View>
          <View className="flex-1 min-w-[150px] p-3 rounded-xl bg-gray-50 border border-gray-200">
            <Text className="text-[11px] font-medium text-gray-500">Producto #1 en Necesidad</Text>
            <Text className="text-sm font-bold text-gray-900 mt-1" numberOfLines={1}>
              {report.products[0]?.producto ?? '—'}
            </Text>
            <Text className="text-[11px] text-positive">
              {report.products[0] ? `${formatCOPShort(report.products[0].demandaMoeCOP)} · Alta prioridad` : ''}
            </Text>
          </View>
        </View>
      </Card>

      {/* Fila de gráficas sincronizadas con Colab */}
      <View className="flex-row flex-wrap gap-4">
        <Card className="flex-1 min-w-[320px] basis-[480px]">
          <SectionTitle
            title="Clústeres K-Means en plano PCA 2D (Colab)"
            subtitle="Segmentación ML por recencia, frecuencia, ticket, variedad y estacionalidad"
            right={<Layers size={16} color={colors.primary} />}
          />
          <PcaClusterScatter
            report={report}
            activeCluster={activeCluster}
            onSelectCluster={setActiveCluster}
          />
        </Card>

        <Card className="flex-1 min-w-[320px] basis-[420px]">
          <SectionTitle
            title="Productos de mayor necesidad (GLM vs MoE)"
            subtitle="Predicción de demanda y prioridad de reposición en Green Services"
            right={<Activity size={16} color={colors.brand} />}
          />
          <ProductDemandComparison report={report} />
        </Card>
      </View>

      {/* Panel de enrutamiento Mixture of Experts + conexión rápida a Automatizaciones Chat/n8n */}
      <Card>
        <SectionTitle
          title="Orquestación Mixture of Experts (MoE) por Clúster"
          subtitle="Pesos de la red Gating (PyTorch) y disparo directo de campañas personalizadas vía Chat IA + n8n"
          right={<Sparkles size={16} color={colors.brand} />}
        />
        <MoeRoutingPanel report={report} onLaunchCampaign={handleLaunchCampaign} />
      </Card>

      {/* Modal de configuración de Colab / Backend Docker / JSON */}
      <Modal
        visible={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Conectar Google Colab, Hugging Face API y n8n"
      >
        <Text className="text-xs text-gray-600">
          Conecta el backend Docker (`http://localhost:8000`) o una URL pública generada en Google Colab (`ngrok`/`cloudflared`) para actualizar las gráficas en vivo y habilitar el chat con Hugging Face + envíos masivos en n8n.
        </Text>
        <View className="gap-1">
          <Text className="text-xs font-medium text-gray-700">URL del Backend API (FastAPI · Docker o Colab)</Text>
          <TextInput
            value={apiInput}
            onChangeText={setApiInput}
            placeholder="http://localhost:8000"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
          />
        </View>
        <View className="gap-1">
          <Text className="text-xs font-medium text-gray-700">URL directa de JSON Colab (opcional)</Text>
          <TextInput
            value={colabInput}
            onChangeText={setColabInput}
            placeholder="https://tu-tunel-colab.trycloudflare.com/greensight/insights"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
          />
        </View>
        <View className="gap-1">
          <Text className="text-xs font-medium text-gray-700">Webhook n8n directo (opcional si usas n8n sin API)</Text>
          <TextInput
            value={n8nInput}
            onChangeText={setN8nInput}
            placeholder="http://localhost:5678/webhook/green360-mass-email"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
          />
        </View>
        <View className="gap-1">
          <Text className="text-xs font-medium text-gray-700">O pega aquí el JSON `greensight_insights.json` exportado de Colab</Text>
          <TextInput
            value={jsonPaste}
            onChangeText={setJsonPaste}
            placeholder='{"metadata": {...}, "pca": {...}, ...}'
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 min-h-[76px]"
          />
        </View>
        {modalMsg ? (
          <View className="flex-row items-center gap-2 p-2.5 rounded-lg bg-green-50 border border-green-200">
            <CheckCircle2 size={16} color={colors.positive} />
            <Text className="text-xs text-green-900 flex-1">{modalMsg}</Text>
          </View>
        ) : null}
        <View className="flex-row flex-wrap gap-2">
          <Button label="Guardar y sincronizar" icon={Upload} onPress={handleSaveConnection} loading={syncing} />
          <Button label="Cerrar" variant="secondary" onPress={() => setConfigOpen(false)} />
        </View>
      </Modal>
    </View>
  );
}
