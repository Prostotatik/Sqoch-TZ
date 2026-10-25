import { Fragment } from 'react';
import { m, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { copy } from '@/copy/ru';
import { PROGRESS_STEPS, type FlowStep } from '@/domain';
import { ease, spring } from '@/motion/tokens';

/**
 * 3-node stepper (spec §4.2, INV-08). Passed nodes are buttons that lead back.
 * Connectors fill left-to-right with the step transition; a neon halo (shared layout) travels
 * to the current node; a passed node draws its check mark.
 */
export function Stepper({ step, onGo, showLabels }: { step: FlowStep; onGo(step: FlowStep): void; showLabels?: boolean }) {
  const reduced = useReducedMotion();
  const current = Math.max(0, PROGRESS_STEPS.indexOf((step === 'processing' ? 'summary' : step) as (typeof PROGRESS_STEPS)[number]));
  return (
    <nav aria-label={copy.steps.aria} className={clsx('stepper', showLabels && 'stepper--labels')}>
      <ol className="stepper__list">
        {PROGRESS_STEPS.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo';
          const label = copy.steps.names[i];
          return (
            <Fragment key={s}>
              {i > 0 && (
                <li className="stepper__line" aria-hidden="true">
                  <m.span
                    className="stepper__fill"
                    initial={false}
                    animate={{ scaleX: i <= current ? 1 : 0 }}
                    transition={{ duration: reduced ? 0 : 0.42, ease: ease.outExpo }}
                  />
                </li>
              )}
              <li className={clsx('stepper__node', `is-${state}`)} aria-current={state === 'current' ? 'step' : undefined}>
                {state === 'done' ? (
                  <button type="button" className="stepper__dot-btn" onClick={() => onGo(s)}>
                    <span className="stepper__dot">
                      <svg className="stepper__check" viewBox="0 0 14 14" aria-hidden="true">
                        <m.path
                          d="M3.6 7.3 L6.1 9.7 L10.6 4.6"
                          initial={reduced ? false : { pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.26, delay: 0.12, ease: ease.out }}
                        />
                      </svg>
                    </span>
                    <span className="stepper__label">{label}</span>
                  </button>
                ) : (
                  <span className="stepper__dot-btn">
                    {state === 'current' && (
                      <m.span layoutId="stepper-active" className="stepper__halo" transition={reduced ? { duration: 0 } : spring.soft} aria-hidden="true" />
                    )}
                    <span className="stepper__dot" />
                    <span className="stepper__label">{label}</span>
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
