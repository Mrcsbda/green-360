import type { Customer, Sale } from './customer';
import type { TrmSeries } from './money';
import type { SegmentationRules } from './segmentation';

// Puertos: la app depende de estas interfaces. Hoy se implementan con almacenamiento local; mañana con una API REST.
export interface CustomerRepository {
  list(): Promise<Customer[]>;
  get(id: string): Promise<Customer | null>;
  save(c: Customer): Promise<Customer>;
  saveMany(cs: Customer[]): Promise<void>;
  reset(): Promise<void>;
}
export interface SaleRepository {
  list(): Promise<Sale[]>;
  saveMany(s: Sale[]): Promise<void>;
  reset(): Promise<void>;
}
export interface TrmRepository {
  series(): Promise<TrmSeries>;
}
export interface SettingsRepository {
  getRules(): Promise<SegmentationRules>;
  saveRules(r: SegmentationRules): Promise<void>;
  reset(): Promise<void>;
}
