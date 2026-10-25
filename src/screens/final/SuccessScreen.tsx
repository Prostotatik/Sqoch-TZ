import { useCallback, useEffect, useRef, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { CalendarPlus } from 'lucide-react';
import { copy } from '@/copy/ru';
import type { IssuedTicket } from '@/data/mockApi';
import { downloadIcs } from '@/data/ics';
import { useFinePointer, useMediaQuery, type LayoutMode } from '@/hooks/useMediaQuery';
import { ease } from '@/motion/tokens';
import { useOrderStore } from '@/state/orderStore';
import { kickScene, sceneInput, useSceneReady } from '@/components/three/sceneState';
import { Button } from '@/components/ui/Button';
import { FinalShell } from './FinalShell';
import { Qr } from './Qr';
import { Shards } from './Shards';

function CheckRing() {
  const reduced = useReducedMotion();
  const draw = (delay: number, duration: number) =>
    reduced
      ? { initial: false as const }
      : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { delay, duration, ease: ease.outExpo } };
  return (
    <div className="check-ring" aria-hidden="true">
      <svg viewBox="0 0 96 96">
        <defs>
          <linearGradient id="check-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#6257f6" />
            <stop offset="1" stopColor="#9b93ff" />
          </linearGradient>
        </defs>
        <circle cx="48" cy="48" r="44" fill="#040f35" />
        <m.circle
          cx="48"
          cy="48"
          r="44"
          fill="none"
          stroke="url(#check-grad)"
          strokeWidth="3"
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
          {...draw(0.1, 0.6)}
        />
        <m.path
          d="M30 49.5 L42.5 62 L66 36"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...draw(0.6, 0.35)}
        />
      </svg>
    </div>
  );
}

type TiltMode = 'pointer' | 'device' | 'off';

/**
 * INV-11: the e-ticket tilts towards the cursor (±10°/±8°), a glare follows it and the holographic
 * foil shifts its colours with the angle; text and QR float at different depths (fake parallax —
 * clip-path flattens real 3D). Phones: device tilt when the gyroscope is on, otherwise a slow
 * idle sway. All through CSS variables in one rAF loop — no React re-renders.
 */
