import { m, useReducedMotion } from 'motion/react';

const COLORS = ['#f8673b', '#f86a55', '#e92e48', '#7f4bda', '#2646ef', '#9d67de'];

/**
 * DOM confetti of low-poly shards (light stand-in for INV-13's GPU burst):
 * they fly out from the check mark and settle. Hidden with reduced motion.
 */
export function Shards({ count = 18, mode = 'burst' }: { count?: number; mode?: 'burst' | 'fall' }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return (
    <div className="shards" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + rnd() * 0.5;
        const dist = 120 + rnd() * 260;
        const size = 8 + rnd() * 18;
        const x = Math.cos(a) * dist;
        const y = Math.sin(a) * dist * 0.8;
        const rot = rnd() * 360;
        const fall = mode === 'fall';
        return (
          <m.span
            key={i}
            className="shard"
            style={{ width: size, height: size * 1.8, background: COLORS[i % COLORS.length], left: '50%', top: fall ? '-10%' : '24%' }}
            initial={fall ? { x: x * 1.4, y: 0, opacity: 0, rotate: rot } : { x: 0, y: 0, opacity: 0, scale: 0.2, rotate: rot }}
            animate={
              fall
                ? { y: [0, 500 + rnd() * 300], opacity: [0, 0.8, 0], rotate: rot + 120 }
                : { x, y: [0, y, y + 40 + rnd() * 60], opacity: [0, 1, 0.75], scale: 1, rotate: rot + 180 + rnd() * 180 }
            }
            transition={{ duration: fall ? 3 + rnd() * 2 : 1.6, delay: 0.35 + rnd() * 0.25, ease: [0.16, 1, 0.3, 1], repeat: fall ? Infinity : 0, repeatDelay: rnd() * 2 }}
          />
        );
      })}
    </div>
  );
}
