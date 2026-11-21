import type { KeyValueStorage } from './keyValueStorage';

/**
 * Colección local genérica con datos semilla. Base de los repositorios locales;
 * para pasar a API REST se reemplaza el repositorio, no las pantallas.
 */
export class LocalCollection<T extends { id: string }> {
  constructor(private storage: KeyValueStorage, private key: string, private seed: () => T[]) {}

  async all(): Promise<T[]> {
    const data = await this.storage.get<T[]>(this.key);
    if (data) return data;
    const initial = this.seed();
    await this.storage.set(this.key, initial);
    return initial;
  }
  async get(id: string) {
    return (await this.all()).find((x) => x.id === id) ?? null;
  }
  async save(item: T) {
    const all = await this.all();
    const i = all.findIndex((x) => x.id === item.id);
    if (i >= 0) all[i] = item; else all.push(item);
    await this.storage.set(this.key, all);
    return item;
  }
  async saveMany(items: T[]) {
    const all = await this.all();
    const byId = new Map(all.map((x) => [x.id, x]));
    for (const it of items) byId.set(it.id, it);
    const next = [...byId.values()];
    await this.storage.set(this.key, next);
    return next;
  }
  async remove(id: string) {
    await this.storage.set(this.key, (await this.all()).filter((x) => x.id !== id));
  }
  async reset() {
    await this.storage.remove(this.key);
  }
}
