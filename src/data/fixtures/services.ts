// Registros iniciales de Servicios y operaciones (editables desde la app).
import type { Consultation } from '@/modules/services/consultations/domain/consultation';
import type { License } from '@/modules/services/licenses/domain/license';
import type { Training } from '@/modules/services/training/domain/training';

const RESP = ['Ana Ruiz', 'Juan Ríos', 'Marta Gil', 'Pedro Vélez'];
const cli = (n: number) => `Cliente de prueba ${String(n).padStart(3, '0')}`;

export const trainingsFixture: Training[] = [
  ['Uso de la plataforma documental', '2026-11-03', '09:00', 7, 'virtual', 'realizada'],
  ['Políticas de respaldo y restauración', '2026-11-12', '14:00', 15, 'presencial', 'realizada'],
  ['Digitalización: buenas prácticas', '2026-11-19', '10:00', 23, 'virtual', 'cancelada'],
  ['Continuidad de negocio: simulacro', '2026-11-25', '08:30', 41, 'presencial', 'programada'],
  ['Consulta de archivo histórico', '2026-11-27', '15:00', 58, 'virtual', 'programada'],
  ['Onboarding de nuevos usuarios', '2026-12-02', '09:30', 77, 'virtual', 'programada'],
  ['Gestión de licencias', '2026-12-09', '11:00', 96, 'presencial', 'programada'],
  ['Recuperación ante desastres', '2026-12-15', '14:30', 110, 'virtual', 'programada'],
].map(([nombre, fecha, hora, c, modalidad, estado], i) => ({
  id: `CAP-${String(i + 1).padStart(3, '0')}`, nombre: nombre as string, fecha: fecha as string, hora: hora as string,
  responsable: RESP[i % RESP.length], cliente: cli(c as number), modalidad: modalidad as Training['modalidad'],
  estado: estado as Training['estado'], observaciones: '',
}));

export const licensesFixture: License[] = [
  ['Suite de gestión documental', 'Proveedor A', 'Suscripción anual', 7, '2025-12-01', '2026-11-30', 50],
  ['Respaldo en la nube', 'Proveedor B', 'Por equipo', 15, '2025-12-10', '2026-12-10', 25],
  ['Respaldo en la nube', 'Proveedor B', 'Por equipo', 23, '2025-10-15', '2026-10-15', 12],
  ['Consulta de archivo', 'Proveedor C', 'Por usuario', 41, '2026-01-20', '2027-01-20', 80],
  ['Almacenamiento seguro', 'Proveedor D', 'Suscripción mensual', 58, '2026-10-25', '2026-11-25', 10],
  ['Suite de gestión documental', 'Proveedor A', 'Suscripción anual', 77, '2026-03-01', '2027-03-01', 120],
  ['Digitalización', 'Proveedor E', 'Perpetua', 96, '2024-06-01', '2034-06-01', 5],
  ['Almacenamiento seguro', 'Proveedor D', 'Suscripción anual', 110, '2025-11-01', '2026-11-01', 30],
  ['Consulta de archivo', 'Proveedor C', 'Por usuario', 3, '2026-02-14', '2026-12-14', 15],
  ['Respaldo en la nube', 'Proveedor B', 'Por equipo', 64, '2026-06-01', '2027-06-01', 40],
].map(([producto, proveedor, tipo, c, activacion, vencimiento, usuarios], i) => ({
  id: `LIC-${String(i + 1).padStart(4, '0')}`, producto: producto as string, proveedor: proveedor as string, tipo: tipo as License['tipo'],
  cliente: cli(c as number), activacion: activacion as string, vencimiento: vencimiento as string, usuariosAutorizados: usuarios as number,
  observaciones: '',
}));

const TIPOS = ['Consulta documental', 'Recuperación de respaldo', 'Auditoría', 'Reporte', 'Soporte'] as const;
const CATS = ['Backup y continuidad', 'Gestión documental', 'Digitalización', 'Soporte operativo'] as const;
const ESTADOS = ['abierta', 'en_proceso', 'cerrada'] as const;
const BASES = ['BD_Contratos', 'BD_Facturacion', 'BD_Respaldo_Diario', 'BD_Archivo_Historico', 'BD_RRHH_Docs'];

export const consultationsFixture: Consultation[] = Array.from({ length: 24 }, (_, i) => ({
  id: `REG-${String(i + 1).padStart(4, '0')}`,
  cliente: cli(((i * 7) % 120) + 1),
  baseDatos: BASES[i % BASES.length],
  tipo: TIPOS[i % TIPOS.length],
  categoria: CATS[(i * 3) % CATS.length],
  fecha: `2026-${String(8 + Math.floor(i / 8)).padStart(2, '0')}-${String(((i * 3) % 27) + 1).padStart(2, '0')}`,
  responsable: RESP[i % RESP.length],
  estado: ESTADOS[i % 3],
  observaciones: i % 4 === 0 ? 'Requiere validación del cliente' : '',
}));
