import { todayIso } from '@/core/utils/dates';
import { byChannel, byCity, bySegment, kpis } from '@/modules/analytics/domain/analytics';
import type { GreenSightColabReport } from '@/modules/analytics/domain/colabInsights';
import { licenseStatus } from '@/modules/services/licenses/domain/license';
import { licenseRepository, trainingRepository } from '@/modules/services/servicesRepositories';
import type { DashboardSnapshot, InsightContext } from '../domain/insights';

// Mismas colecciones locales que usa el Dashboard (sin caché en memoria, así que leen el dato actual).
const licenses = licenseRepository();
const trainings = trainingRepository();

/** Reproduce las cifras que el Dashboard muestra para que el chat responda sobre ellas sin inventar. */
export async function buildDashboardSnapshot(ctx: InsightContext, report: GreenSightColabReport): Promise<DashboardSnapshot> {
  const k = kpis(ctx.views, ctx.rules);
  const hoy = todayIso();
  const [lic, tr] = await Promise.all([licenses.list(), trainings.list()]).catch(() => [[], []] as const);

  return {
    fechaReferencia: ctx.rules.fechaReferencia,
    kpis: {
      totalClientes: k.total,
      frecuentes: k.frecuentes,
      frios: k.frios,
      sinSegmentar: k.sinSegmentar,
      ventasAcumuladasCOP: Math.round(k.valorAcumulado),
      sinActividadReciente: k.sinActividadReciente,
    },
    segmentos: bySegment(ctx.views).map((s) => ({ segmento: s.label, clientes: s.value, valorCOP: Math.round(s.valor) })),
    ciudades: byCity(ctx.views).map((s) => ({ ciudad: s.label, clientes: s.value })),
    canales: byChannel(ctx.views).map((s) => ({ canal: s.label, clientes: s.value })),
    ventasMensuales: ctx.ventasPorMes.slice(-12).map((m) => ({ mes: m.mes, valor: Math.round(m.valor) })),
    clustersColab: report.clusters.map((c) => ({
      clusterId: c.clusterId,
      label: c.label,
      clientes: c.count,
      demandaMoeCOP: Math.round(c.demandaMoeTotalCOP),
      recomendacion: c.recomendacion,
    })),
    productosColab: report.products.slice(0, 6).map((p) => ({
      producto: p.producto,
      demandaMoeCOP: Math.round(p.demandaMoeCOP),
      prioridad: p.prioridad,
    })),
    licencias: {
      total: lic.length,
      porVencer: lic.filter((l) => licenseStatus(l, hoy).estado === 'por_vencer').length,
      vencidas: lic.filter((l) => licenseStatus(l, hoy).estado === 'vencida').length,
    },
    proximasCapacitaciones: tr
      .filter((t) => t.estado === 'programada' && t.fecha >= hoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, 3)
      .map((t) => ({ nombre: t.nombre, fecha: t.fecha, hora: t.hora, cliente: t.cliente })),
  };
}
