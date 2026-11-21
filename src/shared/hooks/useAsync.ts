import { useEffect, useState } from 'react';

/** Ejecuta una función async cuando cambian sus dependencias. Ignora resultados viejos. */
export function useAsync<T>(fn: () => Promise<T> | null, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    let alive = true;
    const p = fn();
    if (!p) return;
    setState((s) => ({ ...s, loading: true }));
    p.then((data) => alive && setState({ data, loading: false }))
      .catch((e: unknown) => alive && setState({ error: e instanceof Error ? e.message : 'Error inesperado', loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
