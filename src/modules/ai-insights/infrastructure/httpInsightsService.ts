import type {
  AIInsightsService,
  ChatTurn,
  EmailAutomationDraft,
  InsightAnswer,
  InsightContext,
} from '../domain/insights';
import { ruleAlerts, ruleRecommendations } from './rulesInsightsService';

/**
 * Modo conectado: el cliente NO llama al proveedor de IA ni guarda claves. Envía la pregunta,
 * el historial conversacional y un resumen mínimo (sin contacto, correo ni teléfono) al backend propio
 * (FastAPI + Hugging Face + GreenSight ML + n8n).
 */
export function createHttpInsightsService(baseUrl: string): AIInsightsService {
  const root = baseUrl.replace(/\/$/, '');
  return {
    modo: 'conectado',
    async ask(pregunta: string, ctx: InsightContext, history: ChatTurn[] = []): Promise<InsightAnswer> {
      const res = await fetch(`${root}/insights/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pregunta,
          history: history.slice(-10),
          fechaReferencia: ctx.rules.fechaReferencia,
          clientes: ctx.views.slice(0, 500).map((v) => ({
            id: v.id,
            empresa: v.empresa,
            ciudad: v.ciudad,
            sector: v.sector,
            canal: v.canal,
            segmento: v.segment,
            diasSinCompra: v.diasSinCompra,
            compras12m: v.compras12m,
            valor12m: Math.round(v.valor12m),
            intervaloPromedio: v.intervaloPromedio,
            tieneCorreo: Boolean(v.email?.trim()),
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

export async function dispatchN8nEmailCampaign(params: {
  apiUrl?: string;
  n8nWebhookUrl?: string;
  draft: EmailAutomationDraft;
  ctx: InsightContext;
  testEmailFallback?: string;
}): Promise<{ ok: boolean; sentCount: number; skippedCount: number; message: string }> {
  const emailById = new Map(params.ctx.views.map((v) => [v.id, v.email.trim()]));
  const enrichedRecipients = params.draft.destinatarios.map((d) => ({
    ...d,
    email: d.email?.trim() || emailById.get(d.id) || '',
  }));

  const apiRoot = params.apiUrl?.trim().replace(/\/$/, '');
  if (apiRoot) {
    const res = await fetch(`${apiRoot}/automations/email-campaign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        asunto: params.draft.asunto,
        cuerpo: params.draft.cuerpo,
        segmentoDescripcion: params.draft.segmentoDescripcion,
        expertoMoE: params.draft.expertoMoE,
        productoFoco: params.draft.productoFoco,
        moePrompt: params.draft.moePrompt,
        testEmailFallback: params.testEmailFallback?.trim() || '',
        destinatarios: enrichedRecipients,
        n8nWebhookUrl: params.n8nWebhookUrl?.trim() || '',
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Error al enviar vía backend/n8n (${res.status}): ${txt.slice(0, 180)}`);
    }
    return (await res.json()) as { ok: boolean; sentCount: number; skippedCount: number; message: string };
  }

  const webhook = params.n8nWebhookUrl?.trim();
  if (!webhook) {
    throw new Error(
      'Configura la URL del Backend Docker (http://localhost:8000) o del Webhook n8n en "Conectar Colab / n8n" en el Dashboard.',
    );
  }

  const fallback = params.testEmailFallback?.trim() || '';
  const deliverable = enrichedRecipients
    .map((r) => ({ ...r, email: r.email || fallback }))
    .filter((r) => !!r.email)
    .map((r) => ({
      ...r,
      asunto: params.draft.asunto.replaceAll('{{empresa}}', r.empresa).replaceAll('{{ciudad}}', r.ciudad || 'su ciudad'),
      cuerpo: params.draft.cuerpo.replaceAll('{{empresa}}', r.empresa).replaceAll('{{ciudad}}', r.ciudad || 'su ciudad'),
    }));

  if (!deliverable.length) {
    return {
      ok: false,
      sentCount: 0,
      skippedCount: enrichedRecipients.length,
      message: 'Ningún destinatario tiene correo registrado. Ingresa un correo de prueba para validar en n8n.',
    };
  }

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      campaign: {
        segmentoDescripcion: params.draft.segmentoDescripcion,
        expertoMoE: params.draft.expertoMoE,
        productoFoco: params.draft.productoFoco,
        moePrompt: params.draft.moePrompt,
        asuntoBase: params.draft.asunto,
      },
      recipients: deliverable,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Webhook n8n respondió HTTP ${res.status}`);
  return {
    ok: true,
    sentCount: deliverable.length,
    skippedCount: enrichedRecipients.length - deliverable.length,
    message: `Campaña ejecutada directamente en n8n para ${deliverable.length} cliente(s).`,
  };
}
