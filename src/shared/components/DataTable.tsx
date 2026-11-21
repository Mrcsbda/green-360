import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { colors } from '@/core/theme/tokens';
import { cn, EmptyState } from './ui';

export interface Column<T> {
  key: string;
  header: string;
  width: number;
  render: (row: T) => ReactNode;
  /** Valor para ordenar. Si falta, la columna no es ordenable. */
  sortValue?: (row: T) => string | number | null;
  align?: 'left' | 'right';
}

/** Tabla con orden por columna, paginación y scroll horizontal (usable en móvil). */
export function DataTable<T>({ rows, columns, rowKey, onRowPress, pageSize = 10, emptyTitle = 'Sin registros', emptyDescription, initialSort }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowPress?: (r: T) => void; pageSize?: number;
  emptyTitle?: string; emptyDescription?: string; initialSort?: { key: string; dir: 'asc' | 'desc' };
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!sort || !col?.sortValue) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = col.sortValue!(a), y = col.sortValue!(b);
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (x < y ? -1 : 1) * dir;
    });
  }, [rows, columns, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const p = Math.min(page, pages - 1);
  const visible = sorted.slice(p * pageSize, p * pageSize + pageSize);
  const toggle = (key: string) => {
    setPage(0);
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View className="flex-row border-b border-gray-200 bg-gray-50" accessibilityRole="header">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const Arrow = sort?.dir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <Pressable key={c.key} disabled={!c.sortValue} onPress={() => toggle(c.key)} style={{ width: c.width }}
                  accessibilityRole={c.sortValue ? 'button' : undefined}
                  accessibilityLabel={c.sortValue ? `Ordenar por ${c.header}` : c.header}
                  className={cn('px-3 py-2.5 flex-row items-center gap-1', c.align === 'right' && 'justify-end')}>
                  <Text className="text-xs font-semibold text-gray-600 uppercase" numberOfLines={1}>{c.header}</Text>
                  {active ? <Arrow size={12} color={colors.text} /> : null}
                </Pressable>
              );
            })}
          </View>
          {visible.map((r) => (
            <Pressable key={rowKey(r)} disabled={!onRowPress} onPress={() => onRowPress?.(r)}
              accessibilityRole={onRowPress ? 'button' : undefined}
              className="flex-row border-b border-gray-100 hover:bg-gray-50">
              {columns.map((c) => (
                <View key={c.key} style={{ width: c.width }} className={cn('px-3 py-2.5 justify-center', c.align === 'right' && 'items-end')}>
                  {(() => { const v = c.render(r); return typeof v === 'string' || typeof v === 'number' ? <Text className="text-sm text-gray-800" numberOfLines={2}>{v}</Text> : v; })()}
                </View>
              ))}
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View className="flex-row items-center justify-between pt-3">
        <Text className="text-xs text-gray-500">{sorted.length} registros · página {p + 1} de {pages}</Text>
        <View className="flex-row gap-1">
          <Pressable accessibilityRole="button" accessibilityLabel="Página anterior" disabled={p === 0} onPress={() => setPage(p - 1)} className={cn('p-1.5 rounded-md border border-gray-300', p === 0 && 'opacity-40')}>
            <ChevronLeft size={16} color={colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Página siguiente" disabled={p >= pages - 1} onPress={() => setPage(p + 1)} className={cn('p-1.5 rounded-md border border-gray-300', p >= pages - 1 && 'opacity-40')}>
            <ChevronRight size={16} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
