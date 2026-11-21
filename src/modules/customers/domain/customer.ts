import { z } from 'zod';
import { isValidIsoDate } from '@/core/utils/dates';

export const SEGMENTS = ['frecuente', 'frio', 'sin_segmentar'] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_META: Record<Segment, { label: string; descripcion: string }> = {
  frecuente: { label: 'Frecuente', descripcion: 'Compras recurrentes o actividad comercial sostenida' },
  frio: { label: 'Frío', descripcion: 'Sin compras recientes o con señales de inactividad' },
  sin_segmentar: { label: 'Sin segmentar', descripcion: 'Recién ingresado o sin datos suficientes' },
};

export const CHANNELS = ['Correo', 'Llamada', 'WhatsApp', 'Visita'] as const;
export type Channel = (typeof CHANNELS)[number];

export interface Customer {
  id: string;
  empresa: string;
  ciudad: string;
  sector: string;
  contacto: string;
  email: string;
  telefono: string;
  canal: string;
  fechaAlta?: string;
}

export interface Sale {
  id: string;
  fecha: string;
  customerId: string;
  producto: string;
  cantidad: number;
  moneda: 'COP' | 'USD';
  precioUnitario: number;
  estado: 'Confirmada' | 'Anulada';
}

const isoDate = z.string().refine(isValidIsoDate, 'Fecha inválida (usa aaaa-mm-dd)');

/** Esquema del formulario de cliente (crear / editar). */
export const customerFormSchema = z.object({
  id: z.string().trim().min(1, 'El identificador es obligatorio').max(30),
  empresa: z.string().trim().min(2, 'El nombre de la empresa es obligatorio').max(120),
  ciudad: z.string().trim().min(2, 'La ciudad es obligatoria').max(60),
  sector: z.string().trim().min(2, 'El sector es obligatorio').max(60),
  contacto: z.string().trim().max(120),
  email: z.union([z.literal(''), z.string().trim().email('Correo inválido')]),
  telefono: z.union([z.literal(''), z.string().trim().regex(/^[+\d\s()-]{7,20}$/, 'Teléfono inválido')]),
  canal: z.enum(CHANNELS, { message: 'Elige un canal' }),
  fechaAlta: z.union([z.literal(''), isoDate]).optional(),
});
export type CustomerForm = z.infer<typeof customerFormSchema>;

export const saleSchema = z.object({
  id: z.string().trim().min(1, 'Identificador de venta obligatorio'),
  fecha: isoDate,
  customerId: z.string().trim().min(1, 'Cliente obligatorio'),
  producto: z.string().trim().min(1, 'Producto obligatorio'),
  cantidad: z.number({ message: 'Cantidad debe ser numérica' }).positive('Cantidad debe ser mayor que 0'),
  moneda: z.enum(['COP', 'USD'], { message: 'Moneda debe ser COP o USD' }),
  precioUnitario: z.number({ message: 'Precio debe ser numérico' }).positive('Precio debe ser mayor que 0'),
  estado: z.enum(['Confirmada', 'Anulada'], { message: 'Estado debe ser Confirmada o Anulada' }),
});
