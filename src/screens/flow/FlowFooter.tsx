import { forwardRef, useEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { LoaderCircle } from 'lucide-react';
import { copy } from '@/copy/ru';
import { formatPrice } from '@/domain';
import { emitFlash } from '@/motion/fx';
import { ease } from '@/motion/tokens';
import { useOrderStore, useOrderSummary, useOrderValidation } from '@/state/orderStore';
import { Button } from '@/components/ui/Button';
import { Price } from '@/components/ui/Price';
import { focusFirstError } from './useStepFocus';

/**
 * INV-06: the total rolls its digits (NumberFlow in <Price>) and the change itself is shown:
 * "+1 000 ₽" rises and fades, a light sweeps under the sum (violet up, dim down).
 * Decorative only — screen readers get the new total from the live region.
 */
function TotalDelta({ total }: { total: number }) {
  const prev = useRef(total);
  const [delta, setDelta] = useState<{ id: number; value: number } | null>(null);
  useEffect(() => {
    if (prev.current === total) return;
    const value = total - prev.current;
    prev.current = total;
    if (value !== 0) setDelta({ id: performance.now(), value });
  }, [total]);
  return (
    <AnimatePresence>
      {delta && (
        <m.span key={delta.id} className={clsx('total-delta', delta.value > 0 ? 'is-up' : 'is-down')} aria-hidden="true">
          <m.span
            className="total-delta__value tabular"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: [0, 1, 1, 0], y: [6, 0, -6, -16] }}
            transition={{ duration: 1.2, times: [0, 0.15, 0.6, 1], ease: 'easeOut' }}
            onAnimationComplete={() => setDelta((d) => (d?.id === delta.id ? null : d))}
          >
            {delta.value > 0 ? '+' : '−'}
            {formatPrice(Math.abs(delta.value))}
          </m.span>
          <m.span
            className="total-delta__sweep"
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: 1, opacity: 0 }}
            transition={{ duration: 0.7, ease: ease.outExpo }}
          />
        </m.span>
      )}
    </AnimatePresence>
  );
}

type ConfirmState = 'idle' | 'pending' | 'success' | 'soldout';

/**
 * INV-12: "Подтвердить заказ" folds into a glowing orb with a running neon arc while the order is
 * processed; then it either flashes and its light opens the success screen (INV-13), or the arc
 * turns red and tears before the sold-out screen. Reduced motion: spinner + text, then crossfade.
 * Double clicks are ignored while busy (aria-disabled keeps the focus on the control).
 */
function ConfirmButton({ onConfirm }: { onConfirm(): void }) {
  const phase = useOrderStore((s) => s.phase);
  const outcome = useOrderStore((s) => s.outcome);
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLButtonElement>(null);
  const busy = phase !== 'idle';
  const state: ConfirmState = phase === 'resolved' ? (outcome ?? 'pending') : busy ? 'pending' : 'idle';
  const orb = busy && !reduced;

  useEffect(() => {
    if (state === 'success') emitFlash('success', ref.current);
  }, [state]);

  return (
    <div className="confirm">
      <m.button
        ref={ref}
        type="button"
        layout={!reduced}
        className={clsx('btn btn--primary confirm__btn', orb && 'is-orb', `is-${state}`)}
        style={{ borderRadius: orb ? 28 : 16 }}
        transition={{ layout: { duration: 0.45, ease: ease.inOut } }}
        onClick={() => !busy && onConfirm()}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {orb ? (
            <m.span
              key="orb"
              className="confirm__orb"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, delay: 0.4 }}
            >
              <svg viewBox="0 0 56 56" className="confirm__arc" aria-hidden="true">
                <circle className="confirm__track" cx="28" cy="28" r="21" />
                <circle className="confirm__head" cx="28" cy="28" r="21" pathLength={100} />
              </svg>
              <span className="visually-hidden">{copy.review.confirming}</span>
            </m.span>
          ) : busy ? (
            <m.span key="busy" className="confirm__label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoaderCircle className="btn__spinner" size={20} aria-hidden="true" />
              {copy.review.confirming}
            </m.span>
          ) : (
            <m.span key="label" layout={!reduced} className="confirm__label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {copy.review.confirm}
            </m.span>
          )}
        </AnimatePresence>
      </m.button>
    </div>
  );
}

/**
 * Persistent action bar of steps 02–04 (spec §3.0): "Итого" row on every step — on 04 too, so the
 * sum is always visible right above "Подтвердить заказ" (DES-02) — + full-width primary button. Lives outside the step
 * AnimatePresence, so the total keeps rolling instead of re-mounting.
 */
export const FlowFooter = forwardRef<HTMLDivElement>(function FlowFooter(_, ref) {
  const step = useOrderStore((s) => s.step);
  const phase = useOrderStore((s) => s.phase);
  const showErrors = useOrderStore((s) => s.showErrors);
  const submitPlan = useOrderStore((s) => s.submitPlan);
  const submitParticipants = useOrderStore((s) => s.submitParticipants);
  const confirm = useOrderStore((s) => s.confirm);
  const summary = useOrderSummary();
  const validation = useOrderValidation();
  const reduced = useReducedMotion();

  const isSummary = step === 'summary' || step === 'processing';

  // SLOP-05: count only fields that are really marked; an order-level problem points at its banner
  let fieldErrors = 0;
  let orderErrors = 0;
  if (step === 'participants' && showErrors) {
    for (const e of Object.values(validation.participants)) fieldErrors += (e.name ? 1 : 0) + (e.age ? 1 : 0);
    if (validation.email) fieldErrors += 1;
    orderErrors = validation.order.length;
  }
  const errorText = fieldErrors > 0 ? copy.people.fieldsLeft(fieldErrors) : orderErrors > 0 ? copy.people.orderOnly : null;

  const onPrimary = () => {
    if (step === 'tickets') {
      if (!submitPlan()) focusFirstError();
    } else if (step === 'participants') {
      if (!submitParticipants()) focusFirstError();
    }
  };

  const label = step === 'tickets' ? copy.tickets.next : copy.people.next;
  const disabled = step === 'tickets' && summary.quantity === 0;

  return (
    <div ref={ref} className="flow__footer">
      <div className="total-row">
        <span className="total-row__label">
          {copy.tickets.total}
          {summary.quantity > 0 && <span className="total-row__count tabular">{' · '}{copy.tickets.count(summary.quantity)}</span>}
        </span>
        {summary.quantity > 0 ? (
          <span className="total-row__sum">
            <TotalDelta total={summary.total} />
            <Price value={summary.total} className="total-row__value" live />
          </span>
        ) : (
          <span className="total-row__empty">{copy.tickets.empty}</span>
        )}
      </div>
      <AnimatePresence initial={false}>
        {errorText && (
          <m.p
            key="errs"
            className="flow__footer-error"
            role="alert"
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {errorText}
          </m.p>
        )}
      </AnimatePresence>
      {isSummary && (
        <p className="visually-hidden" aria-live="polite">
          {phase === 'reserving' ? copy.review.phaseReserving : phase === 'confirming' ? copy.review.phaseConfirming : ''}
        </p>
      )}
      {isSummary ? (
        <ConfirmButton onConfirm={() => void confirm()} />
      ) : (
        <Button variant="primary" block arrow magnetic onClick={onPrimary} disabled={disabled}>
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={label}
              className="btn__morph"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {label}
            </m.span>
          </AnimatePresence>
        </Button>
      )}
    </div>
  );
});
