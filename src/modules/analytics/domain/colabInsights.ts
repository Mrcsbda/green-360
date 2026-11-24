import bundledReport from '@/data/colab/greensight_insights.json';
import type { CustomerView } from '@/modules/customers/domain/segmentation';

export interface ColabMetadata {
  modelName: string;
  source: string;
  generatedAt: string;
  fechaReferencia: string;
  nClientes: number;
  nVentasConfirmadas: number;
  nProductos: number;
  nClusters: number;
  tweedieVarPower: number;
  colabNotebookUrl: string;
}

export interface ColabPcaSummary {
  explainedVarianceRatio: number[];
  cumulativeVariance: number;
  features: string[];
  loadings: Record<string, number[]>;
}

export interface ColabMoeMetrics {
  mse: number;
  rmse: number;
  mae: number;
  r2: number;
  silhouetteScore: number;
  expertNames: string[];
}

export interface ColabClusterSummary {
  clusterId: number;
  label: string;
  count: number;
  pct: number;
  avgRecenciaDias: number;
  avgFrecuencia12m: number;
  avgTicketCOP: number;
  demandaGlmTotalCOP: number;
  demandaMoeTotalCOP: number;
  pesosExpertosPromedio: number[];
  centroidPca: number[];
  recomendacion: string;
  prioridad: 'alta' | 'media' | 'baja';
}

export interface ColabCustomerInsight {
  id: string;
  empresa: string;
  ciudad: string;
  sector: string;
  canal: string;
  clusterId: number;
  clusterLabel: string;
  pca: [number, number, number];
  frecuencia12m: number;
  recenciaDias: number;
  ticketPromedioCOP: number;
  demandaGlmCOP: number;
  demandaMoeCOP: number;
  pesosExpertos: number[];
  productoRecomendado: string;
  prioridad: 'alta' | 'media' | 'baja';
  recomendacion: string;
}

export interface ColabProductInsight {
  producto: string;
  ventasConfirmadas: number;
  unidades: number;
  clientesUnicos: number;
  valorHistoricoCOP: number;
  ticketPromedioCOP: number;
  tendencia90d: number;
  clusterDemanda: number;
  demandaGlmCOP: number;
  demandaMoeCOP: number;
  pesosExpertos: number[];
  prioridad: 'alta' | 'media' | 'baja';
  recomendacion: string;
}

export interface GreenSightColabReport {
  metadata: ColabMetadata;
  pca: ColabPcaSummary;
  moeMetrics: ColabMoeMetrics;
  clusters: ColabClusterSummary[];
  customers: ColabCustomerInsight[];
  products: ColabProductInsight[];
}

export function getBundledColabReport(): GreenSightColabReport {
  return bundledReport as unknown as GreenSightColabReport;
}

export function isValidColabReport(raw: unknown): raw is GreenSightColabReport {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Partial<GreenSightColabReport>;
  return !!(
    r.metadata &&
    r.pca &&
    r.moeMetrics &&
    Array.isArray(r.clusters) &&
    Array.isArray(r.customers) &&
    Array.isArray(r.products)
  );
}

/** Cruza el reporte de Colab con los clientes actualmente visibles (si hay filtros o ediciones locales). */
export function summarizeColabForViews(report: GreenSightColabReport, views: CustomerView[]) {
  const byId = new Map(report.customers.map((c) => [c.id, c]));
  const matched = views.map((v) => byId.get(v.id)).filter((x): x is ColabCustomerInsight => !!x);
  const totalGlm = matched.reduce((acc, c) => acc + c.demandaGlmCOP, 0);
  const totalMoe = matched.reduce((acc, c) => acc + c.demandaMoeCOP, 0);
  return { matched, totalGlm, totalMoe };
}
