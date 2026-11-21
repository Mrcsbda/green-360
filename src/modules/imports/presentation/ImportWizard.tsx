import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileUp } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { container } from '@/core/providers/container';
import { colors } from '@/core/theme/tokens';
import type { Customer, Sale } from '@/modules/customers/domain/customer';
import { Button, Chip, ErrorState, Modal, Notice, Select } from '@/shared/components/ui';
import { autoMap, IMPORT_FIELDS, type ImportAnalysis, type ImportTarget, type Mapping } from '../domain/importDomain';
import type { ParsedFile, PickedFile } from '../domain/ports';
import type { CommitResult } from '../application/importService';

const svc = container.importService;
const TARGET_LABEL: Record<ImportTarget, string> = { customers: 'Clientes', sales: 'Ventas / compras' };
const showCell = (v: unknown) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

/** Flujo: elegir archivo → vista previa y mapeo → validación → confirmar → resultado. */
export function ImportWizard({ visible, onClose, defaultTarget = 'customers' }: { visible: boolean; onClose: () => void; defaultTarget?: ImportTarget }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<ImportTarget>(defaultTarget);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [analysis, setAnalysis] = useState<ImportAnalysis<Customer | Sale> | null>(null);
  const [update, setUpdate] = useState(true);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setFile(null); setParsed(null); setAnalysis(null); setResult(null); setError(null); };
  const close = () => { reset(); onClose(); };
  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Error al procesar el archivo'); } finally { setBusy(false); }
  };

  const loadSheet = (f: PickedFile, sheet?: string, t = target) => {
    const p = svc.parse(f, sheet);
    setParsed(p); setMapping(autoMap(t, p.headers)); setAnalysis(null);
  };
  const pick = () => run(async () => {
    const f = await svc.pick();
    if (!f) return;
    setFile(f); setResult(null);
    loadSheet(f);
  });
  const validate = () => run(async () => { if (parsed) setAnalysis(await svc.analyze(target, parsed, mapping)); });
  const commit = () => run(async () => {
    if (!analysis) return;
    setResult(await svc.commit(analysis, update));
    await qc.invalidateQueries({ queryKey: ['customers'] });
  });

  const fields = IMPORT_FIELDS[target];
  const preview = parsed?.rows.slice(0, 20) ?? [];

  return (
    <Modal visible={visible} onClose={close} title="Importar archivo (.xlsx / .csv)" wide>
      {result ? (
        <View className="items-center gap-3 py-6">
          <CheckCircle2 size={36} color={colors.positive} />
          <Text className="text-base font-semibold text-gray-900">Importación completada</Text>
          <Text className="text-sm text-gray-700">{result.insertados} nuevos · {result.actualizados} actualizados · {result.omitidos} omitidos</Text>
          <Text className="text-xs text-gray-500">Tablas, segmentos, indicadores y gráficos ya se actualizaron.</Text>
          <View className="flex-row gap-2"><Button label="Importar otro" variant="secondary" onPress={reset} /><Button label="Cerrar" onPress={close} /></View>
        </View>
      ) : (
        <>
          <Select label="1. ¿Qué vas a importar?" value={target} options={(['customers', 'sales'] as const).map((t) => ({ value: t, label: TARGET_LABEL[t] }))}
            onChange={(v) => { if (!v) return; setTarget(v); if (file && parsed) loadSheet(file, parsed.sheet, v); }} />
          <View className="flex-row flex-wrap items-center gap-3">
            <Button label={file ? 'Cambiar archivo' : '2. Seleccionar archivo'} icon={FileUp} variant={file ? 'secondary' : 'primary'} onPress={pick} loading={busy && !parsed} />
            {file ? <Text className="text-sm text-gray-700">{file.name} · {parsed?.rows.length ?? 0} filas</Text> : <Text className="text-xs text-gray-500">Máximo 10 MB. La primera fila debe tener los encabezados.</Text>}
          </View>
          {parsed && parsed.sheets.length > 1 ? (
            <Select label="Hoja" value={parsed.sheet} options={parsed.sheets} onChange={(s) => s && file && run(() => loadSheet(file, s))} />
          ) : null}

          {parsed ? (
            <>
              <Text className="text-sm font-semibold text-gray-900">3. Mapeo de columnas</Text>
              <Text className="text-xs text-gray-500 -mt-3">Se reconocieron automáticamente por nombre o sinónimo. Ajusta las que falten.</Text>
              {fields.map((f) => (
                <View key={f.key} className="gap-1">
                  <Text className="text-xs font-medium text-gray-700">{f.label}{f.required ? ' *' : ''} → <Text className="text-accent">{mapping[f.key] ?? 'sin mapear'}</Text></Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
                    <Chip label="(ninguna)" selected={!mapping[f.key]} onPress={() => { setMapping({ ...mapping, [f.key]: null }); setAnalysis(null); }} />
                    {parsed.headers.map((h) => <Chip key={h} label={h} selected={mapping[f.key] === h} onPress={() => { setMapping({ ...mapping, [f.key]: h }); setAnalysis(null); }} />)}
                  </ScrollView>
                </View>
              ))}

              <Text className="text-sm font-semibold text-gray-900">Vista previa (primeras {preview.length} filas)</Text>
              <ScrollView horizontal className="border border-gray-200 rounded-lg">
                <View>
                  <View className="flex-row bg-gray-50 border-b border-gray-200">{parsed.headers.map((h) => <Text key={h} className="w-36 px-2 py-1.5 text-xs font-semibold text-gray-600" numberOfLines={1}>{h}</Text>)}</View>
                  {preview.map((r, i) => (
                    <View key={i} className="flex-row border-b border-gray-100">{parsed.headers.map((h) => <Text key={h} className="w-36 px-2 py-1.5 text-xs text-gray-800" numberOfLines={1}>{showCell(r[h])}</Text>)}</View>
                  ))}
                </View>
              </ScrollView>

              <Button label="4. Validar registros" onPress={validate} loading={busy} variant="secondary" />
            </>
          ) : null}

          {analysis ? (
            <View className="gap-3">
              {analysis.columnasFaltantes.length ? (
                <ErrorState message={`Faltan columnas obligatorias: ${analysis.columnasFaltantes.join(', ')}`} />
              ) : (
                <>
                  <View className="flex-row flex-wrap gap-2">
                    <Notice tone="success">{analysis.validos.length} registros válidos de {analysis.total}</Notice>
                    <Notice tone={analysis.errores.length ? 'warning' : 'info'}>{analysis.errores.length} con errores (no se importan)</Notice>
                    <Notice tone="info">{analysis.duplicados.length} duplicados</Notice>
                  </View>
                  {analysis.errores.length ? (
                    <View className="gap-1">
                      <Text className="text-sm font-semibold text-gray-900">Errores de importación</Text>
                      {analysis.errores.slice(0, 50).map((e, i) => <Text key={i} className="text-xs text-red-800">Fila {e.fila} · {e.campo}: {e.mensaje}{e.valor ? ` («${e.valor}»)` : ''}</Text>)}
                      {analysis.errores.length > 50 ? <Text className="text-xs text-gray-500">… y {analysis.errores.length - 50} más</Text> : null}
                    </View>
                  ) : null}
                  {analysis.duplicados.length ? (
                    <View className="gap-1">
                      <Text className="text-sm font-semibold text-gray-900">Duplicados</Text>
                      {analysis.duplicados.slice(0, 30).map((d, i) => <Text key={i} className="text-xs text-gray-700">Fila {d.fila} · {d.id}: {d.detalle}{d.tipo === 'archivo' ? ' (se omite)' : ''}</Text>)}
                      {analysis.duplicados.length > 30 ? <Text className="text-xs text-gray-500">… y {analysis.duplicados.length - 30} más</Text> : null}
                    </View>
                  ) : null}
                  {analysis.validos.some((v) => v.existente) ? (
                    <View className="flex-row items-center gap-3">
                      <Switch value={update} onValueChange={setUpdate} accessibilityLabel="Actualizar registros existentes" />
                      <Text className="text-sm text-gray-800 flex-1">{update ? 'Actualizar los registros que ya existen' : 'Omitir los registros que ya existen'}</Text>
                    </View>
                  ) : null}
                  <Button label={`5. Confirmar e importar ${analysis.validos.filter((v) => update || !v.existente).length} registros`} variant="success" onPress={commit} loading={busy}
                    disabled={!analysis.validos.filter((v) => update || !v.existente).length} />
                </>
              )}
            </View>
          ) : null}
          {error ? <ErrorState message={error} /> : null}
        </>
      )}
    </Modal>
  );
}
