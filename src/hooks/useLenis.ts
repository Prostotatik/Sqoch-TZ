import { useEffect, useRef } from 'react';
import type Lenis from 'lenis';
import { setLenis } from '@/motion/scrollTop';

/**
 * Smooth wheel scrolling of the landing on desktop (INV-02): fine pointer only, never with
 * reduced motion; touch devices keep native scrolling. Stopped while the flow panel / modal
 * is open (they scroll inside themselves and carry `data-lenis-prevent`).
 * Lenis is loaded as its own small chunk after first paint.
 */
export function useLenis(enabled: boolean, locked: boolean) {
  const lenis = useRef<Lenis | null>(null);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let instance: Lenis | null = null;
    void import('lenis').then(({ default: LenisCtor }) => {
      if (cancelled) return;
      instance = new LenisCtor({ lerp: 0.1, autoRaf: true, anchors: true });
      lenis.current = instance;
      setLenis(instance);
      if (lockedRef.current) instance.stop();
    });
    return () => {
      cancelled = true;
      instance?.destroy();
      lenis.current = null;
      setLenis(null);
    };
  }, [enabled]);

  useEffect(() => {
    const l = lenis.current;
    if (!l) return;
    if (locked) l.stop();
    else l.start();
  }, [locked]);
}
