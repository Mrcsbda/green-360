import { Text } from 'react-native';
import { formatCOP, formatDate } from '@/core/utils/format';
import type { Column } from '@/shared/components/DataTable';
import { Badge } from '@/shared/components/ui';
import type { CustomerView } from '../domain/segmentation';
import { SegmentBadge } from './SegmentBadge';

const statusTone = { Activo: 'green', Inactivo: 'gray', 'Sin compras': 'amber' } as const;

export const directoryColumns: Column<CustomerView>[] = [
  { key: 'id', header: 'ID', width: 90, render: (r) => r.id, sortValue: (r) => r.id },
  { key: 'empresa', header: 'Empresa', width: 190, render: (r) => <Text className="text-sm font-medium text-accent" numberOfLines={1}>{r.empresa}</Text>, sortValue: (r) => r.empresa },
  { key: 'ciudad', header: 'Ciudad', width: 120, render: (r) => r.ciudad, sortValue: (r) => r.ciudad },
  { key: 'sector', header: 'Sector', width: 110, render: (r) => r.sector, sortValue: (r) => r.sector },
  { key: 'contacto', header: 'Contacto principal', width: 160, render: (r) => r.contacto || '—', sortValue: (r) => r.contacto },
  { key: 'email', header: 'Correo', width: 230, render: (r) => r.email || '—', sortValue: (r) => r.email },
  { key: 'telefono', header: 'Teléfono', width: 140, render: (r) => r.telefono || '—' },
  { key: 'canal', header: 'Canal', width: 100, render: (r) => r.canal, sortValue: (r) => r.canal },
  { key: 'ultima', header: 'Última compra', width: 120, render: (r) => formatDate(r.ultimaCompra), sortValue: (r) => r.ultimaCompra },
  { key: 'num', header: 'N.º compras', width: 100, align: 'right', render: (r) => String(r.numCompras), sortValue: (r) => r.numCompras },
  { key: 'valor', header: 'Valor acumulado', width: 150, align: 'right', render: (r) => formatCOP(r.valorAcumulado), sortValue: (r) => r.valorAcumulado },
  { key: 'estado', header: 'Estado comercial', width: 130, render: (r) => <Badge label={r.estadoComercial} tone={statusTone[r.estadoComercial]} />, sortValue: (r) => r.estadoComercial },
];

export const segmentationColumns: Column<CustomerView>[] = [
  directoryColumns[1],
  { key: 'segmento', header: 'Segmento', width: 150, render: (r) => <SegmentBadge segment={r.segment} />, sortValue: (r) => r.segment },
  { key: 'motivo', header: 'Motivo de la clasificación', width: 330, render: (r) => <Text className="text-xs text-gray-700" numberOfLines={2}>{r.segmento.motivo}</Text> },
  directoryColumns[2],
  directoryColumns[7],
  { key: 'dias', header: 'Días sin compra', width: 120, align: 'right', render: (r) => (r.diasSinCompra === null ? '—' : String(r.diasSinCompra)), sortValue: (r) => r.diasSinCompra },
  { key: 'c12', header: 'Compras 12 m', width: 110, align: 'right', render: (r) => String(r.compras12m), sortValue: (r) => r.compras12m },
  directoryColumns[10],
];

/** Columnas de exportación: mismos campos que el directorio + segmento y motivo. */
export const exportColumns = [
  { header: 'Identificador', value: (r: CustomerView) => r.id },
  { header: 'Empresa', value: (r: CustomerView) => r.empresa },
  { header: 'Ciudad', value: (r: CustomerView) => r.ciudad },
  { header: 'Sector', value: (r: CustomerView) => r.sector },
  { header: 'Contacto principal', value: (r: CustomerView) => r.contacto },
  { header: 'Correo', value: (r: CustomerView) => r.email },
  { header: 'Teléfono', value: (r: CustomerView) => r.telefono },
  { header: 'Canal preferido', value: (r: CustomerView) => r.canal },
  { header: 'Fecha de alta', value: (r: CustomerView) => r.fechaAlta ?? null },
  { header: 'Última compra', value: (r: CustomerView) => r.ultimaCompra },
  { header: 'Número de compras', value: (r: CustomerView) => r.numCompras },
  { header: 'Valor acumulado (COP)', value: (r: CustomerView) => Math.round(r.valorAcumulado) },
  { header: 'Estado comercial', value: (r: CustomerView) => r.estadoComercial },
  { header: 'Segmento', value: (r: CustomerView) => r.segment },
  { header: 'Motivo', value: (r: CustomerView) => r.segmento.motivo },
];
