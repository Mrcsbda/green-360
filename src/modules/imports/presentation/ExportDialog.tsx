import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { Text } from 'react-native';
import { container } from '@/core/providers/container';
import { Button, ErrorState, Modal, Notice, Select } from '@/shared/components/ui';
import type { ExportColumn, ExportFormat } from '../domain/ports';

/** Exporta los registros completos o solo los filtrados, en XLSX o CSV. */
export function ExportDialog<T>({ visible, onClose, baseName, all, filtered, columns }: {
  visible: boolean; onClose: () => void; baseName: string; all: T[]; filtered: T[]; columns: ExportColumn<T>[];
}) {
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const rows = scope === 'all' ? all : filtered;

  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      await container.importService.exportRows(baseName, rows, columns, format);
      setMsg({ ok: true, text: `Se exportaron ${rows.length} registros en ${format.toUpperCase()}.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo exportar' });
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} onClose={() => { setMsg(null); onClose(); }} title="Exportar archivo">
      <Select label="Registros" value={scope} onChange={(v) => v && setScope(v)} options={[{ value: 'filtered', label: `Filtrados (${filtered.length})` }, { value: 'all', label: `Completos (${all.length})` }]} />
      <Select label="Formato" value={format} onChange={(v) => v && setFormat(v)} options={[{ value: 'xlsx', label: 'Excel (.xlsx)' }, { value: 'csv', label: 'CSV (.csv)' }]} />
      <Text className="text-xs text-gray-500">Incluye {columns.length} columnas: {columns.map((c) => c.header).join(', ')}.</Text>
      {msg ? (msg.ok ? <Notice tone="success">{msg.text}</Notice> : <ErrorState message={msg.text} />) : null}
      <Button label="Exportar" icon={Download} onPress={run} loading={busy} disabled={!rows.length} />
    </Modal>
  );
}
