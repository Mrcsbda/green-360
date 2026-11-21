import * as XLSX from 'xlsx';
import type { Cell, RawRow } from '../domain/importDomain';
import type { ExportColumn, ExportFormat, ParsedFile, SpreadsheetCodec } from '../domain/ports';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 20_000;


/** Lee XLSX o CSV a registros estructurados (sin iframes ni visores). */
export function parseSpreadsheet(data: ArrayBuffer, fileName: string, sheetName?: string): ParsedFile {
  if (data.byteLength > MAX_FILE_BYTES) throw new Error('El archivo supera el máximo de 10 MB');
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext !== 'xlsx' && ext !== 'csv') throw new Error('Formato no soportado: usa .xlsx o .csv');
  const wb = ext === 'csv'
    ? XLSX.read(new TextDecoder('utf-8').decode(data).replace(/^﻿/, ''), { type: 'string', raw: true })
    : XLSX.read(data, { type: 'array', cellDates: true });
  const sheet = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
  if (!sheet) throw new Error('El archivo no tiene hojas');
  const ws = wb.Sheets[sheet];
  const matrix = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: null, raw: true, blankrows: false });
  const [head = [], ...body] = matrix;
  const headers = head.map((h, i) => (h === null || String(h).trim() === '' ? `Columna ${i + 1}` : String(h).trim()));
  if (!headers.length) throw new Error('No se encontraron encabezados en la primera fila');
  if (body.length > MAX_ROWS) throw new Error(`El archivo supera el máximo de ${MAX_ROWS} filas`);
  const rows = body
    .filter((r) => r.some((c) => c !== null && String(c).trim() !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])) as RawRow);
  return { sheets: wb.SheetNames, sheet, headers, rows };
}


export function buildExport<T>(rows: T[], columns: ExportColumn<T>[], format: ExportFormat, sheetName = 'Datos'): Uint8Array {
  const aoa = [columns.map((c) => c.header), ...rows.map((r) => columns.map((c) => c.value(r)))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map((c) => ({ wch: Math.max(12, c.header.length + 2) }));
  if (format === 'csv') {
    // BOM para que Excel abra bien las tildes
    return new TextEncoder().encode('﻿' + XLSX.utils.sheet_to_csv(ws));
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

export const MIME: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

export const sheetJsCodec: SpreadsheetCodec = { parse: parseSpreadsheet, build: buildExport, mime: MIME };
