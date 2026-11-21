import { z } from 'zod';

export const TRAINING_STATES = ['programada', 'realizada', 'cancelada'] as const;
export const MODALITIES = ['virtual', 'presencial'] as const;

export const trainingSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().trim().min(3, 'Nombre obligatorio (mín. 3 caracteres)').max(120),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha aaaa-mm-dd'),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora HH:MM (24 h)'),
  responsable: z.string().trim().min(2, 'Responsable obligatorio'),
  cliente: z.string().trim().min(2, 'Cliente obligatorio'),
  modalidad: z.enum(MODALITIES),
  estado: z.enum(TRAINING_STATES),
  observaciones: z.string().max(500),
});
export type Training = z.infer<typeof trainingSchema>;
