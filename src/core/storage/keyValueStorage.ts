import AsyncStorage from '@react-native-async-storage/async-storage';

/** Puerto de almacenamiento: los repositorios dependen de esto, no de AsyncStorage. */
export interface KeyValueStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export const asyncStorage: KeyValueStorage = {
  async get<T>(key: string) {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  set: (key, value) => AsyncStorage.setItem(key, JSON.stringify(value)),
  remove: (key) => AsyncStorage.removeItem(key),
};

/** Para pruebas. */
export function memoryStorage(): KeyValueStorage {
  const m = new Map<string, string>();
  return {
    get: async <T,>(k: string) => (m.has(k) ? (JSON.parse(m.get(k)!) as T) : null),
    set: async (k, v) => void m.set(k, JSON.stringify(v)),
    remove: async (k) => void m.delete(k),
  };
}
