import { describe, expect, it } from 'vitest';
import { kpis } from '@/modules/analytics/domain/analytics';
import { applyFilters, EMPTY_FILTERS } from '@/modules/customers/domain/filters';
import { classify, computeMetrics, DEFAULT_RULES } from '@/modules/customers/domain/segmentation';
import type { Customer } from '@/modules/customers/domain/customer';
import { fixtureCustomers, fixtureSales, valueCOP, views } from './helpers';

const blank: Customer = { id: 'X1', empresa: 'Empresa X', ciudad: 'Cali', sector: 'Servicios', contacto: '', email: '', telefono: '', canal: 'Correo' };

describe('valor en COP', () => {
  it('convierte USD con la TRM de la fecha y cuadra con la referencia del reto', () => {
    const total = fixtureSales().filter((s) => s.estado === 'Confirmada').reduce((a, s) => a + valueCOP(s), 0);
    expect(total).toBeCloseTo(5_647_449_456.36, 0);
  });
});

describe('segmentación por reglas', () => {
  const v = views();
  it('41 clientes fríos: más de 90 días sin comprar (referencia del reto)', () => {
    expect(v.filter((x) => x.segment === 'frio').length).toBe(41);
  });
  it('solo existen los segmentos frecuente, frío y sin segmentar', () => {
    expect(new Set(v.map((x) => x.segment))).toEqual(new Set(['frecuente', 'frio', 'sin_segmentar']));
  });
  it('cada cliente tiene un único segmento con motivo y evidencia', () => {
    for (const x of v) {
      expect(x.segmento.motivo.length).toBeGreaterThan(0);
      expect(x.segmento.evidencia.length).toBe(4);
    }
    const k = kpis(v, DEFAULT_RULES);
    expect(k.frecuentes + k.frios + k.sinSegmentar).toBe(120);
  });
  it('frecuente = ≥10 compras en 12 meses y compra reciente', () => {
    for (const x of v.filter((y) => y.segment === 'frecuente')) {
      expect(x.compras12m).toBeGreaterThanOrEqual(10);
      expect(x.diasSinCompra!).toBeLessThanOrEqual(90);
    }
  });
  it('sin compras → sin segmentar por datos insuficientes', () => {
    const m = computeMetrics(blank, [], DEFAULT_RULES, valueCOP);
    expect(classify(m, DEFAULT_RULES)).toMatchObject({ segment: 'sin_segmentar' });
  });
  it('las reglas son configurables', () => {
    const strict = views(fixtureCustomers(), { ...DEFAULT_RULES, frioDiasSinCompra: 30 });
    expect(strict.filter((x) => x.segment === 'frio').length).toBeGreaterThan(v.filter((x) => x.segment === 'frio').length);
  });
  it('los filtros se combinan (AND entre grupos)', () => {
    const f = applyFilters(v, { ...EMPTY_FILTERS, ciudades: ['Cali'], canales: ['Correo'], segments: ['frio'] });
    expect(f.every((x) => x.ciudad === 'Cali' && x.canal === 'Correo' && x.segment === 'frio')).toBe(true);
    expect(applyFilters(v, { ...EMPTY_FILTERS, q: 'prueba 041' }).map((x) => x.id)).toEqual(['CLI041']);
  });
});
