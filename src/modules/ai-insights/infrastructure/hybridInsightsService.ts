import { env } from '@/core/config/env';
import { formatCOPShort, formatDate, formatMonth } from '@/core/utils/format';
import type { GreenSightColabReport } from '@/modules/analytics/domain/colabInsights';
import { useColabStore } from '@/modules/analytics/infrastructure/colabClient';
import { SEGMENT_META } from '@/modules/customers/domain/customer';
import type { CustomerView } from '@/modules/customers/domain/segmentation';
import {
  buildLocalMoeEmailDraft,
  checkGreenServicesTopic,
  findMentionedCustomers,
  isMassEmailAutomationIntent,
} from '../domain/guardrail';
import type { AIInsightsService, ChatTurn, DashboardSnapshot, InsightAnswer, InsightContext } from '../domain/insights';
import { buildDashboardSnapshot } from './dashboardSnapshot';
import { createHttpInsightsService } from './httpInsightsService';

/** Ficha de uno o varios clientes registrados, con datos comerciales y la predicción de Colab. */
function customerAnswer(found: CustomerView[], report: GreenSightColabReport): InsightAnswer {
  const ml = new Map(report.customers.map((c) => [c.id, c]));
  const items = found.map((v) => {
    const m = ml.get(v.id);
    return {
      id: v.id,
      titulo: v.empresa,
      detalle: [
        `${v.ciudad} · ${v.sector}`,
        SEGMENT_META[v.segment].label,
        `${v.numCompras} compras (${v.compras12m} en 12 meses)`,
        `última compra ${formatDate(v.ultimaCompra)}`,
        v.diasSinCompra !== null ? `${v.diasSinCompra} días sin comprar` : null,
        v.proximaCompraEstimada ? `próxima estimada ${formatDate(v.proximaCompraEstimada)}` : null,
        `canal ${v.canal || 'sin canal'}`,
        m ? `Colab: ${m.clusterLabel} · recomienda ${m.productoRecomendado} (MoE ${formatCOPShort(m.demandaMoeCOP)})` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      valor: formatCOPShort(v.valor12m),
    };
  });
  const v = found[0];
  const m = ml.get(v.id);
  const texto =
    found.length === 1
      ? `**${v.empresa}** (${v.ciudad}) está en el segmento **${SEGMENT_META[v.segment].label}**: ${v.numCompras} compras confirmadas, ` +
        `${formatCOPShort(v.valorAcumulado)} acumulados y ${formatCOPShort(v.valor12m)} en los últimos 12 meses.` +
        (m ? ` GreenSight lo ubica en **${m.clusterLabel}** y recomienda **${m.productoRecomendado}**: ${m.recomendacion}.` : '')
      : `Encontré **${found.length} clientes registrados** que coinciden con tu pregunta:`;
  return {
    texto,
    tipo: m ? 'modelo' : 'descriptivo',
    evidencia: found.map((x) => `${x.empresa}: ${x.segmento.motivo}`),
    items,
    datosSuficientes: true,
    modo: 'reglas',
    modelo: 'Clientes registrados Green 360°',
  };
}

/** Respuestas sobre las cifras del Dashboard (KPIs, ventas mensuales, canales, licencias y capacitaciones). */
function dashboardAnswer(q: string, d: DashboardSnapshot): InsightAnswer {
  const base = { tipo: 'descriptivo' as const, datosSuficientes: true, modo: 'reglas' as const, modelo: 'Dashboard Green 360°' };
  if (/licenc|vencid|vencer|capacitac/.test(q)) {
    return {
      ...base,
      texto: `De ${d.licencias.total} licencias, **${d.licencias.porVencer} vencen en los próximos 30 días** y **${d.licencias.vencidas} ya están vencidas**. Hay ${d.proximasCapacitaciones.length} capacitaciones programadas próximamente.`,
      evidencia: ['Mismo cálculo de la tarjeta "Servicios y operaciones" del Dashboard'],
      items: d.proximasCapacitaciones.map((t) => ({ titulo: t.nombre, detalle: `${t.cliente} · ${formatDate(t.fecha)} ${t.hora}` })),
    };
  }
  if (/canal/.test(q)) {
    return {
      ...base,
      texto: `El canal preferido más común es **${d.canales[0]?.canal ?? '—'}** (${d.canales[0]?.clientes ?? 0} clientes).`,
      evidencia: ['Canal preferido registrado en cada cliente'],
      items: d.canales.map((c) => ({ titulo: c.canal, detalle: `${c.clientes} clientes` })),
    };
  }
  if (/\bmes|mensual|ventas|factur/.test(q) && d.ventasMensuales.length) {
    const last = d.ventasMensuales.at(-1)!;
    return {
      ...base,
      texto: `Las ventas acumuladas son **${formatCOPShort(d.kpis.ventasAcumuladasCOP)}**. El último mes (${formatMonth(last.mes)}) cerró en **${formatCOPShort(last.valor)}**.`,
      evidencia: ['Ventas confirmadas en COP; USD convertido con la TRM de cada fecha', `Fecha de referencia: ${formatDate(d.fechaReferencia)}`],
      items: d.ventasMensuales.slice(-6).reverse().map((m) => ({ titulo: formatMonth(m.mes), detalle: 'Ventas confirmadas', valor: formatCOPShort(m.valor) })),
    };
  }
  const k = d.kpis;
  return {
    ...base,
    texto:
      `El Dashboard muestra **${k.totalClientes} clientes**: ${k.frecuentes} frecuentes, ${k.frios} fríos y ${k.sinSegmentar} sin segmentar. ` +
      `Ventas acumuladas **${formatCOPShort(k.ventasAcumuladasCOP)}** y ${k.sinActividadReciente} clientes sin actividad reciente.`,
    evidencia: [`Datos al ${formatDate(d.fechaReferencia)}`, 'KPIs calculados sobre los clientes visibles con los filtros activos'],
    items: [
      ...d.ciudades.slice(0, 3).map((c) => ({ titulo: c.ciudad, detalle: `${c.clientes} clientes` })),
      ...d.clustersColab.map((c) => ({ titulo: `Clúster ${c.label}`, detalle: `${c.clientes} clientes · ${c.recomendacion}`, valor: formatCOPShort(c.demandaMoeCOP) })),
    ],
  };
}
import { ruleAlerts, ruleRecommendations, rulesInsightsService } from './rulesInsightsService';

/**
 * Servicio adaptativo para la app:
 * 1) Si hay Backend/Colab URL configurada (en .env o en tiempo de ejecución desde el Dashboard),
 *    usa el backend con Hugging Face + GreenSight MoE + n8n.
 * 2) Si no está conectado o el servidor local está apagado, aplica localmente el guardrail estricto
 *    de Green Services, conversación multi-turno, datos sincronizados de Colab y generador de prompt MoE.
 */
export const hybridInsightsService: AIInsightsService = {
  get modo() {
    const runtimeUrl = useColabStore.getState().urls.apiUrl || env.aiApiUrl;
    return runtimeUrl ? ('conectado' as const) : ('reglas' as const);
  },

  async ask(pregunta: string, ctx: InsightContext, history: ChatTurn[] = []): Promise<InsightAnswer> {
    let mentioned = findMentionedCustomers(pregunta, ctx.views);
    const scope = checkGreenServicesTopic(pregunta, history, mentioned.length > 0);
    if (!scope.allowed) {
      return {
        texto: scope.reason,
        tipo: 'regla',
        evidencia: ['Restricción de dominio activa: solo Green Services / Green 360°'],
        items: [],
        datosSuficientes: false,
        modo: this.modo,
        modelo: 'Guardrail Green Services',
      };
    }

    // "¿y cuánto compró?" / "¿cuál es su canal?" sigue hablando del cliente de la pregunta anterior.
    const q = pregunta.toLowerCase();
    if (!mentioned.length && (scope.kind === 'follow_up' || /\b(ese|esa|este|esta|su|sus)\b/.test(q))) {
      const lastUser = [...history].reverse().find((h) => h.role === 'user')?.content ?? '';
      mentioned = findMentionedCustomers(lastUser, ctx.views);
    }

    const report = useColabStore.getState().report;
    const dashboard = await buildDashboardSnapshot(ctx, report).catch(() => undefined);

    const runtimeApiUrl = (useColabStore.getState().urls.apiUrl || env.aiApiUrl).trim();
    if (runtimeApiUrl) {
      try {
        const http = createHttpInsightsService(runtimeApiUrl);
        return await http.ask(pregunta, { ...ctx, dashboard }, history);
      } catch {
        // Continúa con respaldo local GreenSight MoE indicando que el servidor remoto no respondió
      }
    }

    if (scope.kind === 'greeting') {
      return {
        texto:
          'Hola, soy el asistente de **Green Services (Green 360°)** conectado a **GreenSight MoE**. Puedo analizar tus clientes y productos de Colab, responder preguntas comerciales o redactar y enviar correos masivos por **n8n**.',
        tipo: 'descriptivo',
        evidencia: [
          `Clientes visibles: ${ctx.views.length}`,
          `Colab MoE R²: ${report.moeMetrics.r2.toFixed(2)} · Varianza PCA: ${(report.pca.cumulativeVariance * 100).toFixed(1)}%`,
        ],
        items: [],
        datosSuficientes: true,
        modo: 'reglas',
        modelo: 'GreenSight MoE Local',
      };
    }

    if (isMassEmailAutomationIntent(pregunta)) {
      const draft = buildLocalMoeEmailDraft(pregunta, ctx, report);
      return {
        texto:
          `He construido la campaña de correo masivo vía **n8n** para **${draft.totalClientesObjetivo} cliente(s)** (${draft.segmentoDescripcion}) usando **${draft.expertoMoE}**.\n\n` +
          'Revisa el prompt MoE, asunto y cuerpo abajo antes de enviarlo por n8n.',
        tipo: 'modelo',
        evidencia: [
          `Pesos MoE promedio: [${draft.pesosExpertos.join(', ')}]`,
          `Producto foco: ${draft.productoFoco}`,
          `Con correo: ${draft.conCorreo} · Sin correo: ${draft.sinCorreo}`,
        ],
        items: draft.destinatarios.slice(0, 5).map((d) => ({
          id: d.id,
          titulo: d.empresa,
          detalle: `${d.ciudad} · ${d.email || 'Sin correo registrado (usa correo de prueba)'}`,
          valor: formatCOPShort(d.demandaMoeCOP),
        })),
        datosSuficientes: draft.totalClientesObjetivo > 0,
        modo: 'reglas',
        modelo: 'GreenSight MoE Local (conecta Docker para Hugging Face LLM)',
        automation: draft,
      };
    }

    if (mentioned.length) return customerAnswer(mentioned, report);

    if (/producto|necesidad|reposic|moe|cluster|pca|glm|colab/.test(q)) {
      return {
        texto:
          `Según el análisis de Colab (**PCA ${(report.pca.cumulativeVariance * 100).toFixed(1)}%**, **K-Means k=3**, **GLM Tweedie + MoE R² ${report.moeMetrics.r2.toFixed(2)}**), ` +
          `los productos de mayor necesidad prioritaria son **${report.products[0]?.producto}** (${formatCOPShort(report.products[0]?.demandaMoeCOP ?? 0)}) y **${report.products[1]?.producto}**.`,
        tipo: 'modelo',
        evidencia: report.clusters.map(
          (c) => `C${c.clusterId} ${c.label}: ${c.count} clientes · MoE ${formatCOPShort(c.demandaMoeTotalCOP)}`,
        ),
        items: report.products.slice(0, 5).map((p) => ({
          titulo: p.producto,
          detalle: `${p.recomendacion} · ${p.ventasConfirmadas} ventas`,
          valor: formatCOPShort(p.demandaMoeCOP),
        })),
        datosSuficientes: true,
        modo: 'reglas',
        modelo: 'GreenSight Colab MoE',
      };
    }

    const base = await rulesInsightsService.ask(pregunta, ctx);
    // Lo que las reglas no cubren se responde con las cifras del Dashboard.
    if (!base.datosSuficientes && ctx.views.length >= 3 && dashboard) {
      return dashboardAnswer(q.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), dashboard);
    }
    return {
      ...base,
      modelo: base.datosSuficientes ? 'Reglas deterministas + Green 360°' : 'Guardrail Green Services',
    };
  },

  alerts: async (ctx) => ruleAlerts(ctx),
  recommendations: async (ctx) => ruleRecommendations(ctx),
};
