import { env } from '@/core/config/env';
import { formatCOPShort } from '@/core/utils/format';
import { useColabStore } from '@/modules/analytics/infrastructure/colabClient';
import {
  buildLocalMoeEmailDraft,
  checkGreenServicesTopic,
  isMassEmailAutomationIntent,
} from '../domain/guardrail';
import type { AIInsightsService, ChatTurn, InsightAnswer, InsightContext } from '../domain/insights';
import { createHttpInsightsService } from './httpInsightsService';
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
    const scope = checkGreenServicesTopic(pregunta, history);
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

    const runtimeApiUrl = (useColabStore.getState().urls.apiUrl || env.aiApiUrl).trim();
    if (runtimeApiUrl) {
      try {
        const http = createHttpInsightsService(runtimeApiUrl);
        return await http.ask(pregunta, ctx, history);
      } catch {
        // Continúa con respaldo local GreenSight MoE indicando que el servidor remoto no respondió
      }
    }

    const report = useColabStore.getState().report;

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

    const q = pregunta.toLowerCase();
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
    return {
      ...base,
      modelo: base.datosSuficientes ? 'Reglas deterministas + Green 360°' : 'Guardrail Green Services',
    };
  },

  alerts: async (ctx) => ruleAlerts(ctx),
  recommendations: async (ctx) => ruleRecommendations(ctx),
};
