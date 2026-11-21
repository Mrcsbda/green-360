import type { Sale } from './customer';

export type TrmSeries = [fecha: string, copPorUsd: number][];

/** Valor en COP de una venta: cantidad × precio, con la TRM de la fecha de la venta si es USD (o la última anterior). */
export function makeSaleValuer(series: TrmSeries) {
  const s = [...series].sort((a, b) => a[0].localeCompare(b[0]));
  const trmAt = (fecha: string) => {
    let lo = 0, hi = s.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (s[mid][0] <= fecha) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return s[ans]?.[1] ?? NaN;
  };
  return (sale: Sale) => sale.cantidad * sale.precioUnitario * (sale.moneda === 'USD' ? trmAt(sale.fecha) : 1);
}
