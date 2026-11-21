import type { AIInsightsService, InsightAnswer, InsightContext } from '../domain/insights';
import { ruleAlerts, ruleRecommendations } from './rulesInsightsService';

/**
 * Modo conectado: el cliente NO llama al proveedor de IA ni guarda claves. Envía la pregunta y un resumen
 * mínimo (sin contacto, correo ni teléfono) a un backend propio, que es quien consulta el modelo.
 * Contrato: POST {baseUrl}/insights/ask  →  InsightAnswer (ver README).
 * Alertas y recomendaciones siguen siendo reglas locales hasta que el backend las ofrezca.
 */
export function createHttpInsightsService(baseUrl: string): AIInsightsService {
  return {
    modo: 'conectado',
    async ask(pregunta: string, ctx: InsightContext): Promise<InsightAnswer> {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/insights/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pregunta,
          fechaReferencia: ctx.rules.fechaReferencia,
          clientes: ctx.views.slice(0, 500).map((v) => ({
            id: v.id, empresa: v.empresa, ciudad: v.ciudad, sector: v.sector, canal: v.canal, segmento: v.segment,
            diasSinCompra: v.diasSinCompra, compras12m: v.compras12m, valor12m: Math.round(v.valor12m), intervaloPromedio: v.intervaloPromedio,
          })),
          ventasPorMes: ctx.ventasPorMes,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`El servicio de IA respondió ${res.status}`);
      const data = (await res.json()) as InsightAnswer;
      return { ...data, modo: 'conectado' };
    },
    alerts: async (ctx) => ruleAlerts(ctx),
    recommendations: async (ctx) => ruleRecommendations(ctx),
  };
}
