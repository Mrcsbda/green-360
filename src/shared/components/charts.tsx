import type { LucideIcon } from 'lucide-react-native';
import { Children, useState, type ReactNode } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { colors, segmentColors } from '@/core/theme/tokens';
import { formatPct } from '@/core/utils/format';
import { Card, cn } from './ui';

type Tone = 'default' | 'positive' | 'teal' | 'red' | 'gray';
const toneColor = (t: Tone) => ({ default: colors.primary, positive: segmentColors.frecuente, teal: segmentColors.frio, red: colors.danger, gray: segmentColors.sin_segmentar })[t];

export function KpiCard({ title, value, hint, icon: Icon, tone = 'default', onPress }: {
  title: string; value: string; hint?: string; icon?: LucideIcon; tone?: Tone; onPress?: () => void;
}) {
  const accent = toneColor(tone);
  const body = (
    <View className="bg-white rounded-xl border border-gray-200 p-5 flex-1 min-w-[140px]">
      <View className="flex-row items-start justify-between gap-2 pb-3">
        <Text className="text-sm font-medium text-gray-600 flex-1" numberOfLines={2}>{title}</Text>
        {Icon ? <View style={{ backgroundColor: `${accent}22` }} className="p-1.5 rounded-lg"><Icon size={16} color={accent} /></View> : null}
      </View>
      <Text className={cn('font-bold text-gray-900', value.length > 8 ? 'text-xl' : 'text-2xl')} numberOfLines={1}>{value}</Text>
      {hint ? <Text className="text-xs text-gray-500 mt-1.5" numberOfLines={2}>{hint}</Text> : null}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${value}`} onPress={onPress} className="flex-1 min-w-[140px] hover:opacity-90">{body}</Pressable> : body;
}

/** Grilla de KPIs: columnas según el ancho disponible (5 / 3 / 2) y espacio uniforme entre tarjetas. */
export function KpiGrid({ children, gap = 16 }: { children: ReactNode; gap?: number }) {
  const [w, onLayout] = useWidth();
  const items = Children.toArray(children);
  const cols = w >= 1000 ? Math.min(5, items.length) : w >= 560 ? 3 : 2;
  // La última fila reparte su ancho entre las tarjetas que tiene, para no dejar huecos
  const lastStart = Math.floor((items.length - 1) / cols) * cols;
  const widthFor = (i: number) => {
    const n = i >= lastStart ? items.length - lastStart : cols;
    return (w - gap * (n - 1)) / n;
  };
  return (
    <View onLayout={onLayout} style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {w ? items.map((c, i) => <View key={i} style={{ width: widthFor(i) }}>{c}</View>) : null}
    </View>
  );
}

/** Mide el ancho del contenedor para que las gráficas sean responsive. */
function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

/** Máximo del eje Y con 4 marcas "redondas" (escala conocida para ubicar el tooltip sobre el punto). */
function niceMax(v: number) {
  if (v <= 0) return 4;
  const raw = (v * 1.05) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((k) => k * p).find((k) => k >= raw) ?? raw;
  if (v < 1000) step = Math.ceil(step); // conteos: marcas enteras
  return step * 4;
}

function Tooltip({ x, y, width, title, value, sub }: { x: number; y: number; width: number; title: string; value: string; sub?: string }) {
  const W = 140;
  const left = Math.max(0, Math.min(width - W, x - W / 2));
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left, top: Math.max(0, y - 66), width: W, backgroundColor: colors.text }} className="rounded-lg px-2.5 py-1.5">
      <Text style={{ color: colors.surface, opacity: 0.75 }} className="text-[10px]" numberOfLines={1}>{title}</Text>
      <Text style={{ color: colors.surface }} className="text-sm font-bold" numberOfLines={1}>{value}</Text>
      {sub ? <Text style={{ color: colors.surface, opacity: 0.75 }} className="text-[10px]" numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

/** Zonas invisibles por punto/barra: hover en web, toque en móvil. */
function HoverZones({ xs, width, height, onActive, onPress }: { xs: number[]; width: number; height: number; onActive: (i: number | null) => void; onPress?: (i: number) => void }) {
  const col = xs.length > 1 ? xs[1] - xs[0] : width;
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      {xs.map((x, i) => (
        <Pressable key={i} accessibilityLabel={`Valor ${i + 1}`} onHoverIn={() => onActive(i)} onHoverOut={() => onActive(null)} onPressIn={() => onActive(i)} onPress={onPress ? () => onPress(i) : undefined}
          style={{ position: 'absolute', left: x - col / 2, width: col, top: 0, height }} />
      ))}
    </View>
  );
}

export function ChartCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('flex-1 min-w-[280px]', className)}>
      <Text className="text-sm font-semibold text-gray-900">{title}</Text>
      {subtitle ? <Text className="text-xs text-gray-500 mb-3">{subtitle}</Text> : <View className="mb-3" />}
      {children}
    </Card>
  );
}

export interface BarDatum { label: string; value: number; color?: string; pct?: number }

const BAR_Y_AXIS = 44;
const BAR_H = 200;

export function Bars({ data, format = (n) => String(n), onPressBar }: { data: BarDatum[]; format?: (n: number) => string; onPressBar?: (d: BarDatum) => void }) {
  const [w, onLayout] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const n = Math.max(1, data.length);
  const usable = Math.max(120, w - BAR_Y_AXIS - 20);
  const barWidth = Math.max(14, Math.min(42, (usable / n) * 0.55));
  const spacing = Math.max(8, usable / n - barWidth);
  const initial = spacing / 2;
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const xs = data.map((_, i) => initial + i * (barWidth + spacing) + barWidth / 2);
  const a = active !== null ? data[active] : null;
  return (
    <View onLayout={onLayout} accessibilityLabel={data.map((d) => `${d.label}: ${format(d.value)}${d.pct !== undefined ? ` (${formatPct(d.pct)})` : ''}`).join('; ')}>
      {w > 0 ? (
        <View>
          <BarChart
            data={data.map((d, i) => ({
              value: d.value, label: d.label.length > 10 ? `${d.label.slice(0, 9)}…` : d.label,
              frontColor: d.color ?? colors.chart[i % colors.chart.length], opacity: active === null || active === i ? 1 : 0.45,
              onPress: onPressBar ? () => onPressBar(d) : undefined,
              topLabelComponent: () => (
                <Text style={{ fontSize: 10, color: colors.text, width: 70, textAlign: 'center', marginLeft: -(70 - barWidth) / 2 }}>
                  {format(d.value)}{d.pct !== undefined ? ` · ${formatPct(d.pct, 0)}` : ''}
                </Text>
              ),
            }))}
            width={usable} height={BAR_H} barWidth={barWidth} spacing={spacing} initialSpacing={initial} maxValue={max} noOfSections={4}
            barBorderTopLeftRadius={6} barBorderTopRightRadius={6}
            yAxisThickness={0} xAxisThickness={1} xAxisColor={colors.border} rulesColor={colors.border}
            yAxisTextStyle={{ fontSize: 10, color: colors.muted }} xAxisLabelTextStyle={{ fontSize: 10, color: colors.muted }}
            formatYLabel={(v: string) => format(Number(v))} yAxisLabelWidth={BAR_Y_AXIS} disableScroll
          />
          <View style={{ position: 'absolute', left: BAR_Y_AXIS, top: 0 }}>
            <HoverZones xs={xs} width={usable} height={BAR_H} onActive={setActive} onPress={onPressBar ? (i) => onPressBar(data[i]) : undefined} />
            {a && active !== null ? (
              <Tooltip x={xs[active]} y={BAR_H - (a.value / max) * BAR_H} width={usable} title={a.label} value={format(a.value)} sub={a.pct !== undefined ? `${formatPct(a.pct)} del total` : undefined} />
            ) : null}
          </View>
        </View>
      ) : <View style={{ height: BAR_H }} />}
    </View>
  );
}

export function Donut({ data, centerLabel, onPressSlice }: {
  data: { label: string; value: number; color: string; pct: number }[]; centerLabel: string; onPressSlice?: (label: string) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((acc, d) => acc + d.value, 0);
  if (!total) return <Text className="text-sm text-gray-500">Sin datos para graficar.</Text>;
  const a = active !== null ? data[active] : null;
  return (
    <View className="flex-row flex-wrap items-center gap-5" accessibilityLabel={data.map((d) => `${d.label}: ${d.value} (${formatPct(d.pct)})`).join('; ')}>
      <PieChart
        data={data.map((d, i) => ({ value: d.value, color: d.color, focused: active === i, onPress: () => setActive(i) }))}
        donut radius={80} innerRadius={54} innerCircleColor={colors.surface}
        centerLabelComponent={() => (
          <View className="items-center">
            <Text className="text-xl font-bold text-gray-900">{a ? a.value : total}</Text>
            <Text className="text-[10px] text-gray-500 text-center" style={{ maxWidth: 90 }}>{a ? `${a.label} · ${formatPct(a.pct)}` : centerLabel}</Text>
          </View>
        )}
      />
      <View className="gap-1 flex-1 min-w-[160px]">
        {data.map((d, i) => (
          <Pressable key={d.label} onHoverIn={() => setActive(i)} onHoverOut={() => setActive(null)} onPress={() => { setActive(i); onPressSlice?.(d.label); }}
            accessibilityRole="button" className={cn('flex-row items-center gap-2 px-2 py-1.5 rounded-md', active === i && 'bg-gray-100')}>
            <View style={{ backgroundColor: d.color }} className="w-3 h-3 rounded-sm" />
            <Text className="text-xs text-gray-800 flex-1">{d.label}</Text>
            <Text className="text-xs font-semibold text-gray-900">{d.value} · {formatPct(d.pct)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const LINE_Y_AXIS = 52;
const LINE_H = 200;
const LINE_PAD = 26;
const LINE_TOP = 10; // margen superior que deja LineChart antes del área de trazado

export function TimeLine({ data, format }: { data: { label: string; value: number; sub?: string }[]; format: (n: number) => string }) {
  const [w, onLayout] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const usable = Math.max(160, w - 120);
  const spacing = data.length > 1 ? usable / (data.length - 1) : usable;
  const step = Math.ceil(data.length / Math.max(3, Math.floor(usable / 70))); // etiquetas sin encimarse
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const xs = data.map((_, i) => LINE_PAD + i * spacing);
  const areaW = usable + LINE_PAD * 2;
  const a = active !== null ? data[active] : null;
  return (
    <View onLayout={onLayout} accessibilityLabel={`Serie mensual: ${data.map((d) => `${d.label} ${format(d.value)}`).join('; ')}`}>
      {w > 0 ? (
        <View>
          <LineChart
            data={data.map((d, i) => ({
              value: d.value,
              labelComponent: i % step === 0 ? () => <Text style={{ fontSize: 9, color: colors.muted, width: 48, marginLeft: -12, textAlign: 'center' }}>{d.label}</Text> : undefined,
            }))}
            width={usable + LINE_PAD * 2} height={LINE_H} spacing={spacing} initialSpacing={LINE_PAD} endSpacing={LINE_PAD} maxValue={max}
            color={colors.primary} thickness={2.5} areaChart startFillColor={colors.chart[1]} endFillColor={colors.chart[1]} startOpacity={0.25} endOpacity={0.02}
            dataPointsColor={colors.primary} dataPointsRadius={3} noOfSections={4}
            yAxisThickness={0} xAxisColor={colors.border} rulesColor={colors.border}
            yAxisTextStyle={{ fontSize: 10, color: colors.muted }}
            formatYLabel={(v: string) => format(Number(v))} yAxisLabelWidth={LINE_Y_AXIS} disableScroll
          />
          <View style={{ position: 'absolute', left: LINE_Y_AXIS, top: 0 }}>
            {a && active !== null ? (
              <>
                <View pointerEvents="none" style={{ position: 'absolute', left: xs[active], top: 0, width: 1, height: LINE_H, backgroundColor: colors.muted, opacity: 0.4 }} />
                <View pointerEvents="none" style={{ position: 'absolute', left: xs[active] - 6, top: LINE_TOP + LINE_H - (a.value / max) * LINE_H - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surface }} />
              </>
            ) : null}
            <HoverZones xs={xs} width={areaW} height={LINE_H} onActive={setActive} />
            {a && active !== null ? <Tooltip x={xs[active]} y={LINE_TOP + LINE_H - (a.value / max) * LINE_H} width={areaW} title={a.label} value={format(a.value)} sub={a.sub} /> : null}
          </View>
        </View>
      ) : <View style={{ height: LINE_H }} />}
    </View>
  );
}
