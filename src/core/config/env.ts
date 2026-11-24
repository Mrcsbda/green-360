/** Solo variables públicas (EXPO_PUBLIC_*). Nunca poner claves de proveedores de IA aquí: van en el backend. */
export const env = {
  aiMode: process.env.EXPO_PUBLIC_AI_MODE === 'connected' ? ('connected' as const) : ('reglas' as const),
  aiApiUrl: process.env.EXPO_PUBLIC_AI_API_URL ?? '',
  colabInsightsUrl: process.env.EXPO_PUBLIC_COLAB_INSIGHTS_URL ?? '',
  n8nWebhookUrl: process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL ?? '',
};
