import { useEffect, useRef, type ReactNode } from 'react';
import { m, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import type { LayoutMode } from '@/hooks/useMediaQuery';
import { ease } from '@/motion/tokens';
import { occluder, setOccluder } from '@/components/three/sceneState';

/**
 * Frame for 05/06: full screen on phones, centred modal (≤560px) over the hero on >=768
 * (spec §3.0). Background photo per screen; Esc triggers `onEscape` on overlays.
 */
export function FinalShell({
  layout,
  photo,
  tone,
  labelledBy,
  onEscape,
  children,
  decor,
}: {
  layout: LayoutMode;
  photo: string;
  tone: 'success' | 'soldout';
  labelledBy: string;
  onEscape(): void;
  children: ReactNode;
  decor?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const overlay = layout !== 'phone';
  const ref = useRef<HTMLDivElement>(null);

  // the shared canvas draws above the modal: keep the ring/crystals out of it (INV-00)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOccluder(el);
    return () => {
      if (occluder.el === el) setOccluder(null);
    };
  }, [layout]);

  useEffect(() => {
    if (!overlay) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onEscape();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, onEscape]);

  const Tag = overlay ? 'div' : 'main';
  return (
    <>
      {overlay && <m.div className="final-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden="true" />}
      <m.div
        ref={ref}
        data-lenis-prevent
        className={clsx('final', `final--${tone}`, `final--${layout}`)}
        role={overlay ? 'dialog' : undefined}
        aria-modal={overlay || undefined}
        aria-labelledby={labelledBy}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: reduced ? 0.15 : 0.6, ease: ease.outExpo }}
      >
        <div className="final__bg" aria-hidden="true">
          <picture>
            <source media="(max-width: 640px)" srcSet={`/assets/${photo}-mobile.webp`} />
            <img src={`/assets/${photo}-1280.webp`} alt="" decoding="async" />
          </picture>
        </div>
        {decor}
        <Tag className="final__content">{children}</Tag>
      </m.div>
    </>
  );
}
