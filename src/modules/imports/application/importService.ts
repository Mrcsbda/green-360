import type { Customer, Sale } from '@/modules/customers/domain/customer';
import type { CustomerRepository, SaleRepository } from '@/modules/customers/domain/repositories';
import { analyze, type ImportAnalysis, type ImportTarget, type Mapping } from '../domain/importDomain';
import type { ExportColumn, ExportFormat, FileGateway, ParsedFile, PickedFile, SpreadsheetCodec } from '../domain/ports';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/[\s\-.]+/g, '_');

export interface CommitResult { insertados: number; actualizados: number; omitidos: number }

export function createImportService(deps: { customers: CustomerRepository; sales: SaleRepository; files: FileGateway; codec: SpreadsheetCodec }) {
  return {
    pick: (): Promise<PickedFile | null> => deps.files.pick(),
    parse: (f: PickedFile, sheet?: string): ParsedFile => deps.codec.parse(f.data, f.name, sheet),

    async analyze(target: ImportTarget, parsed: ParsedFile, mapping: Mapping) {
      const customers = await deps.customers.list();
      if (target === 'customers') {
        return analyze(target, parsed.rows, mapping, { ids: new Set(customers.map((c) => c.id)), empresas: new Map(customers.map((c) => [norm(c.empresa), c.id])) });
      }
      const sales = await deps.sales.list();
      return analyze(target, parsed.rows, mapping, { ids: new Set(sales.map((s) => s.id)), customerIds: new Set(customers.map((c) => c.id)) });
    },

    /** Incorpora los registros válidos. Los duplicados contra datos existentes se actualizan o se omiten según elija el usuario. */
    async commit(a: ImportAnalysis<Customer | Sale>, actualizarExistentes: boolean): Promise<CommitResult> {
      const toWrite = a.validos.filter((v) => actualizarExistentes || !v.existente);
      const res: CommitResult = {
        insertados: toWrite.filter((v) => !v.existente).length,
        actualizados: toWrite.filter((v) => v.existente).length,
        omitidos: a.validos.length - toWrite.length + a.duplicados.filter((d) => d.tipo === 'archivo').length,
      };
      if (a.target === 'customers') {
        const current = new Map((await deps.customers.list()).map((c) => [c.id, c]));
        await deps.customers.saveMany(toWrite.map(({ record }) => {
          const c = record as Customer;
          const prev = current.get(c.id);
          return prev ? { ...prev, ...c } : c;
        }));
      } else {
        await deps.sales.saveMany(toWrite.map((v) => v.record as Sale));
      }
      return res;
    },

    async exportRows<T>(baseName: string, rows: T[], columns: ExportColumn<T>[], format: ExportFormat) {
      const bytes = deps.codec.build(rows, columns, format, baseName);
      const stamp = new Date().toISOString().slice(0, 10);
      await deps.files.save(`${baseName}_${stamp}.${format}`, bytes, deps.codec.mime[format]);
    },
  };
}
export type ImportService = ReturnType<typeof createImportService>;
