import { z } from 'zod';
import { daysBetween } from '@/core/utils/dates';

export const LICENSE_TYPES = ['Suscripción anual', 'Suscripción mensual', 'Perpetua', 'Por usuario', 'Por equipo'] as const;

export const licenseSchema = z.object({
  id: z.string().trim().min(1, 'Identificador obligatorio'),
  producto: z.string().trim().min(2, 'Producto obligatorio'),
  proveedor: z.string().trim().min(2, 'Proveedor obligatorio'),
  tipo: z.enum(LICENSE_TYPES),
  cliente: z.string().trim().min(2, 'Cliente obligatorio'),
  activacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha aaaa-mm-dd'),
  vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha aaaa-mm-dd'),
  usuariosAutorizados: z.number().int().positive('Debe ser mayor que 0'),
  observaciones: z.string().max(500),
}).refine((l) => l.vencimiento > l.activacion, { message: 'El vencimiento debe ser posterior a la activación', path: ['vencimiento'] });
export type License = z.infer<typeof licenseSchema>;

export type LicenseStatus = 'vigente' | 'por_vencer' | 'vencida';
export const POR_VENCER_DIAS = 30;

export function licenseStatus(l: Pick<License, 'vencimiento'>, hoy: string): { estado: LicenseStatus; dias: number } {
  const dias = daysBetween(hoy, l.vencimiento);
  return { estado: dias < 0 ? 'vencida' : dias <= POR_VENCER_DIAS ? 'por_vencer' : 'vigente', dias };
}
