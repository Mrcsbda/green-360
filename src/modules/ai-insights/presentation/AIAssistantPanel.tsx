import { router } from 'expo-router';
import { Bot, Lightbulb, Send, Sparkles } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { container } from '@/core/providers/container';
import { colors } from '@/core/theme/tokens';
import { useAsync } from '@/shared/hooks/useAsync';
import { Badge, cn, EmptyState, ErrorState, LoadingState, Tabs } from '@/shared/components/ui';
import { useFiltersStore } from '@/modules/customers/presentation/filtersStore';
import { useInsightContext } from '@/modules/customers/presentation/hooks';
import { SUGGESTED_QUESTIONS, type AnalysisKind, type InsightAnswer, type Priority } from '../domain/insights';

const KIND: Record<AnalysisKind, { label: string; tone: 'primary' | 'gray' | 'green' }> = {
  regla: { label: 'Regla de negocio', tone: 'primary' },
  descriptivo: { label: 'Análisis descriptivo', tone: 'gray' },
  modelo: { label: 'Modelo entrenado', tone: 'green' },
};
const PRIO: Record<Priority, 'red' | 'amber' | 'gray'> = { alta: 'red', media: 'amber', baja: 'gray' };

interface Msg { id: number; pregunta: string; respuesta?: InsightAnswer; error?: string }

const openCustomer = (id?: string) => id && router.push({ pathname: '/clientes/[id]', params: { id } });

function AnswerCard({ a }: { a: InsightAnswer }) {
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-1.5">
        <Badge label={KIND[a.tipo].label} tone={KIND[a.tipo].tone} />
        {a.modo === 'conectado' ? <Badge label="IA conectada" tone="green" /> : null}
        {!a.datosSuficientes ? <Badge label="Datos insuficientes" tone="red" /> : null}
      </View>
      <Text className="text-sm text-gray-900">{a.texto}</Text>
      {a.items.map((it, i) => (
        <Pressable key={`${it.titulo}-${i}`} disabled={!it.id} onPress={() => openCustomer(it.id)} accessibilityRole={it.id ? 'link' : undefined}
          className="flex-row items-start gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200">
          <View className="flex-1">
            <Text className={cn('text-xs font-semibold', it.id ? 'text-accent' : 'text-gray-900')}>{it.titulo}</Text>
            <Text className="text-xs text-gray-600">{it.detalle}</Text>
          </View>
          {it.valor ? <Text className="text-xs font-semibold text-gray-900">{it.valor}</Text> : null}
        </Pressable>
      ))}
      {a.evidencia.length ? (
        <View className="gap-0.5">
          <Text className="text-[11px] font-semibold text-gray-500 uppercase">Evidencia / variables</Text>
          {a.evidencia.map((e) => <Text key={e} className="text-[11px] text-gray-500">• {e}</Text>)}
        </View>
      ) : null}
    </View>
  );
}

