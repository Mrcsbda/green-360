import { createCollection, createDocStore } from '@/core/storage/collection';
import customersFixture from '@/data/fixtures/customers.json';
import salesFixture from '@/data/fixtures/sales.json';
import trmFixture from '@/data/fixtures/trm.json';
import type { Customer, Sale } from '../domain/customer';
import type { TrmSeries } from '../domain/money';
import type { CustomerRepository, SaleRepository, SettingsRepository, TrmRepository } from '../domain/repositories';
import { DEFAULT_RULES, segmentationRulesSchema, type SegmentationRules } from '../domain/segmentation';

// Almacenamiento local del dispositivo. Ver core/storage/collection.ts
export function customerRepository(): CustomerRepository {
  const col = createCollection<Customer>('customers', () => customersFixture as Customer[]);
  return { list: () => col.all(), get: (id) => col.get(id), save: (c) => col.save(c), saveMany: (cs) => col.saveMany(cs), reset: () => col.reset() };
}

export function saleRepository(): SaleRepository {
  const col = createCollection<Sale>('sales', () => salesFixture as Sale[]);
  return { list: () => col.all(), saveMany: (s) => col.saveMany(s), reset: () => col.reset() };
}

/** Serie TRM incluida en la app (cop_por_usd diaria). */
export const trmRepository: TrmRepository = { series: async () => trmFixture as TrmSeries };

export function settingsRepository(): SettingsRepository {
  const store = createDocStore<SegmentationRules>('rules');
  return {
    // safeParse descarta campos de versiones anteriores y vuelve a los valores por defecto si algo no es válido
    getRules: async () => {
      const r = segmentationRulesSchema.safeParse({ ...DEFAULT_RULES, ...((await store.get()) ?? {}) });
      return r.success ? r.data : DEFAULT_RULES;
    },
    saveRules: (r) => store.set(r),
    reset: () => store.remove(),
  };
}
