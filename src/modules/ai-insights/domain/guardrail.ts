import type { GreenSightColabReport } from '@/modules/analytics/domain/colabInsights';
import { formatCOPShort } from '@/core/utils/format';
import type { CustomerView } from '@/modules/customers/domain/segmentation';
import type { ChatTurn, EmailAutomationDraft, InsightContext } from './insights';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const GREEN_SERVICES_TERMS = [
  'green services',
  'green 360',
  'green360',
  'greensight',
  'cliente',
  'clientes',
  'empresa',
  'empresas',
  'venta',
  'ventas',
  'compra',
  'compras',
  'recompra',
  'segment',
  'frecuente',
  'frio',
  'inactiv',
  'riesgo',
  'cluster',
  'kmeans',
  'k-means',
  'pca',
  'glm',
  'tweedie',
  'moe',
  'experto',
  'mcp',
  'colab',
  'demanda',
  'producto',
  'productos',
  'servicio',
  'servicios',
  'documental',
  'respaldo',
  'backup',
  'almacenamiento',
  'digitalizacion',
  'migracion',
  'continuidad',
  'soporte',
  'licencia',
  'licencias',
  'capacitacion',
  'capacitaciones',
  'consulta',
  'consultas',
  'ciudad',
  'ciudades',
  'bogota',
  'medellin',
  'cali',
  'barranquilla',
  'canal',
  'whatsapp',
  'llamada',
  'visita',
  'correo',
  'correos',
  'email',
  'masivo',
  'masiva',
  'campana',
  'n8n',
  'automatiz',
  'reactivar',
  'reactivacion',
  'fidelizar',
  'oportunidad',
  'prioridad',
  'prioritario',
  'alerta',
  'trm',
  'cop',
  'usd',
  'facturacion',
  'ticket',
  'recencia',
  'frecuencia',
  'dashboard',
  'grafica',
  'indicador',
  'kpi',
  'operativo',
  'prompt',
  'reposicion',
  'vip',
  'recurrente',
  'resumen',
  'metrica',
  'total',
  'sector',
  'vencid',
  'vencer',
  'mensual',
  'facturado',
  'facturo',
  'compro',
  'quienes son',
  'que ofrecen',
  'que hacen',
];

/**
 * Clientes registrados mencionados en el texto: por nombre completo o por número
 * ("cliente 7", "cliente de prueba 007", "empresa #12").
 */
