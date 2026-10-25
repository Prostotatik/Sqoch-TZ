import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Layout modes from the spec: phone (<768), sheet (768–1023), panel (>=1024). */
export type LayoutMode = 'phone' | 'sheet' | 'panel';

export function useLayoutMode(): LayoutMode {
  const sheet = useMediaQuery('(min-width: 768px)');
  const panel = useMediaQuery('(min-width: 1024px)');
  return panel ? 'panel' : sheet ? 'sheet' : 'phone';
}

/** Fine pointer with hover — magnet, tilt and cursor effects are enabled only here. */
export function useFinePointer(): boolean {
  return useMediaQuery('(hover: hover) and (pointer: fine)');
}
