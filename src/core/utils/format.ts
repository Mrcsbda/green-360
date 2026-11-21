const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

export const formatCOP = (n: number) => cop.format(n);
/** COP compacto para KPIs y ejes: $5.647 M, $12,3 mil M */
export function formatCOPShort(n: number) {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${num.format(n / 1e9)} mil M`;
  if (a >= 1e6) return `$${num.format(n / 1e6)} M`;
  if (a >= 1e3) return `$${num.format(n / 1e3)} k`;
  return `$${num.format(n)}`;
}
export const formatNumber = (n: number) => num.format(n);
export const formatPct = (x: number, digits = 1) => `${(x * 100).toFixed(digits).replace('.', ',')} %`;
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** yyyy-mm → «ene 25» */
export const formatMonth = (ym: string) => `${MES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
/** yyyy-mm-dd → dd/mm/aaaa */
export const formatDate = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
