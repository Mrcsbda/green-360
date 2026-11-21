import { View } from 'react-native';
import { AIAssistantPanel } from '@/modules/ai-insights/presentation/AIAssistantPanel';
import { PageHeader } from '@/shared/components/ui';

/** En móvil y tableta el asistente es una pantalla; en escritorio vive en el panel derecho. */
export default function AssistantScreen() {
  return (
    <View className="gap-2">
      <PageHeader title="Asistente IA Comercial" subtitle="Insights, alertas y recomendaciones sobre tus clientes" />
      <View className="h-[640px] rounded-xl overflow-hidden border border-gray-200"><AIAssistantPanel embedded /></View>
    </View>
  );
}
