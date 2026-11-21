// Reglas de importación (puras): mapeo de columnas, transformación, validación y duplicados.
import { CHANNELS, customerFormSchema, saleSchema, type Customer, type Sale } from '@/modules/customers/domain/customer';

export type ImportTarget = 'customers' | 'sales';
export type Cell = string | number | boolean | Date | null;
export type RawRow = Record<string, Cell>;

export interface FieldDef { key: string; label: string; required: boolean; synonyms: string[] }

export const IMPORT_FIELDS: Record<ImportTarget, FieldDef[]> = {
  customers: [
    { key: 'id', label: 'Identificador', required: false, synonyms: ['cliente_id', 'id cliente', 'codigo', 'nit', 'cliente'] },
    { key: 'empresa', label: 'Empresa', required: true, synonyms: ['nombre_prueba', 'nombre', 'razon social', 'nombre empresa', 'compania'] },
    { key: 'ciudad', label: 'Ciudad', required: true, synonyms: ['ciudad_prueba', 'municipio'] },
    { key: 'sector', label: 'Sector', required: true, synonyms: ['sector_prueba', 'industria', 'sector economico'] },
    { key: 'contacto', label: 'Contacto principal', required: false, synonyms: ['contacto principal', 'nombre contacto'] },
    { key: 'email', label: 'Correo', required: false, synonyms: ['correo', 'correo electronico', 'e-mail', 'mail'] },
    { key: 'telefono', label: 'Teléfono', required: false, synonyms: ['telefono', 'celular', 'movil', 'tel'] },
    { key: 'canal', label: 'Canal preferido', required: true, synonyms: ['canal_preferido_prueba', 'canal preferido', 'canal de comunicacion'] },
    { key: 'fechaAlta', label: 'Fecha de alta', required: false, synonyms: ['fecha_alta', 'fecha de alta', 'alta', 'fecha registro'] },
  ],
  sales: [
    { key: 'id', label: 'Id de venta', required: true, synonyms: ['venta_id', 'id venta', 'factura', 'documento'] },
    { key: 'fecha', label: 'Fecha', required: true, synonyms: ['fecha venta', 'fecha compra'] },
    { key: 'customerId', label: 'Id de cliente', required: true, synonyms: ['cliente_id', 'id cliente', 'cliente', 'nit'] },
    { key: 'producto', label: 'Producto', required: true, synonyms: ['producto_id', 'nombre producto', 'sku'] },
    { key: 'cantidad', label: 'Cantidad', required: true, synonyms: ['unidades', 'cant'] },
    { key: 'moneda', label: 'Moneda', required: true, synonyms: ['divisa'] },
    { key: 'precioUnitario', label: 'Precio unitario', required: true, synonyms: ['precio_unitario', 'precio', 'valor unitario'] },
    { key: 'estado', label: 'Estado', required: true, synonyms: ['estatus'] },
  ],
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/[\s\-.]+/g, '_');

export type Mapping = Record<string, string | null>; // campo de la app → encabezado del archivo

/** Mapeo automático: nombre exacto del campo, luego etiqueta y sinónimos. */
export function autoMap(target: ImportTarget, headers: string[]): Mapping {
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  return Object.fromEntries(IMPORT_FIELDS[target].map((f) => {
    const hit = [f.key, f.label, ...f.synonyms].map(norm).find((k) => byNorm.has(k));
    return [f.key, hit ? byNorm.get(hit)! : null];
  }));
}

// ---------- Transformaciones ----------
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
export function toIsoDate(v: Cell): string | null {
  if (v === null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? 'invalid' : new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())).toISOString().slice(0, 10);
  if (typeof v === 'number') return v > 20000 && v < 80000 ? new Date(EXCEL_EPOCH + Math.round(v) * 86_400_000).toISOString().slice(0, 10) : 'invalid';
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return 'invalid'; // la validación de fecha (zod) lo rechaza
}
/** Números con formato colombiano (1.234.567,89) o con punto decimal. */
export function toNumber(v: Cell): number | null {
  if (v === null || v === '') return null;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/[$\s]/g, '');
  if (s === '') return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^-?\d+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,(?=\d{3}(\D|$))/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
const str = (v: Cell) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

export function normalizeChannel(v: string): string {
  const n = norm(v);
  if (['correo', 'email', 'e_mail', 'mail', 'correo_electronico'].includes(n)) return 'Correo';
  if (['llamada', 'telefono', 'llamada_telefonica', 'celular'].includes(n)) return 'Llamada';
  if (['whatsapp', 'wa', 'chat'].includes(n)) return 'WhatsApp';
  if (['visita', 'presencial'].includes(n)) return 'Visita';
  return CHANNELS.find((c) => norm(c) === n) ?? v;
}

export interface RowError { fila: number; campo: string; valor: string; mensaje: string }
export interface Duplicate { fila: number; id: string; tipo: 'archivo' | 'existente'; detalle: string }
export interface ValidRecord<T> { fila: number; record: T; existente: boolean }
export interface ImportAnalysis<T> {
  target: ImportTarget;
  total: number;
  validos: ValidRecord<T>[];
  errores: RowError[];
  duplicados: Duplicate[];
  columnasFaltantes: string[];
}

