import { router } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { colors } from '@/core/theme/tokens';
import { useDataset } from '@/modules/customers/presentation/hooks';
import { directoryColumns } from '@/modules/customers/presentation/columns';
import { DataTable } from '@/shared/components/DataTable';
import { Button, Card, ErrorState, LoadingState, PageHeader } from '@/shared/components/ui';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function DirectoryScreen() {
  const { data, isLoading, error, refetch } = useDataset();
  const [q, setQ] = useState('');
  const rows = useMemo(() => (data?.views ?? []).filter((v) => !q.trim() || norm(v.empresa).includes(norm(q.trim()))), [data, q]);

  return (
    <View className="gap-4">
      <PageHeader title="Directorio de clientes" subtitle="Clientes 360° · todos los clientes registrados"
        right={<Button label="Nuevo cliente" icon={Plus} onPress={() => router.push('/clientes/form')} />} />
      <Card>
        <View className="flex-row items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 mb-3">
          <Search size={16} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar por nombre de empresa" placeholderTextColor={colors.muted} accessibilityLabel="Buscar por nombre de empresa" className="flex-1 py-2 text-sm text-gray-900" />
        </View>
        {isLoading ? <LoadingState /> : error ? <ErrorState message={error.message} onRetry={() => refetch()} /> : (
          <DataTable rows={rows} columns={directoryColumns} rowKey={(r) => r.id} pageSize={12} initialSort={{ key: 'valor', dir: 'desc' }}
            onRowPress={(r) => router.push({ pathname: '/clientes/[id]', params: { id: r.id } })}
            emptyTitle="No hay clientes que coincidan" emptyDescription="Prueba con otro nombre o crea un cliente nuevo." />
        )}
      </Card>
    </View>
  );
}
