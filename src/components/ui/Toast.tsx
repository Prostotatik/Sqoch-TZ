import type { ReactNode } from 'react';
import { m, useReducedMotion } from 'motion/react';

/** Toast above the action bar (spec §4.7). Only for undoable actions (guidelines §4). */
export function Toast({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className="toast"
      role="status"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
    >
      <span>{children}</span>
      {action}
    </m.div>
  );
}
