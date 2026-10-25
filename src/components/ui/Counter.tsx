import { Minus, Plus } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useRef, useState } from 'react';
import { play, xKeys } from '@/motion/waapi';
import { RollingNumber } from './Price';

interface Props {
  value: number;
  canInc: boolean;
  canDec: boolean;
  onInc(): void;
  onDec(): void;
  groupLabel: string;
  incLabel: string;
  decLabel: string;
  /** Spoken value, e.g. "Полный: 2". */
  valueLabel: string;
  /** Explains a disabled "+" (limit reached); shown on a blocked press. */
  incBlockedHint?: string;
  onBlockedInc?(): void;
}

/**
 * −/+ stepper (spec §4.3, INV-05). The blocked "+" stays focusable (aria-disabled)
 * so a press can wiggle the control and explain the limit instead of doing nothing.
 */
export function Counter(p: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [ping, setPing] = useState(0);
  const [blocked, setBlocked] = useState(0);

  const inc = () => {
    if (!p.canInc) {
      // INV-05: "can't" — a wiggle; with reduced motion a 600 ms red outline instead
      if (!reduced) play(scope.current, xKeys([0, -5, 5, -3, 3, 0]), 0.3);
      else {
        setBlocked((n) => n + 1);
        window.setTimeout(() => setBlocked(0), 600);
      }
      p.onBlockedInc?.();
      return;
    }
    setPing((n) => n + 1);
    p.onInc();
  };

  return (
    <div ref={scope} className={blocked ? 'counter is-blocked' : 'counter'} role="group" aria-label={p.groupLabel}>
      <button type="button" className="counter__btn" onClick={p.onDec} disabled={!p.canDec} aria-label={p.decLabel}>
        <Minus size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <span className="counter__value" aria-live="polite" aria-atomic="true">
        <span className="visually-hidden">{p.valueLabel}</span>
        <span aria-hidden="true">
          <RollingNumber value={p.value} />
        </span>
      </span>
      <button
        type="button"
        className="counter__btn counter__btn--plus"
        onClick={inc}
        aria-disabled={!p.canInc || undefined}
        aria-label={p.canInc ? p.incLabel : `${p.incLabel}. ${p.incBlockedHint ?? ''}`}
      >
        <Plus size={14} strokeWidth={2} aria-hidden="true" />
        {ping > 0 && !reduced && <m.span key={ping} className="counter__ping" initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: 0.36 }} />}
      </button>
    </div>
  );
}
