import { describe, expect, it } from 'vitest';
import { rulesInsightsService as insights } from '@/modules/ai-insights/infrastructure/rulesInsightsService';
import { loginSchema } from '@/modules/auth/domain/auth';
import { localAuthService } from '@/modules/auth/infrastructure/localAuthService';
import { customerFormSchema } from '@/modules/customers/domain/customer';
import { DEFAULT_RULES } from '@/modules/customers/domain/segmentation';
import { licenseSchema, licenseStatus } from '@/modules/services/licenses/domain/license';
import { filterConsultations, EMPTY_CONSULTATION_FILTERS } from '@/modules/services/consultations/domain/consultation';
import { consultationsFixture } from '@/data/fixtures/services';
import { views } from './helpers';

describe('autenticación local', () => {
  it('valida campos obligatorios', () => {
    expect(loginSchema.safeParse({ username: '', password: '' }).success).toBe(false);
  });
  it('acepta operativo1/root123 y rechaza credenciales incorrectas', async () => {
    await expect(localAuthService.login('operativo1', 'root123')).resolves.toMatchObject({ user: { username: 'operativo1' } });
    await expect(localAuthService.login('operativo1', 'mala')).rejects.toThrow('Usuario o contraseña incorrectos');
  });
});

describe('formulario de cliente', () => {
  const ok = { id: 'C1', empresa: 'Acme', ciudad: 'Cali', sector: 'Industria', contacto: '', email: '', telefono: '', canal: 'Correo', fechaAlta: '' };
  it('acepta un registro válido', () => expect(customerFormSchema.safeParse(ok).success).toBe(true));
  it('rechaza correo, teléfono, canal y fecha inválidos', () => {
    for (const bad of [{ email: 'x' }, { telefono: 'abc' }, { canal: 'Fax' }, { fechaAlta: '2026-02-30' }]) {
      expect(customerFormSchema.safeParse({ ...ok, ...bad }).success).toBe(false);
    }
  });
});

describe('licencias', () => {
  it('estado de vigencia por días al vencimiento', () => {
    expect(licenseStatus({ vencimiento: '2026-11-20' }, '2026-11-21').estado).toBe('vencida');
    expect(licenseStatus({ vencimiento: '2026-12-10' }, '2026-11-21').estado).toBe('por_vencer');
    expect(licenseStatus({ vencimiento: '2027-06-01' }, '2026-11-21').estado).toBe('vigente');
  });
  it('el vencimiento debe ser posterior a la activación', () => {
    const r = licenseSchema.safeParse({ id: 'L', producto: 'P1', proveedor: 'PV', tipo: 'Perpetua', cliente: 'Cli', activacion: '2026-05-01', vencimiento: '2026-01-01', usuariosAutorizados: 1, observaciones: '' });
    expect(r.success).toBe(false);
  });
});

describe('bases de consulta', () => {
  it('filtros combinables', () => {
    const r = filterConsultations(consultationsFixture, { ...EMPTY_CONSULTATION_FILTERS, estado: 'abierta', tipo: 'Consulta documental' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((c) => c.estado === 'abierta' && c.tipo === 'Consulta documental')).toBe(true);
  });
});

describe('asistente IA por reglas', () => {
  const ctx = { views: views(), rules: DEFAULT_RULES, ventasPorMes: [] };
  it('responde con reglas y deja claro que no es probabilidad estadística', async () => {
    const a = await insights.ask('¿Qué clientes tienen mayor probabilidad de realizar una nueva compra?', ctx);
    expect(a.tipo).toBe('regla');
    expect(a.texto).toMatch(/no una probabilidad estadística/);
    expect(a.items.length).toBeGreaterThan(0);
  });
  it('dice que no tiene datos en vez de inventar', async () => {
    expect((await insights.ask('¿Cuál es el clima mañana?', ctx)).datosSuficientes).toBe(false);
    expect((await insights.ask('¿Qué segmentos concentran el mayor valor comercial?', { ...ctx, views: ctx.views.slice(0, 2) })).datosSuficientes).toBe(false);
  });
  it('cada recomendación trae objetivo, motivo, evidencia, prioridad y acción', async () => {
    for (const r of await insights.recommendations(ctx)) {
      expect(r.objetivo && r.motivo && r.accion && r.prioridad).toBeTruthy();
      expect(r.evidencia.length).toBeGreaterThan(0);
    }
  });
});
