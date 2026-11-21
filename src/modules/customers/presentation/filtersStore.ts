import { create } from 'zustand';
import { EMPTY_FILTERS, type CustomerFilters } from '../domain/filters';

type ListKey = 'segments' | 'ciudades' | 'canales';

interface FiltersState {
  filters: CustomerFilters;
  setQuery: (q: string) => void;
  toggle: (key: ListKey, value: string) => void;
  clear: () => void;
}

/** Filtros globales: los comparten la tabla, los KPIs, los gráficos y el asistente IA. */
export const useFiltersStore = create<FiltersState>((set) => ({
  filters: EMPTY_FILTERS,
  setQuery: (q) => set((s) => ({ filters: { ...s.filters, q } })),
  toggle: (key, value) => set((s) => {
    const cur = s.filters[key] as string[];
    return { filters: { ...s.filters, [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] } };
  }),
  clear: () => set({ filters: EMPTY_FILTERS }),
}));
