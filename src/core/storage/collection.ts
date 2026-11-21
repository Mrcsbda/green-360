// Puerto de colección genérico. Implementaciones: Firestore (producción) y almacenamiento local (sin configuración de Firebase).
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { firebaseEnabled } from '@/core/firebase/config';
import { firestore, requireUser } from '@/core/firebase/app';
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

const BATCH = 450; // límite de Firestore: 500 operaciones por lote

async function writeChunks<T extends { id: string }>(name: string, items: T[], del = false) {
  const db = firestore();
  for (let i = 0; i < items.length; i += BATCH) {
    const b = writeBatch(db);
    for (const it of items.slice(i, i + BATCH)) {
      const ref = doc(db, name, it.id);
      if (del) b.delete(ref); else b.set(ref, it);
    }
    await b.commit();
  }
}

/** Colección de Firestore. La primera vez se llena con los registros iniciales (marcado en _meta/{name}). */
export class FirestoreCollection<T extends { id: string }> implements Collection<T> {
  private seeding: Promise<void> | null = null;
  constructor(private name: string, private seed: () => T[]) {}

  private async ensureSeeded() {
    await requireUser();
    this.seeding ??= (async () => {
      const meta = doc(firestore(), '_meta', this.name);
      if ((await getDoc(meta)).exists()) return;
      await writeChunks(this.name, this.seed());
      await setDoc(meta, { seededAt: new Date().toISOString() });
    })().catch((e) => { this.seeding = null; throw e; });
    await this.seeding;
  }
  async all() {
    await this.ensureSeeded();
    return (await getDocs(collection(firestore(), this.name))).docs.map((d) => d.data() as T);
  }
  async get(id: string) {
    await this.ensureSeeded();
    const s = await getDoc(doc(firestore(), this.name, id));
    return s.exists() ? (s.data() as T) : null;
  }
  async save(item: T) {
    await this.ensureSeeded();
    await setDoc(doc(firestore(), this.name, item.id), item);
    return item;
  }
  async saveMany(items: T[]) {
    await this.ensureSeeded();
    await writeChunks(this.name, items);
  }
  async remove(id: string) {
    await requireUser();
    await deleteDoc(doc(firestore(), this.name, id));
  }
  async reset() {
    await requireUser();
    const existing = (await getDocs(collection(firestore(), this.name))).docs.map((d) => ({ id: d.id }));
    await writeChunks(this.name, existing, true);
    await deleteDoc(doc(firestore(), '_meta', this.name));
    this.seeding = null;
    await this.ensureSeeded();
  }
}

export function createCollection<T extends { id: string }>(name: string, seed: () => T[]): Collection<T> {
  if (firebaseEnabled) return new FirestoreCollection<T>(name, seed);
  const local = new LocalCollection<T>(asyncStorage, `g360.${name}.v1`, seed);
  return {
    all: () => local.all(), get: (id) => local.get(id), save: (x) => local.save(x),
    saveMany: async (x) => void (await local.saveMany(x)), remove: (id) => local.remove(id), reset: () => local.reset(),
  };
}

/** Documento suelto (p. ej. reglas de segmentación): settings/{name} en Firestore. */
export function createDocStore<T extends object>(name: string) {
  if (!firebaseEnabled) {
    const key = `g360.${name}.v1`;
    return { get: () => asyncStorage.get<T>(key), set: (v: T) => asyncStorage.set(key, v), remove: () => asyncStorage.remove(key) };
  }
  const ref = () => doc(firestore(), 'settings', name);
  return {
    get: async () => { await requireUser(); const s = await getDoc(ref()); return s.exists() ? (s.data() as T) : null; },
    set: async (v: T) => { await requireUser(); await setDoc(ref(), v); },
    remove: async () => { await requireUser(); await deleteDoc(ref()); },
  };
}
