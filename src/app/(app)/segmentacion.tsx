import { router } from 'expo-router';
import { Download, Search, Upload, X } from 'lucide-react-native';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { colors, segmentColors } from '@/core/theme/tokens';
import { CommercialAnalytics } from '@/modules/analytics/presentation/CommercialAnalytics';
import { SEGMENT_META, SEGMENTS } from '@/modules/customers/domain/customer';
import { distinct } from '@/modules/customers/domain/filters';
import { exportColumns, segmentationColumns } from '@/modules/customers/presentation/columns';
import { useFiltersStore } from '@/modules/customers/presentation/filtersStore';
import { useFilteredViews } from '@/modules/customers/presentation/hooks';
import { ExportDialog } from '@/modules/imports/presentation/ExportDialog';
import { ImportWizard } from '@/modules/imports/presentation/ImportWizard';
import { DataTable } from '@/shared/components/DataTable';
import { Button, Card, Chip, ErrorState, LoadingState, PageHeader, SectionTitle } from '@/shared/components/ui';


export default function SegmentationScreen() {
  const { data, filtered, filters, isLoading, error, refetch } = useFilteredViews();
  const { setQuery, toggle, clear } = useFiltersStore();
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const active = filters.q || filters.segments.length || filters.ciudades.length || filters.canales.length;

  return (
    <View className="gap-4">
      <PageHeader title="Segmentación inteligente" subtitle="Clasificación automática por recencia, frecuencia, valor e historial de compra"
        right={<><Button label="Importar archivo" icon={Upload} onPress={() => setImportOpen(true)} /><Button label="Exportar archivo" icon={Download} variant="secondary" onPress={() => setExportOpen(true)} disabled={!data} /></>} />

      <Card className="gap-3">
        <View className="flex-row items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3">
          <Search size={16} color={colors.muted} />
          <TextInput value={filters.q} onChangeText={setQuery} placeholder="Buscar por nombre de empresa" placeholderTextColor={colors.muted} accessibilityLabel="Buscar por nombre de empresa" className="flex-1 py-2 text-sm text-gray-900" />
        </View>
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-gray-500 uppercase">Segmento</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {SEGMENTS.map((s) => (
              <Chip key={s} label={`${SEGMENT_META[s].label} (${data?.views.filter((v) => v.segment === s).length ?? 0})`} color={segmentColors[s]} selected={filters.segments.includes(s)} onPress={() => toggle('segments', s)} />
            ))}
          </View>
        </View>
        {data ? (
          <>
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-gray-500 uppercase">Ciudad</Text>
              <View className="flex-row flex-wrap gap-1.5">{distinct(data.views, 'ciudad').map((c) => <Chip key={c} label={c} selected={filters.ciudades.includes(c)} onPress={() => toggle('ciudades', c)} />)}</View>
            </View>
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-gray-500 uppercase">Canal preferido</Text>
              <View className="flex-row flex-wrap gap-1.5">{distinct(data.views, 'canal').map((c) => <Chip key={c} label={c} selected={filters.canales.includes(c)} onPress={() => toggle('canales', c)} />)}</View>
            </View>
          </>
        ) : null}
        {active ? <View className="flex-row items-center gap-3"><Text className="text-xs text-gray-600">{filtered.length} de {data?.views.length ?? 0} clientes</Text><Button label="Limpiar filtros" icon={X} size="sm" variant="ghost" onPress={clear} /></View> : null}
      </Card>

      {isLoading ? <LoadingState /> : error || !data ? <ErrorState message={error?.message ?? 'Sin datos'} onRetry={() => refetch()} /> : (
        <>
          <Card>
            <SectionTitle title="Clientes segmentados" subtitle="Clasificación automática: se recalcula con cada importación, edición o cambio de reglas" />
            <DataTable rows={filtered} columns={segmentationColumns} rowKey={(r) => r.id} pageSize={10} initialSort={{ key: 'valor', dir: 'desc' }}
              onRowPress={(r) => router.push({ pathname: '/clientes/[id]', params: { id: r.id } })}
              emptyTitle="Ningún cliente cumple los filtros" emptyDescription="Combina menos filtros o límpialos." />
          </Card>
          <View>
            <SectionTitle title="Analítica comercial" subtitle="Indicadores y gráficos sobre los clientes filtrados" />
            <CommercialAnalytics views={filtered} rules={data.rules} sales={data.sales} valueCOP={data.valueCOP} />
          </View>
          <ExportDialog visible={exportOpen} onClose={() => setExportOpen(false)} baseName="clientes_segmentados" all={data.views} filtered={filtered} columns={exportColumns} />
        </>
      )}
      <ImportWizard visible={importOpen} onClose={() => setImportOpen(false)} />
    </View>
  );
}
