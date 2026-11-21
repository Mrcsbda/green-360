import { createCollection, type Collection } from '@/core/storage/collection';
import { consultationsFixture, licensesFixture, trainingsFixture } from '@/data/fixtures/services';
import type { Consultation } from './consultations/domain/consultation';
import type { License } from './licenses/domain/license';
import type { Training } from './training/domain/training';

/** Puerto CRUD para los registros de Servicios y operaciones. */
export type CrudRepository<T extends { id: string }> = Pick<Collection<T>, 'save' | 'remove' | 'reset'> & { list(): Promise<T[]> };

function repo<T extends { id: string }>(name: string, seed: () => T[]): CrudRepository<T> {
  const col = createCollection<T>(name, seed);
  return { list: () => col.all(), save: (x) => col.save(x), remove: (id) => col.remove(id), reset: () => col.reset() };
}

export const trainingRepository = () => repo<Training>('trainings', () => trainingsFixture);
export const licenseRepository = () => repo<License>('licenses', () => licensesFixture);
export const consultationRepository = () => repo<Consultation>('consultations', () => consultationsFixture);
