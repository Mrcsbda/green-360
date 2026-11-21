import { useState } from 'react';
import { View } from 'react-native';
import { ConsultationsPanel } from '@/modules/services/consultations/presentation/ConsultationsPanel';
import { LicensesPanel } from '@/modules/services/licenses/presentation/LicensesPanel';
import { TrainingPanel } from '@/modules/services/training/presentation/TrainingPanel';
import { PageHeader, Tabs } from '@/shared/components/ui';

type Tab = 'capacitacion' | 'licencias' | 'consultas';

export default function ServicesScreen() {
  const [tab, setTab] = useState<Tab>('capacitacion');
  return (
    <View>
      <PageHeader title="Servicios y operaciones" subtitle="Capacitaciones, licencias y respaldos, y bases de consulta" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'capacitacion', label: 'Capacitación' }, { value: 'licencias', label: 'Licencias y respaldos' }, { value: 'consultas', label: 'Bases de consulta' }]} />
      {tab === 'capacitacion' ? <TrainingPanel /> : tab === 'licencias' ? <LicensesPanel /> : <ConsultationsPanel />}
    </View>
  );
}
