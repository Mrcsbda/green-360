// Analítica descriptiva (no predictiva) sobre los clientes visibles.
import { monthKey } from '@/core/utils/dates';
import { SEGMENTS, SEGMENT_META, type Sale, type Segment } from '@/modules/customers/domain/customer';
import type { CustomerView, SegmentationRules } from '@/modules/customers/domain/segmentation';

export interface Kpis {
  total: number;
  frecuentes: number;
  frios: number;
  sinSegmentar: number;
  valorAcumulado: number;
  sinActividadReciente: number;
}

export function kpis(views: CustomerView[], rules: SegmentationRules): Kpis {
  const count = (s: Segment) => views.filter((v) => v.segment === s).length;
  return {
    total: views.length,
    frecuentes: count('frecuente'),
    frios: count('frio'),
    sinSegmentar: count('sin_segmentar'),
    valorAcumulado: views.reduce((a, v) => a + v.valorAcumulado, 0),
    sinActividadReciente: views.filter((v) => v.diasSinCompra === null || v.diasSinCompra > rules.inactividadDias).length,
  };
}

export interface Slice { key: string; label: string; value: number; pct: number }

function countBy(views: CustomerView[], key: (v: CustomerView) => string): Slice[] {
  const m = new Map<string, number>();
  for (const v of views) m.set(key(v), (m.get(key(v)) ?? 0) + 1);
  const total = views.length || 1;
  return [...m.entries()].map(([k, n]) => ({ key: k, label: k, value: n, pct: n / total })).sort((a, b) => b.value - a.value);
}

export const byCity = (views: CustomerView[]) => countBy(views, (v) => v.ciudad);
export const byChannel = (views: CustomerView[]) => countBy(views, (v) => v.canal || 'Sin canal');

export function bySegment(views: CustomerView[]): (Slice & { segment: Segment; valor: number })[] {
  const total = views.length || 1;
  return SEGMENTS.map((s) => {
    const l = views.filter((v) => v.segment === s);
    return { key: s, segment: s, label: SEGMENT_META[s].label, value: l.length, pct: l.length / total, valor: l.reduce((a, v) => a + v.valorAcumulado, 0) };
  });
}

export interface TimePoint { mes: string; valor: number; compras: number }
/** Evolución mensual de ventas confirmadas de los clientes visibles. null si no hay fechas suficientes (menos de 2 meses). */
export function salesOverTime(views: CustomerView[], sales: Sale[], valueCOP: (s: Sale) => number, rules: SegmentationRules): TimePoint[] | null {
  const ids = new Set(views.map((v) => v.id));
  const m = new Map<string, TimePoint>();
  for (const s of sales) {
    if (s.estado !== 'Confirmada' || !ids.has(s.customerId) || s.fecha > rules.fechaReferencia) continue;
    const k = monthKey(s.fecha);
    const p = m.get(k) ?? { mes: k, valor: 0, compras: 0 };
    p.valor += valueCOP(s);
    p.compras += 1;
    m.set(k, p);
  }
  const out = [...m.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  return out.length >= 2 ? out : null;
}