function useTicketTilt(ref: React.RefObject<HTMLElement | null>, mode: TiltMode) {
  useEffect(() => {
    const el = ref.current;
    if (!el || mode === 'off') return;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let gx = 50;
    let gy = 0;
    let frame = 0;
    let running = false;
    const t0 = performance.now();
    const write = () => {
      el.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
      el.style.setProperty('--px', x.toFixed(3));
      el.style.setProperty('--py', y.toFixed(3));
      el.style.setProperty('--mx', `${gx.toFixed(1)}%`);
      el.style.setProperty('--my', `${gy.toFixed(1)}%`);
    };
    const loop = () => {
      if (mode === 'device') {
        if (sceneInput.tilt.active) {
          tx = sceneInput.tilt.x;
          ty = sceneInput.tilt.y;
        } else {
          const t = (performance.now() - t0) / 1000;
          tx = Math.sin(t * 0.7) * 0.22;
          ty = Math.cos(t * 0.5) * 0.18;
        }
        gx = 50 + tx * 40;
        gy = 30 + ty * 40;
      }
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      write();
      if (mode === 'device' || Math.abs(tx - x) > 0.001 || Math.abs(ty - y) > 0.001) frame = requestAnimationFrame(loop);
      else running = false;
    };
    const kick = () => {
      if (!running) {
        running = true;
        frame = requestAnimationFrame(loop);
      }
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      tx = (px - 0.5) * 2;
      ty = (py - 0.5) * 2;
      gx = px * 100;
      gy = py * 100;
      kick();
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      kick();
    };
    if (mode === 'pointer') {
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
    } else kick();
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [ref, mode]);
}

/** One e-ticket: scan-line materialisation (INV-13), QR printed module by module, tilt + foil (INV-11). */
function TicketStub({ t, index, live }: { t: IssuedTicket; index: number; live: boolean }) {
  const ref = useRef<HTMLLIElement>(null);
  const fine = useFinePointer();
  const coarse = useMediaQuery('(pointer: coarse)');
  const reduced = useReducedMotion() ?? false;
  useTicketTilt(ref, reduced ? 'off' : fine ? 'pointer' : coarse ? 'device' : 'off');
  // with the 3D layer the first ticket materialises right after the crystals outline it
  const delay = (live ? 0.72 : 0.5) + index * 0.1;
  const reveal = { delay, duration: 0.7, ease: ease.outExpo };

  return (
    <m.li
      ref={ref}
      className="stub"
      initial={reduced ? { opacity: 0 } : { opacity: 0, clipPath: 'inset(100% 0% 0% 0%)' }}
      animate={{ opacity: 1, clipPath: 'inset(0% 0% 0% 0%)' }}
      transition={reduced ? { duration: 0.2 } : { ...reveal, opacity: { delay, duration: 0.15 } }}
    >
      <div className="stub__card">
        <span className="stub__foil" aria-hidden="true" />
        {!reduced && (
          <m.span
            className="stub__scan"
            aria-hidden="true"
            initial={{ y: '100%', opacity: 1 }}
            animate={{ y: '0%', opacity: [1, 1, 0] }}
            transition={{ y: reveal, opacity: { delay, duration: 1.1, times: [0, 0.6, 1] } }}
          />
        )}
        <div className="stub__main">
          <p className="stub__brand" lang="en">
            Neon Waves
          </p>
          <p className="stub__dates">{copy.dates}</p>
          {/* DES-11: name on its own line, "type · age" never wraps around the dot */}
          <p className="stub__holder">
            <span className="stub__name">{t.holder}</span>
            <span className="stub__meta">{copy.success.ticketMeta(t.type, t.age)}</span>
          </p>
          <p className="stub__code tabular">{t.code}</p>
        </div>
        <div className="stub__qr">
          <Qr value={`NEONWAVES:${t.code}`} label={copy.success.qrAlt(t.holder)} size={76} draw={!reduced} delay={Math.round((delay + 0.3) * 1000)} />
        </div>
      </div>
    </m.li>
  );
}

/**
 * INV-18: the sign-off writes itself left to right (soft ink mask + a glowing nib), once the
 * handwritten face is loaded — so the reveal never shows the fallback font.
 */
function HandScript({ text, delay }: { text: string; delay: number }) {
  const reduced = useReducedMotion();
  const [state, setState] = useState<'wait' | 'write' | 'static'>(reduced ? 'static' : 'wait');
  useEffect(() => {
    if (reduced) return;
    let done = false;
    const go = () => {
      if (!done) {
        done = true;
        setState('write');
      }
    };
    const timer = window.setTimeout(go, 1400);
    void import('@fontsource/bad-script/400.css')
      .then(() => document.fonts?.load('400 1em "Bad Script"', text))
      .catch(() => undefined)
      .then(go);
    return () => window.clearTimeout(timer);
  }, [reduced, text]);
  return (
    <p className={`final__script hand hand--${state}`} style={{ ['--hand-delay' as string]: `${delay}s` }}>
      {text}
    </p>
  );
}

/** 05 · success: check, order number, e-tickets with QR, calendar export, handwritten sign-off. */
export function SuccessScreen({ layout }: { layout: LayoutMode }) {
  const confirmation = useOrderStore((s) => s.confirmation);
  const reset = useOrderStore((s) => s.reset);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotion();
  const live = useSceneReady();

  useEffect(() => {
    const f = requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(f);
  }, []);

  // INV-13: crystals fly out of the confirm flash, outline the first ticket, then burst as confetti
  useEffect(() => {
    if (reduced || !live) return;
    const el = listRef.current?.querySelector<HTMLElement>('.stub__card') ?? null;
    if (!el) return;
    sceneInput.fxTarget = el;
    sceneInput.fxAt = performance.now();
    kickScene(3600);
    return () => {
      if (sceneInput.fxTarget === el) sceneInput.fxTarget = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goHome = useCallback(() => reset('landing'), [reset]);
  if (!confirmation) return null;
  const rise = (delay: number) =>
    reduced
      ? {}
      : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.5, ease: ease.outExpo } };

  return (
    <FinalShell
      layout={layout}
      photo="success-confetti"
      tone="success"
      labelledBy="final-title"
      onEscape={goHome}
      decor={live ? undefined : <Shards count={layout === 'phone' ? 18 : 28} />}
    >
      <CheckRing />
      <m.h1 className="final__title" id="final-title" tabIndex={-1} ref={titleRef} {...rise(0.45)}>
        {copy.success.title}
      </m.h1>
      <m.p className="final__text" {...rise(0.55)}>
        {copy.success.text(confirmation.email)}
      </m.p>
      <m.p className="final__order tabular" {...rise(0.6)}>
        {copy.success.order(confirmation.orderId)}
      </m.p>

      <h2 className="visually-hidden">{copy.success.ticketsHeading}</h2>
      <ul className="stubs" ref={listRef}>
        {confirmation.tickets.map((t, i) => (
          <TicketStub key={t.code} t={t} index={i} live={live && !reduced} />
        ))}
      </ul>
      <m.div {...rise(1.1)}>
        <button type="button" className="link-btn" onClick={() => downloadIcs(confirmation)}>
          <CalendarPlus size={18} strokeWidth={1.6} aria-hidden="true" />
          {copy.success.calendar}
        </button>
      </m.div>

      <HandScript text={copy.success.script} delay={1.2} />

      <div className="final__actions">
        <Button variant="outline" onClick={goHome}>
          {copy.success.home}
        </Button>
        <button type="button" className="link-btn link-btn--underline" onClick={() => reset('tickets')}>
          {copy.success.again}
        </button>
      </div>
    </FinalShell>
  );
}
