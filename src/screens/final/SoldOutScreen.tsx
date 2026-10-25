import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Bell, Check } from 'lucide-react';
import { copy, seatAdviceText } from '@/copy/ru';
import { normalizeEmail, seatAdvice } from '@/domain';
import type { LayoutMode } from '@/hooks/useMediaQuery';
import { ease } from '@/motion/tokens';
import { useOrderStore } from '@/state/orderStore';
import { Button } from '@/components/ui/Button';
import { FinalShell } from './FinalShell';

/**
 * INV-14: the torn neon ticket from the reference (3D render). It drops in, strains twice
 * (the tear "snaps" in sync with the ring flicker of the scene), then hangs and slowly sways.
 * Reduced motion: shown at rest.
 */
function TornTicket() {
  const reduced = useReducedMotion();
  return (
    <div className="torn" aria-hidden="true">
      <m.img
        className="torn__art"
        src="/assets/3d/ticket-sold-out.webp"
        alt=""
        draggable={false}
        initial={reduced ? false : { opacity: 0, scale: 0.7, rotate: 14, y: -24, filter: 'blur(8px)' }}
        animate={
          reduced
            ? { opacity: 1 }
            : {
                opacity: 1,
                scale: [0.7, 1.06, 1, 1.02, 1],
                rotate: [14, -4, 3, -6, -3],
                y: [-24, 4, 0, 2, 0],
                x: [0, 0, -3, 4, 0],
                filter: ['blur(8px)', 'blur(0px)', 'blur(0px)', 'blur(0px)', 'blur(0px)'],
              }
        }
        transition={{ duration: 1.1, times: [0, 0.35, 0.5, 0.62, 1], ease: ease.outExpo }}
      />
    </div>
  );
}

/** 06 · sold out (all seats gone) or partial (fewer seats than in the order). */
export function SoldOutScreen({ layout }: { layout: LayoutMode }) {
  const soldOut = useOrderStore((s) => s.soldOut);
  const email = useOrderStore((s) => s.email);
  const goTo = useOrderStore((s) => s.goTo);
  const participants = useOrderStore((s) => s.participants);
  const reduceOrder = useOrderStore((s) => s.reduceOrder);
  const keepOnly = useOrderStore((s) => s.keepOnly);
  const [notified, setNotified] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();
  const partial = soldOut?.reason === 'NOT_ENOUGH_SEATS' && soldOut.available > 0;

  useEffect(() => {
    const f = requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(f);
  }, []);

  const goHome = useCallback(() => goTo('landing'), [goTo]);
  if (!soldOut) return null;
  // SLOP-10: the advice is built from the valid reductions only (never "a child without an adult")
  const advice = partial ? seatAdvice(participants, soldOut.available) : null;

  return (
    <FinalShell layout={layout} photo="soldout-blue-crowd" tone="soldout" labelledBy="final-title" onEscape={goHome}>
      <TornTicket />
      <h1 className="final__title final__title--flicker" id="final-title" tabIndex={-1} ref={titleRef}>
        {partial ? copy.soldout.partialTitle : copy.soldout.title}
      </h1>
      <p className="final__text final__text--violet">
        {advice ? seatAdviceText(advice, soldOut.requested) : copy.soldout.text}
      </p>

      <div className="final__actions">
        {advice ? (
          <>
            {advice.only ? (
              <Button variant="primary" arrow magnetic onClick={() => keepOnly(advice.only!.map((p) => p.id))}>
                {copy.people.keep(advice.only)}
              </Button>
            ) : (
              <Button variant="primary" arrow magnetic onClick={reduceOrder}>
                {copy.soldout.partialFix}
              </Button>
            )}
            <button type="button" className="link-btn link-btn--underline" onClick={goHome}>
              {copy.soldout.home}
            </button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={goHome}>
              {copy.soldout.home}
            </Button>
            <AnimatePresence mode="wait" initial={false}>
              {notified ? (
                <m.p
                  key="done"
                  className="notify-done"
                  role="status"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: ease.outExpo }}
                >
                  <Check size={16} strokeWidth={2} aria-hidden="true" />
                  {copy.soldout.notified(normalizeEmail(email))}
                </m.p>
              ) : (
                <m.button key="ask" type="button" className="link-btn" onClick={() => setNotified(true)} exit={{ opacity: 0 }}>
                  <Bell size={16} strokeWidth={1.75} aria-hidden="true" />
                  {copy.soldout.notify}
                </m.button>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </FinalShell>
  );
}
