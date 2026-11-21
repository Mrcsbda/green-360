import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrudRepository } from './servicesRepositories';

export function useCrud<T extends { id: string }>(key: string, repo: CrudRepository<T>) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['services', key], queryFn: () => repo.list() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['services', key] });
  const save = useMutation({ mutationFn: (x: T) => repo.save(x), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => repo.remove(id), onSuccess: invalidate });
  return { list, save, remove };
}
