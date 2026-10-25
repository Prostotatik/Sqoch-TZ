import { useEffect, useRef } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import type { TicketType } from '@/domain';
import { play } from '@/motion/waapi';
import { spring } from '@/motion/tokens';
import { sceneInput } from '@/components/three/sceneState';

const ART: Record<TicketType, string> = {
  full: '/assets/3d/blob-full.webp',
  child: '/assets/3d/blob-child.webp',
};

/** Echo copies behind the main object: [x, y, scale] per extra ticket (2nd, 3rd, 4th). */
const ECHOES: [number, number, number][] = [
  [-0.3, 0.12, 0.62],
  [-0.52, -0.06, 0.46],
  [-0.68, 0.18, 0.36],
];

/**
 * Ticket object from the reference: a glossy 3D render (full — an iridescent blossom,
 * child — twin bubbles: a big and a small sphere, "adult + child"). Every extra ticket of the
 * type adds a smaller echo of the object behind it; a quantity change pops the object with a
 * jelly spring and pulses the scene; 0 → a dim, desaturated ghost; `alert` makes it tremble.
 */
export function TicketGlyph({
  type,
  count,
  size = 'md',
  alert = false,
}: {
  type: TicketType;
  count: number;
  size?: 'sm' | 'md';
  /** e.g. child tickets without an adult */
  alert?: boolean;
}) {
  const reduced = useReducedMotion();
  const main = useRef<HTMLImageElement>(null);
  const prev = useRef(count);
  const echoes = ECHOES.slice(0, Math.max(0, Math.min(4, count) - 1));

  useEffect(() => {
    if (prev.current === count) return;
    const grew = count > prev.current;
    prev.current = count;
    sceneInput.pulse = Math.min(1, sceneInput.pulse + 0.6);
    if (reduced || !main.current) return;
    play(
      main.current,
      grew
        ? [
            { transform: 'scale(1) rotate(0deg)' },
            { transform: 'scale(1.18) rotate(-10deg)' },
            { transform: 'scale(0.95) rotate(4deg)' },
            { transform: 'scale(1) rotate(0deg)' },
          ]
        : [{ transform: 'scale(1)' }, { transform: 'scale(0.86)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }],
      0.5,
    );
  }, [count, reduced]);

  return (
    <span className={clsx('glyph', `glyph--${type}`, `glyph--${size}`, count === 0 && 'is-ghost', alert && 'is-alert')} aria-hidden="true">
      <AnimatePresence initial={false}>
        {echoes.map(([x, y, s], i) => (
          <m.img
            key={i}
            className="glyph__echo"
            src={ART[type]}
            alt=""
            draggable={false}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: '0%', y: '0%', scale: 0.4 }}
            animate={{ opacity: 0.55 - i * 0.1, x: `${x * 100}%`, y: `${y * 100}%`, scale: s }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: '0%', y: '0%', scale: 0.3 }}
            transition={reduced ? { duration: 0 } : spring.jelly}
          />
        ))}
      </AnimatePresence>
      <span className="glyph__float">
        <img ref={main} className="glyph__art" src={ART[type]} alt="" draggable={false} decoding="async" />
      </span>
    </span>
  );
}