export interface ExistingIndex { ids: Set<string>; empresas?: Map<string, string>; customerIds?: Set<string> }

/**
 * Valida todas las filas. Reglas:
 * - Fila con error → se reporta y no se importa (no se inventan valores).
 * - Duplicado dentro del archivo → se reporta y se omite.
 * - Duplicado contra datos existentes → se marca `existente`; el usuario decide si actualiza u omite.
 * `fila` es la fila de la hoja (encabezado = 1).
 */
export function analyze(target: ImportTarget, rows: RawRow[], mapping: Mapping, existing: ExistingIndex): ImportAnalysis<Customer | Sale> {
  const fields = IMPORT_FIELDS[target];
  const columnasFaltantes = fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);
  const out: ImportAnalysis<Customer | Sale> = { target, total: rows.length, validos: [], errores: [], duplicados: [], columnasFaltantes };
  if (columnasFaltantes.length) return out;

  const seenIds = new Set<string>();
  const seenEmpresas = new Map<string, number>();
  rows.forEach((row, i) => {
    const fila = i + 2;
    const get = (k: string) => (mapping[k] ? row[mapping[k]!] ?? null : null);

    if (target === 'customers') {
      const empresa = str(get('empresa'));
      const candidate = {
        id: str(get('id')) || `NUEVO-${String(fila).padStart(4, '0')}`,
        empresa,
        ciudad: str(get('ciudad')),
        sector: str(get('sector')),
        contacto: str(get('contacto')),
        email: str(get('email')),
        telefono: str(get('telefono')),
        canal: normalizeChannel(str(get('canal'))),
        fechaAlta: toIsoDate(get('fechaAlta')) ?? '',
      };
      const parsed = customerFormSchema.safeParse(candidate);
      if (!parsed.success) {
        const iss = parsed.error.issues[0];
        const campo = String(iss.path[0] ?? '');
        out.errores.push({ fila, campo, valor: str(get(campo)), mensaje: iss.message });
        return;
      }
      const empKey = norm(empresa);
      if (seenIds.has(candidate.id)) { out.duplicados.push({ fila, id: candidate.id, tipo: 'archivo', detalle: 'Identificador repetido en el archivo' }); return; }
      if (seenEmpresas.has(empKey)) { out.duplicados.push({ fila, id: candidate.id, tipo: 'archivo', detalle: `Empresa repetida (fila ${seenEmpresas.get(empKey)})` }); return; }
      seenIds.add(candidate.id);
      seenEmpresas.set(empKey, fila);
      const byName = existing.empresas?.get(empKey);
      const existente = existing.ids.has(candidate.id) || (!!byName && byName !== candidate.id);
      if (existente) out.duplicados.push({ fila, id: candidate.id, tipo: 'existente', detalle: existing.ids.has(candidate.id) ? 'El identificador ya existe' : `La empresa ya existe como ${byName}` });
      const d = parsed.data;
      out.validos.push({ fila, existente, record: { ...d, id: existing.ids.has(d.id) || !byName ? d.id : byName, fechaAlta: d.fechaAlta || undefined } });
      return;
    }

    const candidate = {
      id: str(get('id')),
      fecha: toIsoDate(get('fecha')) ?? '',
      customerId: str(get('customerId')),
      producto: str(get('producto')),
      cantidad: toNumber(get('cantidad')) ?? undefined,
      moneda: str(get('moneda')).toUpperCase(),
      precioUnitario: toNumber(get('precioUnitario')) ?? undefined,
      estado: (() => { const e = str(get('estado')); return e ? e[0].toUpperCase() + e.slice(1).toLowerCase() : ''; })(),
    };
    const parsed = saleSchema.safeParse(candidate);
    if (!parsed.success) {
      const iss = parsed.error.issues[0];
      const campo = String(iss.path[0] ?? '');
      const raw = get(campo);
      out.errores.push({ fila, campo, valor: str(raw), mensaje: raw === null || raw === '' ? 'Campo obligatorio vacío' : iss.message });
      return;
    }
    if (existing.customerIds && !existing.customerIds.has(parsed.data.customerId)) {
      out.errores.push({ fila, campo: 'customerId', valor: parsed.data.customerId, mensaje: 'Cliente inexistente' });
      return;
    }
    if (seenIds.has(parsed.data.id)) { out.duplicados.push({ fila, id: parsed.data.id, tipo: 'archivo', detalle: 'Id de venta repetido en el archivo' }); return; }
    seenIds.add(parsed.data.id);
    const existente = existing.ids.has(parsed.data.id);
    if (existente) out.duplicados.push({ fila, id: parsed.data.id, tipo: 'existente', detalle: 'La venta ya existe' });
    out.validos.push({ fila, existente, record: parsed.data });
  });
  return out;
}
