import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { ChevronLeft, X } from 'lucide-react';
import { copy } from '@/copy/ru';
import { PROGRESS_STEPS, type FlowStep } from '@/domain';
import type { LayoutMode } from '@/hooks/useMediaQuery';
import { ease, stepVariants, stepVariantsReduced } from '@/motion/tokens';
import { useOrderStore } from '@/state/orderStore';
import { IconButton } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { Toast } from '@/components/ui/Toast';
import { TicketsStep } from './TicketsStep';
import { ParticipantsStep } from './ParticipantsStep';
import { SummaryStep } from './SummaryStep';
import { FlowFooter } from './FlowFooter';
import { occluder, sceneInput, setOccluder } from '@/components/three/sceneState';

const STEP_VIEW: Partial<Record<FlowStep, () => React.JSX.Element>> = {
  tickets: TicketsStep,
  participants: ParticipantsStep,
  summary: SummaryStep,
  processing: SummaryStep,
};

/**
 * Container motion per layout: panel — slides in from the right; sheet — bottom sheet;
 * phone — opens "through the portal" (INV-03): a circle grows from the pressed button.
 */
const containerMotion = (layout: LayoutMode, reduced: boolean) => {
  if (reduced) return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  if (layout === 'phone') {
    const o = sceneInput.origin;
    const recent = !Number.isNaN(o.x) && performance.now() - o.at < 1200;
    const at = recent ? `${Math.round(o.x)}px ${Math.round(o.y)}px` : '50% 85%';
    return {
      initial: { clipPath: `circle(0% at ${at})` },
      animate: { clipPath: `circle(150% at ${at})`, transitionEnd: { clipPath: 'none' } },
      exit: { opacity: 0 },
    };
  }
  if (layout === 'sheet') return { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };
  return { initial: { x: 'calc(100% + 32px)' }, animate: { x: 0 }, exit: { x: 'calc(100% + 32px)' } };
};

/**
 * Shell of steps 02–04: header (back · stepper · close), animated step body and a
 * persistent action bar that never re-mounts between steps (INV-06/07).
 */
export function FlowShell({ layout, onIntro }: { layout: LayoutMode; onIntro?(active: boolean): void }) {
  const step = useOrderStore((s) => s.step);
  const direction = useOrderStore((s) => s.direction);
  const back = useOrderStore((s) => s.back);
  const close = useOrderStore((s) => s.close);
  const goTo = useOrderStore((s) => s.goTo);
  const phase = useOrderStore((s) => s.phase);
  const lastRemoved = useOrderStore((s) => s.lastRemoved);
  const undoRemove = useOrderStore((s) => s.undoRemove);
  const dismissRemoved = useOrderStore((s) => s.dismissRemoved);
  const reduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const stepKey = step === 'processing' ? 'summary' : step;
  const View = STEP_VIEW[step] ?? TicketsStep;
  const busy = phase !== 'idle';
  const overlay = layout !== 'phone';
  const BodyTag = overlay ? 'div' : 'main';

  // the fixed action bar reserves its own height at the end of the content
  useLayoutEffect(() => {
    const footer = footerRef.current;
    const root = rootRef.current;
    if (!footer || !root) return;
    const ro = new ResizeObserver(() => root.style.setProperty('--bar-h', `${footer.offsetHeight}px`));
    ro.observe(footer);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (overlay) bodyRef.current?.scrollTo({ top: 0 });
    else window.scrollTo({ top: 0 });
  }, [stepKey, overlay]);

  // DES-07/08: panel/sheet body fades at the edges only where there is more to scroll
  useEffect(() => {
    const el = bodyRef.current;
    if (!overlay || !el) return;
    const update = () => {
      el.toggleAttribute('data-scrolled', el.scrollTop > 2);
      el.toggleAttribute('data-more', el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    };
    const ro = new ResizeObserver(update);
    const watch = () => {
      ro.disconnect();
      ro.observe(el);
      for (const c of Array.from(el.querySelectorAll(':scope > .flow__step'))) ro.observe(c);
      update();
    };
    const mo = new MutationObserver(watch);
    mo.observe(el, { childList: true });
    watch();
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [overlay]);

  useEffect(() => {
    if (!overlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, close]);

  useEffect(() => {
    if (!lastRemoved) return;
    const t = window.setTimeout(dismissRemoved, 5000);
    return () => window.clearTimeout(t);
  }, [lastRemoved, dismissRemoved]);

  // the canvas draws above the flow: cut the panel/sheet out of the background scene (INV-00)
  useEffect(() => {
    const el = rootRef.current;
    if (!overlay || !el) return;
    setOccluder(el);
    return () => {
      if (occluder.el === el) setOccluder(null);
    };
  }, [overlay]);

  const [cm] = useState(() => containerMotion(layout, reduced));
  // phone portal intro: the flow floats fixed over the still-visible hero until the circle has opened
  const [intro, setIntro] = useState(() => layout === 'phone' && !reduced);
  useLayoutEffect(() => {
    if (intro) onIntro?.(true);
    return () => onIntro?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const endIntro = () => {
    if (!intro) return;
    setIntro(false);
    onIntro?.(false);
  };

  return (
    <>
      {layout === 'sheet' && (
        <m.div
          className="flow-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          aria-hidden="true"
        />
      )}
      <m.div
        ref={rootRef}
        className={`flow flow--${layout}${intro ? ' flow--intro' : ''}`}
        role={overlay ? 'dialog' : undefined}
        aria-modal={overlay || undefined}
        aria-labelledby="step-title"
        data-lenis-prevent
        initial={cm.initial}
        animate={cm.animate}
        exit={cm.exit}
        onAnimationComplete={endIntro}
        transition={{ duration: reduced ? 0.15 : layout === 'phone' ? 0.7 : 0.6, ease: layout === 'phone' ? ease.inOut : ease.outExpo }}
      >
        <header className="flow__header">
          <IconButton label={copy.steps.back} onClick={back} disabled={busy}>
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          </IconButton>
          {layout === 'phone' ? (
            // SLOP-14: on a phone the progress is one line of text, not unlabeled dots + an overline
            <p className="flow__step-label tabular">{copy.steps.label(PROGRESS_STEPS.indexOf(stepKey as (typeof PROGRESS_STEPS)[number]) + 1)}</p>
          ) : (
            <Stepper step={step} onGo={busy ? () => undefined : goTo} showLabels />
          )}
          {overlay ? (
            <IconButton label={copy.steps.close} onClick={close} disabled={busy}>
              <X size={20} strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          ) : (
            <span className="flow__header-spacer" aria-hidden="true" />
          )}
        </header>

        <BodyTag className="flow__body" ref={bodyRef} id="main">
          <AnimatePresence mode="popLayout" custom={direction} initial={false}>
            <m.div
              key={stepKey}
              className="flow__step"
              custom={direction}
              variants={reduced ? stepVariantsReduced : stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <View />
            </m.div>
          </AnimatePresence>
        </BodyTag>

        <FlowFooter ref={footerRef} />

        <div className="flow__toasts">
          <AnimatePresence>
            {lastRemoved && step === 'participants' && (
              <Toast
                key={lastRemoved.participant.id}
                action={
                  <button type="button" className="toast__action" onClick={undoRemove}>
                    {copy.people.undo}
                  </button>
                }
              >
                {copy.people.removed(lastRemoved.number)}
              </Toast>
            )}
          </AnimatePresence>
        </div>
      </m.div>
    </>
  );
}
