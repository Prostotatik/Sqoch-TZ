import { useEffect, useRef } from 'react';
import { useMotionValue, useReducedMotion, useSpring, type MotionValue } from 'motion/react';
import { spring } from '@/motion/tokens';
import { useFinePointer } from './useMediaQuery';

/**
 * Magnetic pull towards the cursor (INV-15): within `radius` px around the element it
 * follows the pointer by `strength`. Only for fine pointers and without reduced motion.
 * Also writes `--proximity` (0..1) on the element for a glow that grows as the cursor nears.
 */
export function useMagnetic<T extends HTMLElement>(radius = 80, strength = 0.25) {
  const ref = useRef<T>(null);
  const fine = useFinePointer();
  const reduced = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, spring.snappy);
  const y = useSpring(my, spring.snappy);
  const enabled = fine && !reduced;

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        // distance to the element edge, not to its centre: wide buttons stay magnetic along their length
        const ex = Math.max(0, Math.abs(dx) - r.width / 2);
        const ey = Math.max(0, Math.abs(dy) - r.height / 2);
        const dist = Math.hypot(ex, ey);
        if (dist < radius) {
          const k = 1 - dist / radius;
          mx.set(Math.max(-12, Math.min(12, dx * strength * k * 0.35)));
          my.set(Math.max(-8, Math.min(8, dy * strength * k * 0.6)));
          el.style.setProperty('--proximity', k.toFixed(3));
        } else {
          mx.set(0);
          my.set(0);
          el.style.setProperty('--proximity', '0');
        }
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      mx.set(0);
      my.set(0);
    };
  }, [enabled, radius, strength, mx, my]);

  return { ref, x: x as MotionValue<number>, y: y as MotionValue<number>, enabled };
}
