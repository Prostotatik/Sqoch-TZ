import { forwardRef, useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { play, xKeys } from '@/motion/waapi';
import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import { ease, shakeKeyframes } from '@/motion/tokens';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  id: string;
  label: string;
  error?: string | null;
  /** One-click fix rendered inside the error message (guidelines §3.4, bold part). */
  errorAction?: ReactNode;
  hint?: ReactNode;
  suffix?: ReactNode;
  icon?: ReactNode;
  valid?: boolean;
  /** Changing value re-plays the shake while the field has an error (failed submit). */
  shakeKey?: number;
};

/** Text field (spec §4.4): label above, 16px input (no iOS zoom), error with icon + text. */
export const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { id, label, error, errorAction, hint, suffix, icon, valid, shakeKey, className, ...input },
  ref,
) {
  const scope = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const errId = `${id}-error`;
  const hintId = `${id}-hint`;
  const hasError = Boolean(error);
  const prevShake = useRef(shakeKey);

  useEffect(() => {
    if (shakeKey === prevShake.current) return;
    prevShake.current = shakeKey;
    if (hasError && !reduced && scope.current) {
      play(scope.current, xKeys(shakeKeyframes), 0.4);
    }
  }, [shakeKey, hasError, reduced]);

  const describedBy = [hasError ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={clsx('field', hasError && 'field--error', className)}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div ref={scope} className="field__control">
        <span className="field__glow" aria-hidden="true" />
        <input
          ref={ref}
          id={id}
          className="field__input"
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          {...input}
        />
        {suffix && <span className="field__suffix" aria-hidden="true">{suffix}</span>}
        {valid && !hasError ? (
          // INV-09: the check mark draws itself once the field is valid on blur
          <svg className="field__icon field__icon--ok" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <m.path
              d="M3 8.4 L6.4 11.6 L13 4.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.28, ease: ease.out }}
            />
          </svg>
        ) : (
          icon && <span className="field__icon" aria-hidden="true">{icon}</span>
        )}
      </div>
      <AnimatePresence initial={false}>
        {hasError && (
          <m.div
            key="err"
            className="field__error-wrap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <p id={errId} className="field__error">
              <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
              <span>
                {error}
                {errorAction && <> {errorAction}</>}
              </span>
            </p>
          </m.div>
        )}
      </AnimatePresence>
      {hint && !hasError && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
    </div>
  );
});
