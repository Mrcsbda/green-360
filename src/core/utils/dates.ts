export const DAY_MS = 86_400_000;
/** Todas las fechas de negocio son yyyy-mm-dd (sin hora) y se comparan en UTC. */
export const toTime = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
export const daysBetween = (fromIso: string, toIso: string) => Math.round((toTime(toIso) - toTime(fromIso)) / DAY_MS);
export const addDays = (iso: string, n: number) => new Date(toTime(iso) + n * DAY_MS).toISOString().slice(0, 10);
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const monthKey = (iso: string) => iso.slice(0, 7);
export const isValidIsoDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
