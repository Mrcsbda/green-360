// Asistente por reglas deterministas sobre los datos disponibles. Nada se inventa: cada cifra sale de los datos.
import { daysBetween } from '@/core/utils/dates';
import { formatCOPShort, formatPct } from '@/core/utils/format';
import { SEGMENT_META, SEGMENTS } from '@/modules/customers/domain/customer';
import type { CustomerView } from '@/modules/customers/domain/segmentation';
import type {
  AIInsightsService, CommercialAlert, InsightAnswer, InsightContext, Priority, Recommendation,
} from '../domain/insights';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const MIN_CLIENTES = 3;

/** Días entre la fecha de referencia y la próxima compra estimada (negativo = atrasada). */
const diasAProxima = (v: CustomerView, ref: string) => (v.proximaCompraEstimada ? daysBetween(ref, v.proximaCompraEstimada) : null);

/** Clientes activos cuya próxima compra estimada (última compra + intervalo promedio) cae en los próximos 30 días o se atrasó hasta medio ciclo. */
export function recompraCandidates(ctx: InsightContext) {
  return ctx.views
    .filter((v) => v.intervaloPromedio && v.numCompras >= 3 && v.segment !== 'frio')
    .map((v) => ({ v, d: diasAProxima(v, ctx.rules.fechaReferencia)! }))
    .filter(({ v, d }) => d <= 30 && d >= -0.5 * v.intervaloPromedio!)
    .sort((a, b) => Math.abs(a.d) - Math.abs(b.d) || b.v.valor12m - a.v.valor12m);
}

/** Frecuentes atrasados (más de 1,5 ciclos sin comprar) y clientes recién enfriados (tibios). */
export function riesgoInactividad(ctx: InsightContext) {
  const r = ctx.rules;
  return ctx.views
    .filter((v) => v.diasSinCompra !== null && v.intervaloPromedio && (
      (v.compras12m >= r.frecuenteMinCompras12m && v.diasSinCompra > 1.5 * v.intervaloPromedio) ||
      (v.diasSinCompra > r.frioDiasSinCompra && v.diasSinCompra <= r.inactividadDias)))
    .sort((a, b) => b.valor12m - a.valor12m);
}

const canal = (v: CustomerView) => (v.canal === 'Llamada' ? 'Llamar' : v.canal === 'WhatsApp' ? 'Escribir por WhatsApp' : v.canal === 'Visita' ? 'Visitar' : 'Enviar correo');

export function ruleRecommendations(ctx: InsightContext): Recommendation[] {
  const out: Recommendation[] = [];
  for (const { v, d } of recompraCandidates(ctx).slice(0, 8)) {
    out.push({
      id: `rec-rec-${v.id}`, objetivo: v.empresa, customerId: v.id, prioridad: d <= 7 ? 'alta' : 'media', tipo: 'regla',
      motivo: d < 0 ? `Su próxima compra estimada se atrasó ${-d} días` : `Su próxima compra estimada es en ${d} días`,
      evidencia: [`Intervalo promedio: ${Math.round(v.intervaloPromedio!)} días`, `Última compra hace ${v.diasSinCompra} días`, `Valor 12 meses: ${formatCOPShort(v.valor12m)}`],
      accion: `${canal(v)} con propuesta de recompra`,
    });
  }
  for (const v of riesgoInactividad(ctx).slice(0, 6)) {
    out.push({
      id: `rec-rie-${v.id}`, objetivo: v.empresa, customerId: v.id, prioridad: v.valor12m > 50_000_000 ? 'alta' : 'media', tipo: 'regla',
      motivo: `Riesgo de inactividad: ${v.diasSinCompra} días sin compra (ciclo normal ${Math.round(v.intervaloPromedio!)})`,
      evidencia: [`Compras 12 meses: ${v.compras12m}`, `Valor 12 meses: ${formatCOPShort(v.valor12m)}`],
      accion: `${canal(v)} de seguimiento para reactivar`,
    });
  }
  const rank: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.customerId ?? r.id) ? false : (seen.add(r.customerId ?? r.id), true))).sort((a, b) => rank[a.prioridad] - rank[b.prioridad]);
}

