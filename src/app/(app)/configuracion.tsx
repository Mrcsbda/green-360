import { zodResolver } from '@hookform/resolvers/zod';
import { Database, RotateCcw, Save, Upload } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { env } from '@/core/config/env';
import { colors } from '@/core/theme/tokens';
import { segmentationRulesSchema, type SegmentationRules } from '@/modules/customers/domain/segmentation';
import { useDataset, useResetData, useSaveRules } from '@/modules/customers/presentation/hooks';
import type { ImportTarget } from '@/modules/imports/domain/importDomain';
import { ImportWizard } from '@/modules/imports/presentation/ImportWizard';
import { DatePicker } from '@/shared/components/pickers';
import { Button, Card, ErrorState, Input, LoadingState, Modal, PageHeader, SectionTitle } from '@/shared/components/ui';

const NUM_FIELDS: { key: Exclude<keyof SegmentationRules, 'fechaReferencia'>; label: string; hint: string }[] = [
  { key: 'frecuenteMinCompras12m', label: 'Frecuente: compras mínimas en 12 meses', hint: 'Frecuencia' },
  { key: 'frecuenteMaxDiasSinCompra', label: 'Frecuente: máximo de días sin compra', hint: 'Recencia' },
  { key: 'frecuenteMinValor12m', label: 'Frecuente: valor mínimo 12 meses (COP)', hint: 'Valor' },
  { key: 'frioDiasSinCompra', label: 'Frío: más de X días sin compra', hint: 'Recencia' },
  { key: 'inactividadDias', label: 'Sin actividad reciente: más de X días', hint: 'Indicador' },
];

export default function SettingsScreen() {
  const { data, isLoading } = useDataset();
  const saveRules = useSaveRules();
  const resetData = useResetData();
  const [importTarget, setImportTarget] = useState<ImportTarget | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saved, setSaved] = useState(false);
  const { control, handleSubmit, reset, formState: { errors } } = useForm<SegmentationRules>({ resolver: zodResolver(segmentationRulesSchema) });
  useEffect(() => { if (data) reset(data.rules); }, [data, reset]);

  if (isLoading || !data) return <LoadingState />;
  const onSave = handleSubmit(async (r) => { await saveRules.mutateAsync(r); setSaved(true); setTimeout(() => setSaved(false), 2500); });

  return (
    <View className="gap-4 max-w-4xl">
      <PageHeader title="Configuración e importación de datos" subtitle="Reglas de segmentación, carga de archivos y base de datos" />
      <Card className="gap-4">
        <SectionTitle title="Reglas de segmentación automática" subtitle="Prioridad: sin compras › frío › frecuente › sin segmentar. Al guardar se reclasifican todos los clientes." />
        <Controller control={control} name="fechaReferencia" render={({ field }) => (
          <DatePicker className="max-w-xs" label="Fecha de referencia del análisis" value={field.value ?? ''} onChange={field.onChange} error={errors.fechaReferencia?.message} />
        )} />
        <View className="flex-row flex-wrap gap-4">
          {NUM_FIELDS.map((f) => (
            <Controller key={f.key} control={control} name={f.key} render={({ field }) => (
              <Input className="flex-1 min-w-[240px]" label={`${f.label} · ${f.hint}`} keyboardType="numeric" value={field.value === undefined ? '' : String(field.value)}
                onChangeText={(t) => field.onChange(t === '' ? undefined : Number(t.replace(',', '.')))} error={errors[f.key]?.message} />
            )} />
          ))}
        </View>
        <View className="flex-row items-center gap-3">
          <Button label="Guardar reglas" icon={Save} onPress={onSave} loading={saveRules.isPending} />
          {saved ? <Text className="text-sm text-positive">Reglas guardadas y clientes reclasificados</Text> : null}
        </View>
      </Card>

      <Card className="gap-3">
        <SectionTitle title="Importación de datos" subtitle="XLSX o CSV con vista previa, mapeo de columnas, validación y control de duplicados" />
        <View className="flex-row flex-wrap gap-2">
          <Button label="Importar clientes" icon={Upload} onPress={() => setImportTarget('customers')} />
          <Button label="Importar ventas / compras" icon={Upload} variant="secondary" onPress={() => setImportTarget('sales')} />
        </View>
      </Card>

      <Card className="gap-3">
        <SectionTitle title="Base de datos" />
        <View className="flex-row items-center gap-2">
          <Database size={16} color={colors.primary} />
          <Text className="text-sm text-gray-800">Almacenamiento local de este dispositivo o navegador</Text>
        </View>
        <Text className="text-xs text-gray-500">Asistente: {env.aiMode === 'connected' && env.aiApiUrl ? `conectado a ${env.aiApiUrl}` : 'insights por reglas de negocio sobre tus datos'}.</Text>
        <View className="self-start mt-1">
          <Button label="Restablecer datos iniciales" icon={RotateCcw} variant="danger" onPress={() => setConfirmReset(true)} />
        </View>
      </Card>

      <Modal visible={confirmReset} onClose={() => setConfirmReset(false)} title="¿Restablecer datos iniciales?">
        <Text className="text-sm text-gray-700">Se borran todos los clientes, ventas, reglas, capacitaciones, licencias y registros de consulta, y se vuelven a cargar los datos iniciales. Esta acción no se puede deshacer.</Text>
        {resetData.error ? <ErrorState message={resetData.error.message} /> : null}
        <View className="flex-row gap-2">
          <Button label="Sí, restablecer" icon={RotateCcw} variant="danger" loading={resetData.isPending} onPress={async () => { await resetData.mutateAsync(); setConfirmReset(false); }} />
          <Button label="Cancelar" variant="secondary" onPress={() => setConfirmReset(false)} />
        </View>
      </Modal>
      {importTarget ? <ImportWizard visible onClose={() => setImportTarget(null)} defaultTarget={importTarget} /> : null}
    </View>
  );
}