export function findMentionedCustomers(text: string, views: CustomerView[]): CustomerView[] {
  const q = norm(text);
  if (!q) return [];
  const nums = new Set(
    [...q.matchAll(/\b(?:cliente|empresa)s?(?: de prueba)?\s*(?:#|no\.?|numero)?\s*0*(\d{1,4})\b/g)].map((m) => Number(m[1])),
  );
  return views
    .filter((v) => {
      const name = norm(v.empresa);
      if (name.length >= 4 && q.includes(name)) return true;
      const n = name.match(/(\d+)$/);
      return !!n && nums.has(Number(n[1]));
    })
    .slice(0, 5);
}

const OFF_TOPIC_PATTERNS = [
  /\b(clima|tiempo|lluvia|pronostico)\b/,
  /\b(futbol|partido|mundial|gol|nba|tenis|deporte)\b/,
  /\b(receta|cocina|pasta|hamburguesa|pizza|postre)\b/,
  /\b(pelicula|serie|netflix|musica|cancion|chiste|poema|cuento)\b/,
  /\b(politica|elecciones|presidente|guerra|religion)\b/,
  /\b(horoscopo|zodiaco|tarot|loteria)\b/,
  /(ignora(r)? (las )?instrucciones|ignore previous|forget your rules|jailbreak|modo dan)/,
];

const GREETINGS = ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'gracias', 'ok', 'listo', 'ayuda', 'que puedes hacer'];

const AUTOMATION_TERMS = [
  'correo masivo',
  'correos masivos',
  'enviar correo',
  'envia correo',
  'enviale un correo',
  'enviales un correo',
  'manda un correo',
  'mandar correo',
  'mandales',
  'campana',
  'email masivo',
  'automatiz',
  'n8n',
  'difusion',
  'reactivacion por correo',
];

export function isMassEmailAutomationIntent(question: string): boolean {
  const q = norm(question);
  return AUTOMATION_TERMS.some((t) => q.includes(t));
}

export function checkGreenServicesTopic(
  question: string,
  history: ChatTurn[] = [],
  mentionsCustomer = false,
): { allowed: boolean; reason: string; kind: 'domain' | 'greeting' | 'follow_up' | 'blocked' } {
  const q = norm(question);
  if (!q) {
    return {
      allowed: false,
      kind: 'blocked',
      reason: 'Escribe una pregunta o instrucción operativa sobre Green Services.',
    };
  }

  if (OFF_TOPIC_PATTERNS.some((re) => re.test(q))) {
    return {
      allowed: false,
      kind: 'blocked',
      reason:
        'Solo estoy autorizado para hablar sobre **Green Services / Green 360°** (clientes, ventas, segmentación, predicciones GreenSight ML/MoE, licencias, capacitaciones y automatizaciones de correo en n8n).',
    };
  }

  if (mentionsCustomer || GREEN_SERVICES_TERMS.some((term) => q.includes(term))) {
    return { allowed: true, kind: 'domain', reason: 'ok' };
  }

  if (GREETINGS.some((g) => q === g || q.startsWith(`${g} `))) {
    return { allowed: true, kind: 'greeting', reason: 'greeting' };
  }

  const followUps = ['y a esos', 'esos', 'cuales', 'cuantos', 'hazlo', 'cambiale', 'mejora', 'mas formal', 'mas corto', 'envialo', 'repite', 'explica', 'detalle', 'por que'];
  // Seguimiento corto dentro de una conversación ya iniciada sobre Green Services ("¿y en Cali?").
  if (history.length > 0 && (followUps.some((f) => q.includes(f)) || q.split(/\s+/).length <= 6)) {
    return { allowed: true, kind: 'follow_up', reason: 'follow_up' };
  }

  return {
    allowed: false,
    kind: 'blocked',
    reason:
      'Mi alcance está restringido exclusivamente a **Green Services (Green 360°)**: puedo responder sobre clientes, ventas, clústeres PCA/K-Means, demanda GLM/MoE, servicios documentales y envío de correos masivos en n8n.',
  };
}

export function buildLocalMoeEmailDraft(
  pregunta: string,
  ctx: InsightContext,
  report: GreenSightColabReport,
): EmailAutomationDraft {
  const q = norm(pregunta);
  const mlById = new Map(report.customers.map((c) => [c.id, c]));

  let selected = ctx.views.map((v) => {
    const ml = mlById.get(v.id);
    return {
      view: v,
      clusterId: ml?.clusterId ?? (v.segment === 'frio' ? 2 : v.segment === 'frecuente' ? 0 : 1),
      demandaMoeCOP: ml?.demandaMoeCOP ?? Math.round(v.valor12m * 0.25),
      pesosExpertos: ml?.pesosExpertos ?? [0.33, 0.34, 0.33],
      productoRecomendado: ml?.productoRecomendado ?? report.products[0]?.producto ?? 'Implementación documental',
    };
  });

  const tags: string[] = [];
  const cities = ['bogota', 'medellin', 'cali', 'barranquilla'].filter((c) => q.includes(c));
  if (cities.length) {
    selected = selected.filter((x) => cities.includes(norm(x.view.ciudad)));
    tags.push(`ciudad: ${cities.join(', ')}`);
  }

  if (q.includes('frio') || q.includes('inactiv') || q.includes('riesgo') || q.includes('reactiv')) {
    selected = selected.filter((x) => x.view.segment === 'frio' || x.clusterId === 2);
    tags.push('clientes fríos / clúster en riesgo');
  } else if (q.includes('vip') || q.includes('alto valor') || q.includes('alta prioridad') || q.includes('reposicion')) {
    selected = selected.filter((x) => x.clusterId === 0 || x.demandaMoeCOP >= 15_000_000);
    tags.push('clúster Alto Valor / VIP (MoE)');
  } else if (q.includes('frecuent') || q.includes('recurrent') || q.includes('fideliz')) {
    selected = selected.filter((x) => x.view.segment === 'frecuente' || x.clusterId === 1);
    tags.push('clientes frecuentes / recurrentes');
  }

  if (!selected.length) {
    selected = ctx.views.slice(0, 15).map((v) => {
      const ml = mlById.get(v.id);
      return {
        view: v,
        clusterId: ml?.clusterId ?? 1,
        demandaMoeCOP: ml?.demandaMoeCOP ?? Math.round(v.valor12m * 0.25),
        pesosExpertos: ml?.pesosExpertos ?? [0.33, 0.34, 0.33],
        productoRecomendado: ml?.productoRecomendado ?? 'Implementación documental',
      };
    });
    tags.push('cartera visible priorizada');
  }

  const counts = [0, 0, 0];
  for (const s of selected) counts[s.clusterId] = (counts[s.clusterId] ?? 0) + 1;
  const domCluster = counts.indexOf(Math.max(...counts));

  const n = Math.max(1, selected.length);
  const avgWeights = [0, 1, 2].map((i) =>
    Number((selected.reduce((a, s) => a + (s.pesosExpertos[i] ?? 0.33), 0) / n).toFixed(3)),
  );
  const totalMoe = selected.reduce((a, s) => a + s.demandaMoeCOP, 0);
  const prodFreq = new Map<string, number>();
  for (const s of selected) prodFreq.set(s.productoRecomendado, (prodFreq.get(s.productoRecomendado) ?? 0) + 1);
  const topProduct = [...prodFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Implementación documental';

  const expertLabel =
    domCluster === 0
      ? 'Experto 0 · Alto Valor / Expansión'
      : domCluster === 2
        ? 'Experto 2 · Reactivación / Riesgo'
        : 'Experto 1 · Recurrente / Fidelización';

  const segmentDesc = tags.join(' · ') || 'clientes visibles de Green Services';

  const moePrompt = [
    '[ORQUESTADOR MoE GREENSIGHT]',
    `- Segmento objetivo: ${segmentDesc} (${selected.length} clientes)`,
    `- Clúster dominante K-Means: ${domCluster} | ${expertLabel}`,
    `- Pesos promedio MoE [E0, E1, E2]: [${avgWeights.join(', ')}]`,
    `- Demanda proyectada MoE del grupo: ${formatCOPShort(totalMoe)}`,
    `- Producto foco Green Services: ${topProduct}`,
    `- Solicitud operativa: ${pregunta}`,
  ].join('\n');

  const asunto =
    domCluster === 2
      ? `Green Services · Reactiva tu gestión de ${topProduct} con diagnóstico prioritario`
      : domCluster === 0
        ? `Green Services · Escalemos juntos tu operación en ${topProduct}`
        : `Green Services · Recomendaciones operativas en ${topProduct}`;

  const cuerpo =
    domCluster === 2
      ? `Hola {{empresa}},\n\nEn Green Services queremos asegurar la continuidad de su operación en {{ciudad}}. Nuestro modelo GreenSight identificó una oportunidad prioritaria para reactivar su servicio de ${topProduct}, respaldo en la nube y soporte operativo.\n\n¿Agendamos una revisión técnica sin costo de 15 minutos esta semana?\n\nCordialmente,\nEquipo Comercial · Green Services`
      : domCluster === 0
        ? `Estimado equipo de {{empresa}},\n\nDe acuerdo con la proyección GreenSight MoE para su operación en {{ciudad}}, ponemos a su disposición cupos prioritarios en ${topProduct}, migración asistida y capacitación de usuarios para el próximo trimestre.\n\nQuedamos atentos para presentarles la propuesta.\n\nAtentamente,\nDirección Comercial · Green Services`
        : `Hola {{empresa}},\n\nAgradecemos su confianza en Green Services en {{ciudad}}. Preparamos una actualización recomendada en ${topProduct} y gestión documental para optimizar los tiempos de su equipo.\n\nResponda este correo si desea revisar renovaciones o nuevas capacitaciones.\n\nUn saludo,\nEquipo Green Services`;

  const withEmail = selected.filter((s) => !!s.view.email.trim()).length;

  return {
    tipo: 'mass_email_n8n',
    estado: 'borrador',
    segmentoDescripcion: segmentDesc,
    clusterDominante: domCluster,
    expertoMoE: expertLabel,
    pesosExpertos: avgWeights,
    productoFoco: topProduct,
    moePrompt,
    asunto,
    cuerpo,
    totalClientesObjetivo: selected.length,
    conCorreo: withEmail,
    sinCorreo: selected.length - withEmail,
    destinatarios: selected.slice(0, 50).map((s) => ({
      id: s.view.id,
      empresa: s.view.empresa,
      email: s.view.email,
      ciudad: s.view.ciudad,
      segmento: s.view.segment,
      clusterId: s.clusterId,
      demandaMoeCOP: s.demandaMoeCOP,
    })),
  };
}
