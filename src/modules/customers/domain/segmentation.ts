// Segmentación 100 % automática por reglas de negocio (puras, sin UI ni almacenamiento). No es un modelo estadístico.
import { z } from 'zod';
import { daysBetween, isValidIsoDate, toTime } from '@/core/utils/dates';
import type { Customer, Sale, Segment } from './customer';

export const segmentationRulesSchema = z.object({
  /** "Hoy" del análisis. Por defecto la última fecha con datos cargados. */
  fechaReferencia: z.string().refine(isValidIsoDate, 'Fecha inválida'),
  frecuenteMinCompras12m: z.number().int().min(1, 'Mínimo 1'),
  frecuenteMaxDiasSinCompra: z.number().int().min(1),
  frecuenteMinValor12m: z.number().min(0),
  frioDiasSinCompra: z.number().int().min(1),
  inactividadDias: z.number().int().min(1),
});
export type SegmentationRules = z.infer<typeof segmentationRulesSchema>;

export const DEFAULT_RULES: SegmentationRules = {
  fechaReferencia: '2026-10-31',
  frecuenteMinCompras12m: 10, // percentil 75 de la base actual
  frecuenteMaxDiasSinCompra: 90,
  frecuenteMinValor12m: 0,
  frioDiasSinCompra: 90,
  inactividadDias: 180,
};

export type CommercialStatus = 'Activo' | 'Inactivo' | 'Sin compras';

export interface CustomerMetrics {
  ultimaCompra: string | null;
  primeraCompra: string | null;
  numCompras: number;
  numAnuladas: number;
  valorAcumulado: number; // COP, solo confirmadas
  compras12m: number;
  valor12m: number;
  diasSinCompra: number | null;
  intervaloPromedio: number | null; // días entre fechas de compra distintas
  proximaCompraEstimada: string | null;
  compras90d: number;
  valor90d: number;
  valorTrimestralPrevio: number; // promedio trimestral de los 12 meses previos a los últimos 90 días
  estadoComercial: CommercialStatus;
}

export interface SegmentResult {
  segment: Segment;
  motivo: string;
  /** Variables usadas: se muestran como evidencia. */
  evidencia: string[];
}

export type SaleValuer = (s: Sale) => number;

export function computeMetrics(c: Customer, sales: Sale[], rules: SegmentationRules, valueCOP: SaleValuer): CustomerMetrics {
  const ref = rules.fechaReferencia;
  const refT = toTime(ref);
  const mine = sales.filter((s) => s.customerId === c.id && toTime(s.fecha) <= refT);
  const conf = mine.filter((s) => s.estado === 'Confirmada').sort((a, b) => a.fecha.localeCompare(b.fecha));
  const age = (s: Sale) => daysBetween(s.fecha, ref);
  const in12 = conf.filter((s) => age(s) < 365);
  const in90 = conf.filter((s) => age(s) < 91);
  const prev = conf.filter((s) => age(s) >= 91 && age(s) < 456);
  const fechas = [...new Set(conf.map((s) => s.fecha))];
  const gaps = fechas.slice(1).map((f, i) => daysBetween(fechas[i], f));
  const intervalo = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
  const ultima = conf.at(-1)?.fecha ?? null;
  const dias = ultima ? daysBetween(ultima, ref) : null;
  const sum = (l: Sale[]) => l.reduce((a, s) => a + valueCOP(s), 0);
  const proxima = ultima && intervalo ? new Date(toTime(ultima) + Math.round(intervalo) * 86_400_000).toISOString().slice(0, 10) : null;
  return {
    ultimaCompra: ultima,
    primeraCompra: conf[0]?.fecha ?? null,
    numCompras: conf.length,
    numAnuladas: mine.length - conf.length,
    valorAcumulado: sum(conf),
    compras12m: in12.length,
    valor12m: sum(in12),
    diasSinCompra: dias,
    intervaloPromedio: intervalo,
    proximaCompraEstimada: proxima,
    compras90d: in90.length,
    valor90d: sum(in90),
    valorTrimestralPrevio: sum(prev) / 4,
    estadoComercial: dias === null ? 'Sin compras' : dias <= rules.frioDiasSinCompra ? 'Activo' : 'Inactivo',
  };
}

/** Prioridad (evita clasificaciones contradictorias): 1. Sin datos  2. Frío  3. Frecuente  4. Sin segmentar. */
export function classify(m: CustomerMetrics, r: SegmentationRules): SegmentResult {
  const ev = [
    `Recencia: ${m.diasSinCompra === null ? 'sin compras' : `${m.diasSinCompra} días sin compra`}`,
    `Frecuencia: ${m.compras12m} compras en 12 meses`,
    `Valor 12 meses: ${Math.round(m.valor12m).toLocaleString('es-CO')} COP`,
    `Historial: ${m.numCompras} compras confirmadas`,
  ];
  if (m.diasSinCompra === null) return { segment: 'sin_segmentar', motivo: 'Sin historial de compras: datos insuficientes', evidencia: ev };
  if (m.diasSinCompra > r.frioDiasSinCompra) {
    return { segment: 'frio', motivo: `${m.diasSinCompra} días sin compra (umbral: más de ${r.frioDiasSinCompra})`, evidencia: ev };
  }
  if (m.compras12m >= r.frecuenteMinCompras12m && m.diasSinCompra <= r.frecuenteMaxDiasSinCompra && m.valor12m >= r.frecuenteMinValor12m) {
    return { segment: 'frecuente', motivo: `${m.compras12m} compras en 12 meses (mínimo ${r.frecuenteMinCompras12m}) y compra reciente`, evidencia: ev };
  }
  return {
    segment: 'sin_segmentar',
    motivo: `Activo pero con ${m.compras12m} compras en 12 meses: no alcanza el umbral de frecuente (${r.frecuenteMinCompras12m})`,
    evidencia: ev,
  };
}

export interface CustomerView extends Customer, CustomerMetrics {
  segment: Segment;
  segmento: SegmentResult;
}

export function buildCustomerViews(customers: Customer[], sales: Sale[], rules: SegmentationRules, valueCOP: SaleValuer): CustomerView[] {
  const bySale = new Map<string, Sale[]>();
  for (const s of sales) {
    const l = bySale.get(s.customerId);
    if (l) l.push(s); else bySale.set(s.customerId, [s]);
  }
  return customers.map((c) => {
    const m = computeMetrics(c, bySale.get(c.id) ?? [], rules, valueCOP);
    const seg = classify(m, rules);
    return { ...c, ...m, segment: seg.segment, segmento: seg };
  });
}
