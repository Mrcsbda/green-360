/// <reference types="node" />
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze, autoMap, toIsoDate, toNumber } from '@/modules/imports/domain/importDomain';
import { buildExport, parseSpreadsheet } from '@/modules/imports/infrastructure/spreadsheet';
import { DATA_DIR, fixtureCustomers } from './helpers';

const readFile = (name: string) => {
  const b = fs.readFileSync(`${DATA_DIR}/${name}`);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe('transformaciones', () => {
  it('fechas ISO, dd/mm/aaaa y seriales de Excel', () => {
    expect(toIsoDate('2026-01-05')).toBe('2026-01-05');
    expect(toIsoDate('5/1/2026')).toBe('2026-01-05');
    expect(toIsoDate(46027)).toBe('2026-01-05');
  });
  it('números en formato colombiano y con punto decimal', () => {
    expect(toNumber('1.234.567,89')).toBeCloseTo(1234567.89);
    expect(toNumber('1234567.89')).toBeCloseTo(1234567.89);
    expect(toNumber('$ 350.000')).toBe(350000);
  });
});

describe('importación de clientes', () => {
  it('lee el CSV del reto y mapea sus columnas automáticamente', () => {
    const p = parseSpreadsheet(readFile('clientes.csv'), 'clientes.csv');
    const m = autoMap('customers', p.headers);
    expect(m).toMatchObject({ id: 'cliente_id', empresa: 'nombre_prueba', ciudad: 'ciudad_prueba', canal: 'canal_preferido_prueba' });
    const a = analyze('customers', p.rows, m, { ids: new Set() });
    expect(a.validos).toHaveLength(120);
    expect(a.errores).toHaveLength(0);
  });
  it('marca como duplicados existentes los clientes que ya están cargados', () => {
    const p = parseSpreadsheet(readFile('clientes.csv'), 'clientes.csv');
    const ids = new Set(fixtureCustomers().map((c) => c.id));
    const a = analyze('customers', p.rows, autoMap('customers', p.headers), { ids });
    expect(a.duplicados.filter((d) => d.tipo === 'existente')).toHaveLength(120);
  });
  it('valida obligatorios, tipos y duplicados dentro del archivo', () => {
    const csv = 'Empresa,Ciudad,Sector,Correo,Canal\nAcme,Cali,Industria,a@b.co,Correo\n,Cali,Industria,,Correo\nBeta,Cali,Servicios,no-es-correo,Llamada\nacme,Cali,Industria,,Correo\nGamma,Cali,Servicios,,Paloma\n';
    const p = parseSpreadsheet(enc(csv), 'x.csv');
    const a = analyze('customers', p.rows, autoMap('customers', p.headers), { ids: new Set() });
    expect(a.validos.map((v) => v.fila)).toEqual([2]);
    expect(a.errores.map((e) => [e.fila, e.campo])).toEqual([[3, 'empresa'], [4, 'email'], [6, 'canal']]);
    expect(a.duplicados).toMatchObject([{ fila: 5, tipo: 'archivo' }]);
  });
  it('reporta columnas obligatorias sin mapear', () => {
    const p = parseSpreadsheet(enc('Nombre\nAcme\n'), 'x.csv');
    expect(analyze('customers', p.rows, autoMap('customers', p.headers), { ids: new Set() }).columnasFaltantes).toEqual(['Ciudad', 'Sector', 'Canal preferido']);
  });
});

describe('importación de ventas con incidencias del reto', () => {
  it('aísla las filas con error y el duplicado; no inventa valores', () => {
    const p = parseSpreadsheet(readFile('ventas_con_incidencias_OPCIONAL.csv'), 'ventas.csv');
    const customerIds = new Set(fixtureCustomers().map((c) => c.id));
    const a = analyze('sales', p.rows, autoMap('sales', p.headers), { ids: new Set(), customerIds });
    const byField = Object.fromEntries(a.errores.map((e) => [e.campo, e.mensaje]));
    expect(byField).toMatchObject({ customerId: 'Cliente inexistente', cantidad: 'Cantidad debe ser mayor que 0', precioUnitario: 'Campo obligatorio vacío' });
    expect(byField.fecha).toMatch(/Fecha inválida/);
    expect(byField.moneda).toMatch(/COP o USD/);
    expect(a.errores).toHaveLength(5); // PRO99 no se valida: la app no maneja catálogo de productos
    expect(a.duplicados).toMatchObject([{ id: 'VEN01056', tipo: 'archivo' }]);
    expect(a.validos).toHaveLength(81 - 5 - 1);
  });
});

describe('exportación', () => {
  it('XLSX de ida y vuelta conserva encabezados y valores', () => {
    const rows = [{ id: 'C1', empresa: 'Acme', valor: 1500 }];
    const bytes = buildExport(rows, [{ header: 'Id', value: (r) => r.id }, { header: 'Empresa', value: (r) => r.empresa }, { header: 'Valor', value: (r) => r.valor }], 'xlsx');
    const p = parseSpreadsheet(bytes.buffer as ArrayBuffer, 'x.xlsx');
    expect(p.headers).toEqual(['Id', 'Empresa', 'Valor']);
    expect(p.rows[0]).toEqual({ Id: 'C1', Empresa: 'Acme', Valor: 1500 });
  });
});