function Chat() {
  const ctx = useInsightContext();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const filters = useFiltersStore((s) => s.filters);
  const filtered = filters.q || filters.segments.length || filters.ciudades.length || filters.canales.length;

  const ask = async (q: string) => {
    if (!q.trim() || !ctx || busy) return;
    const id = Date.now();
    setMsgs((m) => [...m, { id, pregunta: q.trim() }]);
    setText('');
    setBusy(true);
    try {
      const respuesta = await container.insights.ask(q, ctx);
      setMsgs((m) => m.map((x) => (x.id === id ? { ...x, respuesta } : x)));
    } catch (e) {
      setMsgs((m) => m.map((x) => (x.id === id ? { ...x, error: e instanceof Error ? e.message : 'Error del asistente' } : x)));
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <View className="flex-1 gap-3">
      {filtered ? <Text className="text-[11px] text-gray-500">Responde sobre los {ctx?.views.length ?? 0} clientes que dejan ver los filtros activos.</Text> : null}
      <ScrollView ref={scroll} className="flex-1" contentContainerClassName="gap-3 pb-2">
        {!msgs.length ? (
          <View className="gap-2">
            <Text className="text-xs text-gray-500">Preguntas sugeridas</Text>
            {SUGGESTED_QUESTIONS.map((q) => (
              <Pressable key={q} accessibilityRole="button" onPress={() => ask(q)} className="flex-row gap-2 p-2.5 rounded-lg border border-gray-200 bg-white">
                <Lightbulb size={14} color={colors.brand} />
                <Text className="text-xs text-gray-800 flex-1">{q}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {msgs.map((m) => (
          <View key={m.id} className="gap-2">
            <View className="self-end max-w-[90%] bg-primary rounded-xl rounded-br-sm px-3 py-2"><Text className="text-sm text-on-primary">{m.pregunta}</Text></View>
            <View className="bg-white border border-gray-200 rounded-xl rounded-bl-sm p-3">
              {m.respuesta ? <AnswerCard a={m.respuesta} /> : m.error ? <Text className="text-sm text-danger">{m.error}</Text> : <Text className="text-sm text-gray-500">Analizando datos…</Text>}
            </View>
          </View>
        ))}
      </ScrollView>
      <View className="flex-row items-center gap-2">
        <TextInput
          value={text} onChangeText={setText} onSubmitEditing={() => ask(text)} placeholder="Pregunta sobre tus clientes…" placeholderTextColor={colors.muted}
          accessibilityLabel="Pregunta para el asistente" returnKeyType="send"
          className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Enviar pregunta" disabled={busy || !text.trim()} onPress={() => ask(text)}
          className={cn('p-2.5 rounded-lg bg-primary', (busy || !text.trim()) && 'opacity-50')}>
          <Send size={16} color={colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function Alerts() {
  const ctx = useInsightContext();
  const s = useAsync(() => (ctx ? container.insights.alerts(ctx) : null), [ctx]);
  if (s.loading) return <LoadingState label="Calculando alertas…" />;
  if (s.error) return <ErrorState message={s.error} />;
  if (!s.data?.length) return <EmptyState title="Sin alertas" description="Ninguna regla de alerta se cumple con los datos y filtros actuales." />;
  return (
    <ScrollView contentContainerClassName="gap-2 pb-2">
      {s.data.map((a) => (
        <Pressable key={a.id} disabled={!a.customerId} onPress={() => openCustomer(a.customerId)} className="p-3 rounded-lg border border-gray-200 bg-white gap-1.5">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Badge label={`Prioridad ${a.prioridad}`} tone={PRIO[a.prioridad]} />
            <Badge label={KIND[a.tipo].label} tone={KIND[a.tipo].tone} />
          </View>
          <Text className="text-sm font-semibold text-gray-900">{a.titulo}</Text>
          <Text className="text-xs text-gray-700">{a.motivo}</Text>
          {a.evidencia.map((e) => <Text key={e} className="text-[11px] text-gray-500">• {e}</Text>)}
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
  if (!s.data?.length) return <EmptyState title="Sin recomendaciones" description="No hay clientes que cumplan las reglas con los filtros actuales." />;
  return (
    <ScrollView contentContainerClassName="gap-2 pb-2">
      {s.data.map((r) => (
        <Pressable key={r.id} onPress={() => openCustomer(r.customerId)} className="p-3 rounded-lg border border-gray-200 bg-white gap-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-sm font-semibold text-accent flex-1" numberOfLines={1}>{r.objetivo}</Text>
            <Badge label={r.prioridad} tone={PRIO[r.prioridad]} />
          </View>
          <Text className="text-xs text-gray-700"><Text className="font-semibold">Motivo: </Text>{r.motivo}</Text>
          <Text className="text-[11px] text-gray-500">Evidencia: {r.evidencia.join(' · ')}</Text>
          <Text className="text-xs font-medium text-positive">Acción: {r.accion}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function AIAssistantPanel({ embedded }: { embedded?: boolean }) {
  const [tab, setTab] = useState<'chat' | 'alertas' | 'recs'>('chat');
  return (
    <View className={cn('flex-1 bg-gray-50', !embedded && 'border-l border-gray-200')}>
      <View className="h-16 px-4 flex-row items-center gap-2 border-b border-gray-200 bg-white">
        <View className="p-1.5 rounded-lg bg-primary"><Bot size={16} color={colors.onPrimary} /></View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900">Asistente IA Comercial</Text>
          <Text className="text-[11px] text-gray-500">{container.insights.modo === 'conectado' ? 'Conectado a IA' : 'Insights automáticos sobre tus clientes'}</Text>
        </View>
        <Sparkles size={16} color={colors.brand} />
      </View>
      <View className="flex-1 p-4">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'chat', label: 'Chat' }, { value: 'alertas', label: 'Alertas' }, { value: 'recs', label: 'Recomendaciones' }]} />
        {tab === 'chat' ? <Chat /> : tab === 'alertas' ? <Alerts /> : <Recommendations />}
      </View>
    </View>
  );
}

