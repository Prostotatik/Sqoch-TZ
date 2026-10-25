/**
 * Motion tokens shared by JS animations (CSS twins live in styles/tokens.css).
 * Source: design-spec §1.6 + innovator proposals §1.1.
 */
import type { Transition, Variants } from 'motion/react';

export const ease = {
  out: [0.22, 1, 0.36, 1],
  outExpo: [0.16, 1, 0.3, 1],
  inOut: [0.83, 0, 0.17, 1],
  in: [0.7, 0, 0.84, 0],
} as const;

export const dur = { micro: 0.12, control: 0.2, step: 0.42, exit: 0.26, long: 0.7 } as const;

export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 32, mass: 1 },
  soft: { type: 'spring', stiffness: 170, damping: 22 },
  jelly: { type: 'spring', stiffness: 300, damping: 11 },
} as const satisfies Record<string, Transition>;

/** Direction-aware step transition (INV-07). `custom` = direction (+1 forward, −1 back). */
export const stepVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 32, filter: 'blur(4px)' }),
  center: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: dur.step, ease: ease.outExpo },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir * -32,
    filter: 'blur(4px)',
    transition: { duration: dur.exit, ease: ease.in },
  }),
};

/** Reduced-motion twin: crossfade 150 ms (spec §1.6). */
export const stepVariantsReduced: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** Horizontal shake for invalid submit (INV-09). */
export const shakeKeyframes = [0, -8, 8, -6, 6, -3, 3, 0];