export function ruleAlerts(ctx: InsightContext): CommercialAlert[] {
  const out: CommercialAlert[] = [];
  const r = ctx.rules;
  // 1. Frecuentes cuya actividad disminuyó: últimos 90 días < 50 % de su promedio trimestral previo
  for (const v of ctx.views.filter((x) => x.segment === 'frecuente' && x.valorTrimestralPrevio > 0 && x.valor90d < 0.5 * x.valorTrimestralPrevio).slice(0, 5)) {
    out.push({
      id: `al-baja-${v.id}`, categoria: 'actividad_baja', titulo: `${v.empresa}: actividad en descenso`, customerId: v.id, prioridad: 'alta', tipo: 'regla',
      motivo: `Compró ${formatCOPShort(v.valor90d)} en los últimos 90 días frente a un promedio trimestral de ${formatCOPShort(v.valorTrimestralPrevio)}`,
      evidencia: [`Caída: ${formatPct(1 - v.valor90d / v.valorTrimestralPrevio, 0)}`, `Compras 12 meses: ${v.compras12m}`],
      accion: 'Contactar para entender el cambio y ofrecer acompañamiento',
    });
  }
  // 2. Oportunidades de recompra
  for (const { v, d } of recompraCandidates(ctx).filter((x) => x.d <= 15).slice(0, 5)) {
    out.push({
      id: `al-rec-${v.id}`, categoria: 'recompra', titulo: `${v.empresa}: recompra ${d < 0 ? 'atrasada' : 'próxima'}`, customerId: v.id, prioridad: 'media', tipo: 'regla',
      motivo: d < 0 ? `La compra estimada se atrasó ${-d} días` : `Compra estimada en ${d} días`,
      evidencia: [`Intervalo promedio: ${Math.round(v.intervaloPromedio!)} días`, `Última compra hace ${v.diasSinCompra} días`],
      accion: 'Preparar propuesta de recompra',
    });
  }
  // 3. Clientes de alto valor en riesgo de inactividad
  for (const v of riesgoInactividad(ctx).filter((x) => x.valor12m > 50_000_000).slice(0, 4)) {
    out.push({
      id: `al-rie-${v.id}`, categoria: 'riesgo', titulo: `${v.empresa}: riesgo de inactividad`, customerId: v.id, prioridad: 'alta', tipo: 'regla',
      motivo: `${v.diasSinCompra} días sin compra con un ciclo normal de ${Math.round(v.intervaloPromedio!)} días`,
      evidencia: [`Valor 12 meses: ${formatCOPShort(v.valor12m)}`, `Canal preferido: ${v.canal}`], accion: `${canal(v)} en las próximas 48 horas`,
    });
  }
  // 4. Concentración de inactivos por ciudad
  const porCiudad = new Map<string, { total: number; inactivos: number }>();
  for (const v of ctx.views) {
    const c = porCiudad.get(v.ciudad) ?? { total: 0, inactivos: 0 };
    c.total++;
    if (v.diasSinCompra === null || v.diasSinCompra > r.frioDiasSinCompra) c.inactivos++;
    porCiudad.set(v.ciudad, c);
  }
  for (const [ciudad, c] of porCiudad) {
    if (c.total >= MIN_CLIENTES && c.inactivos / c.total >= 0.4) {
      out.push({
        id: `al-ciu-${ciudad}`, categoria: 'inactivos_ciudad', titulo: `${ciudad}: concentración de inactivos`, prioridad: 'media', tipo: 'descriptivo',
        motivo: `${c.inactivos} de ${c.total} clientes (${formatPct(c.inactivos / c.total, 0)}) llevan más de ${r.frioDiasSinCompra} días sin comprar`,
        evidencia: [`Umbral de alerta: 40 % de la ciudad`], accion: `Campaña de reactivación en ${ciudad}`,
      });
    }
  }
  // 5. Cambio relevante: ventas del último mes frente al promedio de los 3 anteriores
  const m = ctx.ventasPorMes;
  if (m.length >= 4) {
    const last = m.at(-1)!;
    const prev = m.slice(-4, -1);
    const avg = prev.reduce((a, x) => a + x.valor, 0) / 3;
    const ch = avg ? (last.valor - avg) / avg : 0;
    if (Math.abs(ch) >= 0.2) {
      out.push({
        id: 'al-cambio', categoria: 'cambio_comportamiento', titulo: `Ventas de ${last.mes} ${ch > 0 ? 'por encima' : 'por debajo'} de lo habitual`, prioridad: ch < 0 ? 'alta' : 'baja', tipo: 'descriptivo',
        motivo: `${formatCOPShort(last.valor)} frente a un promedio de ${formatCOPShort(avg)} en los 3 meses anteriores (${ch > 0 ? '+' : ''}${formatPct(ch, 0)})`,
        evidencia: prev.map((p) => `${p.mes}: ${formatCOPShort(p.valor)}`), accion: ch < 0 ? 'Revisar el pipeline del mes' : 'Identificar qué impulsó el crecimiento',
      });
    }
  }
  const rank: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };
  return out.sort((a, b) => rank[a.prioridad] - rank[b.prioridad]);
}

