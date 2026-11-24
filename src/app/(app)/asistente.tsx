import { View } from 'react-native';
import { AIAssistantPanel } from '@/modules/ai-insights/presentation/AIAssistantPanel';
import { PageHeader } from '@/shared/components/ui';

/** En móvil y tableta el asistente es una pantalla; en escritorio vive en el panel derecho. */
export default function AssistantScreen() {
  return (
    <View className="gap-3 flex-1">
      <PageHeader
        title="Asistente IA · Green Services"
        subtitle="Conversación contextual con Hugging Face, predicciones Colab MoE y envíos masivos en n8n"
      />
      <View className="h-[680px] rounded-2xl overflow-hidden border border-gray-200 bg-white">
        <AIAssistantPanel embedded />
      </View>
    </View>
  );
}
