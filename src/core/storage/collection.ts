// Puerto de colección genérico. Implementación actual: almacenamiento local (AsyncStorage / localStorage en web).
// Para pasar a una base de datos remota se implementa esta misma interfaz y se cambia createCollection.
import { asyncStorage } from './keyValueStorage';
import { LocalCollection } from './localCollection';

export interface Collection<T extends { id: string }> {
  all(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  save(item: T): Promise<T>;
  saveMany(items: T[]): Promise<void>;
  remove(id: string): Promise<void>;
  /** Borra todo y vuelve a cargar los registros iniciales. */
  reset(): Promise<void>;
}

export function createCollection<T extends { id: string }>(name: string, seed: () => T[]): Collection<T> {
  const local = new LocalCollection<T>(asyncStorage, `g360.${name}.v1`, seed);
  return {
    all: () => local.all(), get: (id) => local.get(id), save: (x) => local.save(x),
    saveMany: async (x) => void (await local.saveMany(x)), remove: (id) => local.remove(id), reset: () => local.reset(),
  };
}

/** Documento suelto (p. ej. reglas de segmentación). */
export function createDocStore<T extends object>(name: string) {
  const key = `g360.${name}.v1`;
  return { get: () => asyncStorage.get<T>(key), set: (v: T) => asyncStorage.set(key, v), remove: () => asyncStorage.remove(key) };
}
