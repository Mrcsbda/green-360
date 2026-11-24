import { useEffect } from 'react';
import { create } from 'zustand';
import { env } from '@/core/config/env';
import { asyncStorage } from '@/core/storage/keyValueStorage';
import {
  getBundledColabReport,
  isValidColabReport,
  type GreenSightColabReport,
} from '../domain/colabInsights';

const STORAGE_URLS_KEY = 'green360:connections:v1';
const STORAGE_REPORT_KEY = 'green360:colab_report:v1';

export interface ConnectionUrls {
  apiUrl: string;
  colabInsightsUrl: string;
  n8nWebhookUrl: string;
}

const defaultUrls: ConnectionUrls = {
  apiUrl: env.aiApiUrl,
  colabInsightsUrl: env.colabInsightsUrl,
  n8nWebhookUrl: env.n8nWebhookUrl,
};

let cachedUrls: ConnectionUrls = { ...defaultUrls };

export async function getRuntimeConnectionUrls(): Promise<ConnectionUrls> {
  const parsed = await asyncStorage.get<Partial<ConnectionUrls>>(STORAGE_URLS_KEY);
  if (parsed) {
    cachedUrls = {
      apiUrl: parsed.apiUrl?.trim() || env.aiApiUrl,
      colabInsightsUrl: parsed.colabInsightsUrl?.trim() || env.colabInsightsUrl,
      n8nWebhookUrl: parsed.n8nWebhookUrl?.trim() || env.n8nWebhookUrl,
    };
    return cachedUrls;
  }
  return cachedUrls;
}

export function getCachedConnectionUrls(): ConnectionUrls {
  return cachedUrls;
}

export async function saveRuntimeConnectionUrls(next: Partial<ConnectionUrls>): Promise<ConnectionUrls> {
  const current = await getRuntimeConnectionUrls();
  const merged: ConnectionUrls = {
    apiUrl: next.apiUrl !== undefined ? next.apiUrl.trim() : current.apiUrl,
    colabInsightsUrl: next.colabInsightsUrl !== undefined ? next.colabInsightsUrl.trim() : current.colabInsightsUrl,
    n8nWebhookUrl: next.n8nWebhookUrl !== undefined ? next.n8nWebhookUrl.trim() : current.n8nWebhookUrl,
  };
  cachedUrls = merged;
  await asyncStorage.set(STORAGE_URLS_KEY, merged);
  return merged;
}

interface ColabState {
  report: GreenSightColabReport;
  sourceMode: 'bundled' | 'live_api' | 'custom_json';
  syncing: boolean;
  lastError: string | null;
  urls: ConnectionUrls;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  syncFromRemote: (overrideUrl?: string, forceRefresh?: boolean) => Promise<boolean>;
  importJsonReport: (rawText: string) => Promise<void>;
  updateUrls: (next: Partial<ConnectionUrls>) => Promise<void>;
}

export const useColabStore = create<ColabState>((set, get) => ({
  report: getBundledColabReport(),
  sourceMode: 'bundled',
  syncing: false,
  lastError: null,
  urls: defaultUrls,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const urls = await getRuntimeConnectionUrls();
    const saved = await asyncStorage.get<unknown>(STORAGE_REPORT_KEY);
    let report = getBundledColabReport();
    let sourceMode: ColabState['sourceMode'] = 'bundled';
    if (isValidColabReport(saved)) {
      report = saved;
      sourceMode = 'custom_json';
    }
    set({ urls, report, sourceMode, hydrated: true });
    if (urls.colabInsightsUrl || urls.apiUrl) {
      void get().syncFromRemote();
    }
  },

  updateUrls: async (next) => {
    const merged = await saveRuntimeConnectionUrls(next);
    set({ urls: merged });
  },

  importJsonReport: async (rawText) => {
    const parsed = JSON.parse(rawText);
    if (!isValidColabReport(parsed)) {
      throw new Error('El JSON no tiene la estructura de GreenSight Colab (metadata, pca, moeMetrics, clusters, customers, products).');
    }
    await asyncStorage.set(STORAGE_REPORT_KEY, parsed);
    set({ report: parsed, sourceMode: 'custom_json', lastError: null });
  },

  syncFromRemote: async (overrideUrl, forceRefresh = false) => {
    const urls = get().urls;
    const rawTarget = (overrideUrl || urls.colabInsightsUrl || urls.apiUrl).trim();
    if (!rawTarget) {
      set({ lastError: null });
      return false;
    }

    const base = rawTarget.replace(/\/$/, '');
    const endpoint = base.endsWith('.json') || base.includes('/greensight/insights')
      ? `${base}${forceRefresh && base.includes('/greensight/insights') ? '?refresh=true' : ''}`
      : `${base}/greensight/insights${forceRefresh ? '?refresh=true' : ''}`;

    set({ syncing: true, lastError: null });
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`Colab / API respondió HTTP ${res.status}`);
      const json = await res.json();
      if (!isValidColabReport(json)) {
        throw new Error('La respuesta remota no coincide con el esquema GreenSight Colab.');
      }
      await asyncStorage.set(STORAGE_REPORT_KEY, json);
      set({ report: json, sourceMode: 'live_api', syncing: false, lastError: null });
      return true;
    } catch (e) {
      set({
        syncing: false,
        lastError: e instanceof Error ? e.message : 'No se pudo sincronizar con Colab / Backend',
      });
      return false;
    }
  },
}));

export function useColabInsights() {
  const store = useColabStore();
  useEffect(() => {
    void store.hydrate();
  }, [store.hydrate]);
  return store;
}
