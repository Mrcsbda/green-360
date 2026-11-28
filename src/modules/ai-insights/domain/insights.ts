import type { CustomerView, SegmentationRules } from '@/modules/customers/domain/segmentation';

/**
 * Tipo de análisis: se muestra siempre en la UI para no confundir reglas con predicciones.
 * - regla: reglas de negocio deterministas (umbrales configurables)
 * - descriptivo: conteos y sumas sobre los datos
 * - modelo: predicción de un modelo entrenado (Colab / MoE / Hugging Face)
 */
export type AnalysisKind = 'regla' | 'descriptivo' | 'modelo';
export type Priority = 'alta' | 'media' | 'baja';

export interface InsightItem {
  id?: string;
  titulo: string;
  detalle: string;
  valor?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AutomationRecipient {
  id: string;
  empresa: string;
  email: string;
  ciudad: string;
  segmento: string;
  clusterId: number;
  demandaMoeCOP: number;
}

export interface EmailAutomationDraft {
  tipo: 'mass_email_n8n';
  estado: 'borrador' | 'enviado' | 'error';
  segmentoDescripcion: string;
  clusterDominante: number;
  expertoMoE: string;
  pesosExpertos: number[];
  productoFoco: string;
  moePrompt: string;
  asunto: string;
  cuerpo: string;
  totalClientesObjetivo: number;
  conCorreo: number;
  sinCorreo: number;
  destinatarios: AutomationRecipient[];
  resultadoEnvio?: {
    ok: boolean;
    sentCount: number;
    skippedCount: number;
    message: string;
  };
}

export interface InsightAnswer {
  texto: string;
  tipo: AnalysisKind;
  evidencia: string[];
  items: InsightItem[];
  /** false cuando los datos no alcanzan o la consulta sale del dominio de Green Services. */
  datosSuficientes: boolean;
  modo: 'reglas' | 'conectado';
  modelo?: string;
  automation?: EmailAutomationDraft;
}

export interface Recommendation {
  id: string;
  objetivo: string; // cliente o segmento
  customerId?: string;
  motivo: string;
  evidencia: string[];
  prioridad: Priority;
  accion: string;
  tipo: AnalysisKind;
}

export interface CommercialAlert {
  id: string;
  titulo: string;
  categoria: 'actividad_baja' | 'recompra' | 'riesgo' | 'inactivos_ciudad' | 'cambio_comportamiento';
  motivo: string;
  evidencia: string[];
  prioridad: Priority;
  accion: string;
  customerId?: string;
  tipo: AnalysisKind;
}

export interface InsightContext {
  views: CustomerView[];
  rules: SegmentationRules;
  /** Ventas confirmadas por mes (yyyy-mm → COP) de los clientes del contexto. */
  ventasPorMes: { mes: string; valor: number }[];
  /** Resumen de lo que muestra el Dashboard; lo arma el chat antes de enviar la pregunta. */
  dashboard?: DashboardSnapshot;
}

/** Cifras del Dashboard (KPIs, gráficas, Colab y operaciones) para que el chat responda sobre ellas. */
export interface DashboardSnapshot {
  fechaReferencia: string;
  kpis: {
    totalClientes: number;
    frecuentes: number;
    frios: number;
    sinSegmentar: number;
    ventasAcumuladasCOP: number;
    sinActividadReciente: number;
  };
  segmentos: { segmento: string; clientes: number; valorCOP: number }[];
  ciudades: { ciudad: string; clientes: number }[];
  canales: { canal: string; clientes: number }[];
  ventasMensuales: { mes: string; valor: number }[];
  clustersColab: { clusterId: number; label: string; clientes: number; demandaMoeCOP: number; recomendacion: string }[];
  productosColab: { producto: string; demandaMoeCOP: number; prioridad: string }[];
  licencias: { total: number; porVencer: number; vencidas: number };
  proximasCapacitaciones: { nombre: string; fecha: string; hora: string; cliente: string }[];
}

/** Puerto del asistente: reglas locales o backend Hugging Face + GreenSight MoE + n8n. */
export interface AIInsightsService {
  readonly modo: 'reglas' | 'conectado';
  ask(pregunta: string, ctx: InsightContext, history?: ChatTurn[]): Promise<InsightAnswer>;
  alerts(ctx: InsightContext): Promise<CommercialAlert[]>;
  recommendations(ctx: InsightContext): Promise<Recommendation[]>;
}

export const SUGGESTED_QUESTIONS = [
  '¿Qué clientes tienen mayor probabilidad de realizar una nueva compra?',
  '¿Cuáles son los clientes que presentan riesgo de inactividad?',
  '¿Qué productos recomienda reponer el modelo MoE de Colab?',
  '¿Qué ciudades concentran las mejores oportunidades comerciales?',
  'Manda un correo masivo vía n8n a los clientes fríos usando el prompt MoE',
];

export const AUTOMATION_SUGGESTIONS = [
  'Envía un correo masivo por n8n a los clientes fríos invitándolos a reactivar su servicio de respaldo',
  'Genera una campaña de correo con MoE para clientes VIP de alta prioridad en Green Services',
];
