import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { container } from '@/core/providers/container';
import { monthKey } from '@/core/utils/dates';
import type { InsightContext } from '@/modules/ai-insights/domain/insights';
import type { CustomerForm } from '../domain/customer';
import { applyFilters } from '../domain/filters';
import type { SegmentationRules } from '../domain/segmentation';
import { useFiltersStore } from './filtersStore';

export const DATASET_KEY = ['customers', 'dataset'];
const svc = container.customerService;

export const useDataset = () => useQuery({ queryKey: DATASET_KEY, queryFn: () => svc.dataset() });

/** Clientes visibles según los filtros globales de segmentación. */
export function useFilteredViews() {
  const q = useDataset();
  const filters = useFiltersStore((s) => s.filters);
  const filtered = useMemo(() => (q.data ? applyFilters(q.data.views, filters) : []), [q.data, filters]);
  return { ...q, filtered, filters };
}

/** Contexto para el asistente IA: los clientes visibles y sus ventas por mes. */
export function useInsightContext(): InsightContext | null {
  const { data, filtered } = useFilteredViews();
  return useMemo(() => {
    if (!data) return null;
    const ids = new Set(filtered.map((v) => v.id));
    const m = new Map<string, number>();
    for (const s of data.sales) {
      if (s.estado !== 'Confirmada' || !ids.has(s.customerId) || s.fecha > data.rules.fechaReferencia) continue;
      m.set(monthKey(s.fecha), (m.get(monthKey(s.fecha)) ?? 0) + data.valueCOP(s));
    }
    return { views: filtered, rules: data.rules, ventasPorMes: [...m.entries()].sort().map(([mes, valor]) => ({ mes, valor })) };
  }, [data, filtered]);
}

function useInvalidating<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }) });
}

export const useSaveCustomer = () => useInvalidating(({ form, isNew }: { form: CustomerForm; isNew: boolean }) => svc.saveFromForm(form, isNew));
export const useSaveRules = () => useInvalidating((r: SegmentationRules) => svc.saveRules(r));
export const useResetData = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await svc.resetData();
      await Promise.all([container.trainings.reset(), container.licenses.reset(), container.consultations.reset()]);
    },
    onSuccess: () => qc.invalidateQueries(),
  });
};
