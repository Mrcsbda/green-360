import type { CustomerView, SegmentationRules } from '@/modules/customers/domain/segmentation';

/**
 * Tipo de análisis: se muestra siempre en la UI para no confundir reglas con predicciones.
 * - regla: reglas de negocio deterministas (umbrales configurables)
 * - descriptivo: conteos y sumas sobre los datos
 * - modelo: predicción de un modelo entrenado (solo en modo conectado)
 */
export type AnalysisKind = 'regla' | 'descriptivo' | 'modelo';
export type Priority = 'alta' | 'media' | 'baja';

export interface InsightItem { id?: string; titulo: string; detalle: string; valor?: string }

export interface InsightAnswer {
  texto: string;
  tipo: AnalysisKind;
  evidencia: string[];
  items: InsightItem[];
  /** false cuando los datos no alcanzan para responder: el asistente lo dice en vez de inventar. */
  datosSuficientes: boolean;
  modo: 'reglas' | 'conectado';
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
}

/** Puerto del asistente: reglas locales o un backend que consulta un LLM sin exponer claves en el cliente. */
export interface AIInsightsService {
  readonly modo: 'reglas' | 'conectado';
  ask(pregunta: string, ctx: InsightContext): Promise<InsightAnswer>;
  alerts(ctx: InsightContext): Promise<CommercialAlert[]>;
  recommendations(ctx: InsightContext): Promise<Recommendation[]>;
}

export const SUGGESTED_QUESTIONS = [
  '¿Qué clientes tienen mayor probabilidad de realizar una nueva compra?',
  '¿Cuáles son los clientes que presentan riesgo de inactividad?',
  '¿Qué ciudades concentran las mejores oportunidades comerciales?',
  '¿Qué clientes deberían ser contactados prioritariamente?',
  '¿Qué segmentos concentran el mayor valor comercial?',
];
