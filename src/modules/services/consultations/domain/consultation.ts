import { z } from 'zod';

export const QUERY_TYPES = ['Consulta documental', 'Recuperación de respaldo', 'Auditoría', 'Reporte', 'Soporte'] as const;
export const SERVICE_CATEGORIES = ['Backup y continuidad', 'Gestión documental', 'Digitalización', 'Soporte operativo'] as const;
export const CONSULTATION_STATES = ['abierta', 'en_proceso', 'cerrada'] as const;

export const consultationSchema = z.object({
  id: z.string().trim().min(1),
  cliente: z.string().trim().min(2, 'Cliente obligatorio'),
  baseDatos: z.string().trim().min(2, 'Base de datos obligatoria'),
  tipo: z.enum(QUERY_TYPES),
  categoria: z.enum(SERVICE_CATEGORIES),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha aaaa-mm-dd'),
  responsable: z.string().trim().min(2, 'Responsable obligatorio'),
  estado: z.enum(CONSULTATION_STATES),
  observaciones: z.string().max(500),
});
export type Consultation = z.infer<typeof consultationSchema>;

export interface ConsultationFilters {
  q: string; // código, cliente, base u observaciones
  tipo: string;
  categoria: string;
  estado: string;
  responsable: string;
  desde: string;
  hasta: string;
}
export const EMPTY_CONSULTATION_FILTERS: ConsultationFilters = { q: '', tipo: '', categoria: '', estado: '', responsable: '', desde: '', hasta: '' };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterConsultations(list: Consultation[], f: ConsultationFilters) {
  const q = norm(f.q.trim());
  return list.filter((c) =>
    (!q || [c.id, c.cliente, c.baseDatos, c.observaciones].some((x) => norm(x).includes(q))) &&
    (!f.tipo || c.tipo === f.tipo) && (!f.categoria || c.categoria === f.categoria) && (!f.estado || c.estado === f.estado) &&
    (!f.responsable || c.responsable === f.responsable) && (!f.desde || c.fecha >= f.desde) && (!f.hasta || c.fecha <= f.hasta));
}
