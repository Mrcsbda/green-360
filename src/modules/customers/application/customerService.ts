import type { Customer, CustomerForm, Sale } from '../domain/customer';
import { makeSaleValuer } from '../domain/money';
import type { CustomerRepository, SaleRepository, SettingsRepository, TrmRepository } from '../domain/repositories';
import { buildCustomerViews, type CustomerView, type SegmentationRules } from '../domain/segmentation';

export interface CustomerDataset {
  views: CustomerView[];
  rules: SegmentationRules;
  sales: Sale[];
  valueCOP: (s: Sale) => number;
}

/** Casos de uso de Clientes 360°. No conoce la UI ni el tipo de almacenamiento. */
export function createCustomerService(deps: { customers: CustomerRepository; sales: SaleRepository; trm: TrmRepository; settings: SettingsRepository }) {
  return {
    async dataset(): Promise<CustomerDataset> {
      const [customers, sales, trm, rules] = await Promise.all([deps.customers.list(), deps.sales.list(), deps.trm.series(), deps.settings.getRules()]);
      const valueCOP = makeSaleValuer(trm);
      return { views: buildCustomerViews(customers, sales, rules, valueCOP), rules, sales, valueCOP };
    },
    async saveFromForm(form: CustomerForm, isNew: boolean): Promise<Customer> {
      const existing = await deps.customers.get(form.id);
      if (isNew && existing) throw new Error(`Ya existe un cliente con el identificador ${form.id}`);
      const c: Customer = { ...(existing ?? {}), ...form, fechaAlta: form.fechaAlta || undefined };
      return deps.customers.save(c);
    },
    getRules: () => deps.settings.getRules(),
    saveRules: (r: SegmentationRules) => deps.settings.saveRules(r),
    async resetData() {
      await Promise.all([deps.customers.reset(), deps.sales.reset(), deps.settings.reset()]);
    },
  };
}
export type CustomerService = ReturnType<typeof createCustomerService>;