function answer(pregunta: string, ctx: InsightContext): InsightAnswer {
  const q = norm(pregunta);
  const base = { modo: 'reglas' as const };
  if (ctx.views.length < MIN_CLIENTES) {
    return { ...base, texto: 'No hay datos suficientes para responder: hay menos de 3 clientes con los filtros actuales.', tipo: 'descriptivo', evidencia: [`Clientes en el contexto: ${ctx.views.length}`], items: [], datosSuficientes: false };
  }
  if (/probab|nueva compra|recompr|volver a comprar/.test(q)) {
    const l = recompraCandidates(ctx);
    if (!l.length) return { ...base, texto: 'Ningún cliente cumple la regla de recompra próxima con los datos actuales.', tipo: 'regla', evidencia: ['Regla: próxima compra estimada en ≤ 30 días o atrasada hasta medio ciclo; mínimo 3 compras'], items: [], datosSuficientes: true };
    return {
      ...base, tipo: 'regla', datosSuficientes: true,
      texto: `${l.length} clientes cumplen la regla de recompra próxima. Es un ranking por reglas de negocio, no una probabilidad estadística: no proviene de un modelo entrenado.`,
      evidencia: ['Próxima compra estimada = última compra + intervalo promedio entre compras', 'Incluye clientes no fríos con al menos 3 compras', `Fecha de referencia: ${ctx.rules.fechaReferencia}`],
      items: l.slice(0, 10).map(({ v, d }) => ({ id: v.id, titulo: v.empresa, detalle: d < 0 ? `Atrasada ${-d} días · ciclo ${Math.round(v.intervaloPromedio!)} d` : `En ${d} días · ciclo ${Math.round(v.intervaloPromedio!)} d`, valor: formatCOPShort(v.valor12m) })),
    };
  }
  if (/riesgo|inactiv|dejar de comprar|abandono|perder/.test(q)) {
    const l = riesgoInactividad(ctx);
    return {
      ...base, tipo: 'regla', datosSuficientes: true,
      texto: l.length ? `${l.length} clientes muestran riesgo de inactividad según las reglas.` : 'Ningún cliente cumple las reglas de riesgo de inactividad.',
      evidencia: [`Frecuentes con más de 1,5 ciclos sin comprar`, `Clientes con ${ctx.rules.frioDiasSinCompra + 1}–${ctx.rules.inactividadDias} días sin compra`],
      items: l.slice(0, 10).map((v) => ({ id: v.id, titulo: v.empresa, detalle: `${v.diasSinCompra} días sin compra · ciclo ${Math.round(v.intervaloPromedio!)} d`, valor: formatCOPShort(v.valor12m) })),
    };
  }
  if (/ciudad|ciudades|region/.test(q)) {
    const rec = new Set(recompraCandidates(ctx).map((x) => x.v.id));
    const rie = new Set(riesgoInactividad(ctx).map((v) => v.id));
    const m = new Map<string, { clientes: number; reactivar: number; recompra: number; valor: number }>();
    for (const v of ctx.views) {
      const c = m.get(v.ciudad) ?? { clientes: 0, reactivar: 0, recompra: 0, valor: 0 };
      c.clientes++; c.valor += v.valor12m;
      if (rie.has(v.id)) c.reactivar++;
      if (rec.has(v.id)) c.recompra++;
      m.set(v.ciudad, c);
    }
    const l = [...m.entries()].map(([ciudad, c]) => ({ ciudad, ...c, oportunidades: c.reactivar + c.recompra })).sort((a, b) => b.oportunidades - a.oportunidades || b.valor - a.valor);
    return {
      ...base, tipo: 'descriptivo', datosSuficientes: true,
      texto: `${l[0].ciudad} concentra más oportunidades: ${l[0].oportunidades} (recompras próximas + clientes por reactivar).`,
      evidencia: ['Oportunidades = clientes con recompra próxima + clientes en riesgo de inactividad', 'Desempate por valor de ventas de 12 meses'],
      items: l.map((c) => ({ titulo: c.ciudad, detalle: `${c.recompra} recompras próximas · ${c.reactivar} por reactivar · ${c.clientes} clientes`, valor: formatCOPShort(c.valor) })),
    };
  }
  if (/prioritari|contactar|contacto|llamar|prioridad/.test(q)) {
    const l = ruleRecommendations(ctx);
    return {
      ...base, tipo: 'regla', datosSuficientes: true,
      texto: l.length ? `Prioriza ${l.filter((r) => r.prioridad === 'alta').length} contactos de prioridad alta. Orden: recompras próximas y riesgo de inactividad.` : 'No hay clientes que cumplan las reglas de contacto prioritario.',
      evidencia: ['Prioridad alta: recompra estimada en ≤ 7 días o cliente en riesgo con más de $50 M en ventas de 12 meses'],
      items: l.slice(0, 10).map((r) => ({ id: r.customerId, titulo: `${r.objetivo} · ${r.prioridad}`, detalle: `${r.motivo}. Acción: ${r.accion}` })),
    };
  }
  if (/segment|mayor valor|valor comercial/.test(q)) {
    const total = ctx.views.reduce((a, v) => a + v.valorAcumulado, 0);
    const l = SEGMENTS.map((s) => {
      const vs = ctx.views.filter((v) => v.segment === s);
      return { s, n: vs.length, valor: vs.reduce((a, v) => a + v.valorAcumulado, 0) };
    }).sort((a, b) => b.valor - a.valor);
    return {
      ...base, tipo: 'descriptivo', datosSuficientes: total > 0,
      texto: total > 0 ? `El segmento ${SEGMENT_META[l[0].s].label} concentra el mayor valor: ${formatPct(l[0].valor / total)} de las ventas acumuladas.` : 'No hay ventas registradas para calcular el valor por segmento.',
      evidencia: ['Valor = ventas confirmadas acumuladas en COP (USD convertido con la TRM de la fecha)'],
      items: l.map((x) => ({ titulo: SEGMENT_META[x.s].label, detalle: `${x.n} clientes · ${formatPct(total ? x.valor / total : 0)}`, valor: formatCOPShort(x.valor) })),
    };
  }
  return {
    ...base, tipo: 'descriptivo', datosSuficientes: false, items: [],
    texto: 'Puedo responder sobre recompra, riesgo de inactividad, ciudades con oportunidades, contactos prioritarios y valor por segmento. Para otras preguntas no tengo datos suficientes y no voy a inventar una respuesta.',
    evidencia: ['Conecta el backend de IA para preguntas abiertas'],
  };
}

export const rulesInsightsService: AIInsightsService = {
  modo: 'reglas',
  ask: async (q, ctx) => answer(q, ctx),
  alerts: async (ctx) => ruleAlerts(ctx),
  recommendations: async (ctx) => ruleRecommendations(ctx),
};
