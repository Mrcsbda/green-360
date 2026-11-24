import { router } from 'expo-router';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Lightbulb,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { container } from '@/core/providers/container';
import { colors } from '@/core/theme/tokens';
import { useColabStore } from '@/modules/analytics/infrastructure/colabClient';
import { useFiltersStore } from '@/modules/customers/presentation/filtersStore';
import { useInsightContext } from '@/modules/customers/presentation/hooks';
import { Badge, cn, EmptyState, ErrorState, LoadingState, Tabs } from '@/shared/components/ui';
import { useAsync } from '@/shared/hooks/useAsync';
import { useChatStore } from '../application/chatStore';
import {
  AUTOMATION_SUGGESTIONS,
  SUGGESTED_QUESTIONS,
  type AnalysisKind,
  type ChatTurn,
  type EmailAutomationDraft,
  type InsightAnswer,
  type InsightContext,
  type Priority,
} from '../domain/insights';
import { dispatchN8nEmailCampaign } from '../infrastructure/httpInsightsService';

const KIND: Record<AnalysisKind, { label: string; tone: 'primary' | 'gray' | 'green' }> = {
  regla: { label: 'Regla / Guardrail', tone: 'primary' },
  descriptivo: { label: 'Análisis descriptivo', tone: 'gray' },
  modelo: { label: 'GreenSight MoE', tone: 'green' },
};
const PRIO: Record<Priority, 'red' | 'amber' | 'gray'> = { alta: 'red', media: 'amber', baja: 'gray' };

const openCustomer = (id?: string) => id && router.push({ pathname: '/clientes/[id]', params: { id } });

function FormattedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text className={className}>
      {parts.map((part, idx) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <Text key={idx} className="font-bold">
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

/** Tarjeta interactiva para revisar y disparar la automatización de correo masivo n8n + MoE. */
function AutomationCard({
  msgId,
  draft,
  ctx,
}: {
  msgId: number;
  draft: EmailAutomationDraft;
  ctx: InsightContext;
}) {
  const updateAutomation = useChatStore((s) => s.updateAutomation);
  const { urls } = useColabStore();
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleDispatch = async () => {
    if (sending) return;
    setSending(true);
    setSendError(null);
    try {
      const result = await dispatchN8nEmailCampaign({
        apiUrl: urls.apiUrl,
        n8nWebhookUrl: urls.n8nWebhookUrl,
        draft,
        ctx,
        testEmailFallback: testEmail,
      });
      updateAutomation(msgId, {
        estado: result.ok ? 'enviado' : 'error',
        resultadoEnvio: result,
      });
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Error al ejecutar flujo n8n');
    } finally {
      setSending(false);
    }
  };

  return (
    <View className="mt-2 p-3 rounded-xl bg-green-50 border border-green-200 gap-2.5">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-row items-center gap-1.5">
          <Mail size={14} color={colors.positive} />
          <Text className="text-xs font-bold text-green-900">Automatización n8n · Correo Masivo MoE</Text>
        </View>
        <Badge
          label={draft.estado === 'enviado' ? 'Enviado en n8n' : `${draft.totalClientesObjetivo} destinatarios`}
          tone={draft.estado === 'enviado' ? 'green' : 'teal'}
        />
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        <Badge label={draft.expertoMoE} tone="primary" />
        <Badge label={`Foco: ${draft.productoFoco}`} tone="gray" />
      </View>

      <Pressable
        onPress={() => setShowPrompt((v) => !v)}
        className="flex-row items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-green-200"
      >
        <View className="flex-row items-center gap-1.5">
          <Cpu size={12} color={colors.primary} />
          <Text className="text-[11px] font-semibold text-gray-800">Prompt generado por MoE</Text>
        </View>
        {showPrompt ? <ChevronUp size={14} color={colors.muted} /> : <ChevronDown size={14} color={colors.muted} />}
      </Pressable>
      {showPrompt ? (
        <View className="p-2.5 rounded-lg bg-gray-900">
          <Text className="text-[11px] text-gray-100 leading-4">{draft.moePrompt}</Text>
        </View>
      ) : null}

      <View className="gap-1">
        <Text className="text-[11px] font-semibold text-gray-700">Asunto del correo (editable)</Text>
        <TextInput
          value={draft.asunto}
          onChangeText={(asunto) => updateAutomation(msgId, { asunto })}
          multiline
          className="bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900"
        />
      </View>

      <View className="gap-1">
        <Text className="text-[11px] font-semibold text-gray-700">Cuerpo del mensaje (soporta {'{{empresa}}'} y {'{{ciudad}}'})</Text>
        <TextInput
          value={draft.cuerpo}
          onChangeText={(cuerpo) => updateAutomation(msgId, { cuerpo })}
          multiline
          numberOfLines={5}
          className="bg-white border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-900 min-h-[104px]"
        />
      </View>

      <View className="gap-1">
        <Text className="text-[11px] text-gray-700">
          Con correo: <Text className="font-semibold">{draft.conCorreo}</Text> · Sin correo registrado:{' '}
          <Text className="font-semibold">{draft.sinCorreo}</Text>
        </Text>
        {draft.sinCorreo > 0 ? (
          <TextInput
            value={testEmail}
            onChangeText={setTestEmail}
            placeholder="Correo de prueba (ej. demo@greenservices.co)"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            className="bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900"
          />
        ) : null}
      </View>

      {sendError ? <Text className="text-xs text-danger">{sendError}</Text> : null}

      {draft.resultadoEnvio ? (
        <View className="flex-row items-center gap-2 p-2 rounded-lg bg-white border border-green-200">
          <CheckCircle2 size={14} color={draft.resultadoEnvio.ok ? colors.positive : colors.warning} />
          <Text className="text-xs text-gray-800 flex-1">{draft.resultadoEnvio.message}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={sending}
        onPress={handleDispatch}
        className={cn(
          'flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-primary',
          sending && 'opacity-60',
        )}
      >
        {sending ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Send size={14} color={colors.onPrimary} />}
        <Text className="text-xs font-semibold text-on-primary">
          {sending ? 'Ejecutando flujo en n8n…' : draft.estado === 'enviado' ? 'Reenviar vía n8n' : 'Aprobar y enviar vía n8n'}
        </Text>
      </Pressable>
    </View>
  );
}

function AnswerCard({
  msgId,
  a,
  ctx,
}: {
  msgId: number;
  a: InsightAnswer;
  ctx: InsightContext;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-1.5">
        <Badge label={KIND[a.tipo].label} tone={KIND[a.tipo].tone} />
        {a.modelo ? <Badge label={a.modelo} tone={a.modo === 'conectado' ? 'green' : 'teal'} /> : null}
        {!a.datosSuficientes ? <Badge label="Fuera de alcance / Sin datos" tone="red" /> : null}
      </View>
      <FormattedText text={a.texto} className="text-sm text-gray-900 leading-5" />
      {a.items.map((it, i) => (
        <Pressable
          key={`${it.titulo}-${i}`}
          disabled={!it.id}
          onPress={() => openCustomer(it.id)}
          accessibilityRole={it.id ? 'link' : undefined}
          className="flex-row items-start gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-200"
        >
          <View className="flex-1">
            <Text className={cn('text-xs font-semibold', it.id ? 'text-accent' : 'text-gray-900')}>{it.titulo}</Text>
            <Text className="text-xs text-gray-600">{it.detalle}</Text>
          </View>
          {it.valor ? <Text className="text-xs font-semibold text-gray-900">{it.valor}</Text> : null}
        </Pressable>
      ))}
      {a.automation ? <AutomationCard msgId={msgId} draft={a.automation} ctx={ctx} /> : null}
      {a.evidencia.length ? (
        <View className="gap-0.5 pt-1 border-t border-gray-100">
          <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Evidencia / trazabilidad</Text>
          {a.evidencia.map((e) => (
            <Text key={e} className="text-[11px] text-gray-500">
              • {e}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Chat() {
  const ctx = useInsightContext();
  const { messages, draftInput, setDraftInput, addUserMessage, resolveMessage, failMessage, clearConversation } =
    useChatStore();
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const filters = useFiltersStore((s) => s.filters);
  const filtered = filters.q || filters.segments.length || filters.ciudades.length || filters.canales.length;

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  const buildHistory = (): ChatTurn[] =>
    messages.flatMap((m) => {
      const turns: ChatTurn[] = [{ role: 'user', content: m.pregunta }];
      if (m.respuesta?.texto) turns.push({ role: 'assistant', content: m.respuesta.texto });
      return turns;
    });

  const ask = async (q: string) => {
    const clean = q.trim();
    if (!clean || !ctx || busy) return;
    const id = Date.now();
    const history = buildHistory();
    addUserMessage(id, clean);
    setDraftInput('');
    setBusy(true);
    try {
      const respuesta = await container.insights.ask(clean, ctx, history);
      resolveMessage(id, respuesta);
    } catch (e) {
      failMessage(id, e instanceof Error ? e.message : 'Error del asistente');
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    }
  };

  return (
    <View className="flex-1 gap-3">
      {/* Barra de estado del hilo y restricciones */}
      <View className="flex-row flex-wrap items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-white border border-gray-200">
        <View className="flex-row items-center gap-1.5 flex-1">
          <ShieldCheck size={13} color={colors.positive} />
          <Text className="text-[11px] font-medium text-gray-700" numberOfLines={1}>
            Solo Green Services · Hilo ({messages.length})
          </Text>
        </View>
        {messages.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={clearConversation}
            className="flex-row items-center gap-1 px-2 py-1 rounded-md bg-gray-100 hover:opacity-80"
          >
            <Trash2 size={11} color={colors.muted} />
            <Text className="text-[11px] font-medium text-gray-700">Nueva charla</Text>
          </Pressable>
        ) : null}
      </View>

      {filtered ? (
        <Text className="text-[11px] text-gray-500 px-1">
          Responde sobre los {ctx?.views.length ?? 0} clientes visibles según filtros activos.
        </Text>
      ) : null}

      <ScrollView ref={scroll} className="flex-1" contentContainerClassName="gap-3 pb-2">
        {!messages.length ? (
          <View className="gap-3">
            <View className="p-3 rounded-xl bg-primary-50 border border-primary/20 gap-1.5">
              <Text className="text-xs font-bold text-primary">Asistente Conversacional Green Services</Text>
              <Text className="text-xs text-gray-700 leading-4">
                Conectado a modelos gratuitos de Hugging Face, predicciones GreenSight MoE de Colab y flujos automáticos en n8n. Mantengo el contexto de tu conversación, pero solo respondo temas de Green Services.
              </Text>
            </View>

            <View className="gap-1.5">
              <Text className="text-[11px] font-semibold text-gray-500 uppercase">Consultas comerciales y Colab MoE</Text>
              {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
                <Pressable
                  key={q}
                  accessibilityRole="button"
                  onPress={() => ask(q)}
                  className="flex-row items-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                >
                  <Lightbulb size={14} color={colors.brand} />
                  <Text className="text-xs text-gray-800 flex-1">{q}</Text>
                </Pressable>
              ))}
            </View>

            <View className="gap-1.5">
              <Text className="text-[11px] font-semibold text-gray-500 uppercase">Automatizaciones por texto (MoE + n8n)</Text>
              {AUTOMATION_SUGGESTIONS.map((q) => (
                <Pressable
                  key={q}
                  accessibilityRole="button"
                  onPress={() => ask(q)}
                  className="flex-row items-center gap-2 p-2.5 rounded-xl border border-green-200 bg-green-50 hover:opacity-90"
                >
                  <Mail size={14} color={colors.positive} />
                  <Text className="text-xs text-green-900 flex-1">{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {messages.map((m) => (
          <View key={m.id} className="gap-2">
            <View className="self-end max-w-[90%] bg-primary rounded-2xl rounded-br-sm px-3.5 py-2.5">
              <Text className="text-sm text-on-primary leading-5">{m.pregunta}</Text>
              <Text className="text-[10px] text-on-primary/70 text-right mt-0.5">{m.createdAt}</Text>
            </View>
            <View className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm p-3.5">
              {m.respuesta && ctx ? (
                <AnswerCard msgId={m.id} a={m.respuesta} ctx={ctx} />
              ) : m.error ? (
                <Text className="text-sm text-danger">{m.error}</Text>
              ) : (
                <View className="flex-row items-center gap-2 py-1">
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text className="text-xs text-gray-500">Consultando GreenSight MoE y Hugging Face…</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <View className="gap-1.5 pt-1 border-t border-gray-200">
        <View className="flex-row items-end gap-2">
          <TextInput
            value={draftInput}
            onChangeText={setDraftInput}
            onSubmitEditing={() => ask(draftInput)}
            placeholder="Pregunta sobre Green Services o pide enviar un correo masivo…"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Pregunta para el asistente"
            returnKeyType="send"
            multiline
            className="flex-1 bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 max-h-28"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar pregunta"
            disabled={busy || !draftInput.trim()}
            onPress={() => ask(draftInput)}
            className={cn(
              'p-3 rounded-xl bg-primary items-center justify-center',
              (busy || !draftInput.trim()) && 'opacity-50',
            )}
          >
            {busy ? <RefreshCw size={16} color={colors.onPrimary} /> : <Send size={16} color={colors.onPrimary} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Alerts() {
  const ctx = useInsightContext();
  const s = useAsync(() => (ctx ? container.insights.alerts(ctx) : null), [ctx]);
  if (s.loading) return <LoadingState label="Calculando alertas…" />;
  if (s.error) return <ErrorState message={s.error} />;
  if (!s.data?.length)
    return <EmptyState title="Sin alertas" description="Ninguna regla de alerta se cumple con los datos y filtros actuales." />;
  return (
    <ScrollView contentContainerClassName="gap-2 pb-2">
      {s.data.map((a) => (
        <Pressable
          key={a.id}
          disabled={!a.customerId}
          onPress={() => openCustomer(a.customerId)}
          className="p-3 rounded-xl border border-gray-200 bg-white gap-1.5"
        >
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Badge label={`Prioridad ${a.prioridad}`} tone={PRIO[a.prioridad]} />
            <Badge label={KIND[a.tipo].label} tone={KIND[a.tipo].tone} />
          </View>
          <Text className="text-sm font-semibold text-gray-900">{a.titulo}</Text>
          <Text className="text-xs text-gray-700">{a.motivo}</Text>
          {a.evidencia.map((e) => (
            <Text key={e} className="text-[11px] text-gray-500">
              • {e}
            </Text>
          ))}
          <Text className="text-xs font-medium text-positive">→ {a.accion}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Recommendations() {
  const ctx = useInsightContext();
  const s = useAsync(() => (ctx ? container.insights.recommendations(ctx) : null), [ctx]);
  if (s.loading) return <LoadingState label="Generando recomendaciones…" />;
  if (s.error) return <ErrorState message={s.error} />;
  if (!s.data?.length)
    return <EmptyState title="Sin recomendaciones" description="No hay clientes que cumplan las reglas con los filtros actuales." />;
  return (
    <ScrollView contentContainerClassName="gap-2 pb-2">
      {s.data.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => openCustomer(r.customerId)}
          className="p-3 rounded-xl border border-gray-200 bg-white gap-1"
        >
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-sm font-semibold text-accent flex-1" numberOfLines={1}>
              {r.objetivo}
            </Text>
            <Badge label={r.prioridad} tone={PRIO[r.prioridad]} />
          </View>
          <Text className="text-xs text-gray-700">
            <Text className="font-semibold">Motivo: </Text>
            {r.motivo}
          </Text>
          <Text className="text-[11px] text-gray-500">Evidencia: {r.evidencia.join(' · ')}</Text>
          <Text className="text-xs font-medium text-positive">Acción: {r.accion}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function AIAssistantPanel({ embedded }: { embedded?: boolean }) {
  const [tab, setTab] = useState<'chat' | 'alertas' | 'recs'>('chat');
  const { urls } = useColabStore();
  const connected = Boolean(urls.apiUrl);

  return (
    <View className={cn('flex-1 bg-gray-50', !embedded && 'border-l border-gray-200')}>
      <View className="h-16 px-4 flex-row items-center gap-2.5 border-b border-gray-200 bg-white">
        <View className="p-2 rounded-xl bg-primary">
          <Bot size={17} color={colors.onPrimary} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-gray-900">Green 360° IA · MoE</Text>
          <Text className="text-[11px] text-gray-500" numberOfLines={1}>
            {connected ? 'Hugging Face + Colab MoE + n8n' : 'MoE Local · Conecta Docker para HF/n8n'}
          </Text>
        </View>
        <View className="flex-row items-center gap-1 px-2 py-1 rounded-full bg-green-50 border border-green-200">
          <Sparkles size={12} color={colors.positive} />
          <Text className="text-[10px] font-semibold text-green-800">{connected ? 'Online' : 'MoE'}</Text>
        </View>
      </View>
      <View className="flex-1 p-3.5">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'chat', label: 'Chat' },
            { value: 'alertas', label: 'Alertas' },
            { value: 'recs', label: 'Recomendaciones' },
          ]}
        />
        {tab === 'chat' ? <Chat /> : tab === 'alertas' ? <Alerts /> : <Recommendations />}
      </View>
    </View>
  );
}
