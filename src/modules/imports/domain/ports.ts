import type { RawRow } from './importDomain';

export interface PickedFile { name: string; data: ArrayBuffer }
export interface ParsedFile { sheets: string[]; sheet: string; headers: string[]; rows: RawRow[] }
export type ExportFormat = 'xlsx' | 'csv';
export interface ExportColumn<T> { header: string; value: (row: T) => string | number | null }

/** Puertos de archivos: la app no sabe si corre en web o en el dispositivo. */
export interface FileGateway {
  pick(): Promise<PickedFile | null>;
  save(name: string, bytes: Uint8Array, mime: string): Promise<void>;
}
export interface SpreadsheetCodec {
  parse(data: ArrayBuffer, fileName: string, sheet?: string): ParsedFile;
  build<T>(rows: T[], columns: ExportColumn<T>[], format: ExportFormat, sheetName?: string): Uint8Array;
  mime: Record<ExportFormat, string>;
}
