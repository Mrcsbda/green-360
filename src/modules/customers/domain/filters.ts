import type { Segment } from './customer';
import type { CustomerView } from './segmentation';

export interface CustomerFilters {
  q: string;
  segments: Segment[];
  ciudades: string[];
  canales: string[];
}
export const EMPTY_FILTERS: CustomerFilters = { q: '', segments: [], ciudades: [], canales: [] };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Todos los filtros se combinan (AND entre grupos, OR dentro de cada grupo). */
export function applyFilters(views: CustomerView[], f: CustomerFilters) {
  const q = norm(f.q.trim());
  return views.filter((v) =>
    (!q || norm(v.empresa).includes(q)) &&
    (!f.segments.length || f.segments.includes(v.segment)) &&
    (!f.ciudades.length || f.ciudades.includes(v.ciudad)) &&
    (!f.canales.length || f.canales.includes(v.canal)));
}

export const distinct = (views: CustomerView[], key: 'ciudad' | 'canal' | 'sector') => [...new Set(views.map((v) => v[key]).filter(Boolean))].sort();
