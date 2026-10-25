import { useEffect, useRef } from 'react';

const INTERACTIVE = 'button, a[href], [role="button"], label, summary, [data-cursor="cta"]';
const TEXT = 'input, textarea, select, [contenteditable="true"]';

/**
 * Desktop-only cursor companion (INV-16): a neon ring that trails the system cursor with a lag.
 * The system cursor is never hidden (caret in inputs stays native). Over controls the ring grows
 * to hug the target and dims (the magnetic button takes over); over text fields it disappears.
 * Mounted only for fine pointers without reduced motion. Transform-only, one rAF loop.
 */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ring.current;
    if (!el) return;
    let x = -100;
    let y = -100;
    let tx = -100;
    let ty = -100;
    let size = 28;
    let tsize = 28;
    let opacity = 0;
    let topacity = 0;
    let frame = 0;
    let idle = 0;
    let last = performance.now();

    const loop = (now: number) => {
      // frame-rate independent lag (same feel at 60 and 120 Hz)
      const f = Math.min(3, (now - last) / 16.7);
      last = now;
      const k = 1 - Math.pow(0.8, f);
      x += (tx - x) * k;
      y += (ty - y) * k;
      size += (tsize - size) * k;
      opacity += (topacity - opacity) * k;
      // transform only: a 28px ring scaled with a non-scaling stroke
      el.style.transform = `translate3d(${x - 14}px, ${y - 14}px, 0) scale(${(size / 28).toFixed(3)})`;
      el.style.opacity = opacity.toFixed(3);
      const settled = Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1 && Math.abs(tsize - size) < 0.1 && Math.abs(topacity - opacity) < 0.01;
      idle = settled ? idle + 1 : 0;
      frame = idle > 2 ? 0 : requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX;
      ty = e.clientY;
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest(TEXT)) {
        topacity = 0;
      } else {
        const hit = t?.closest<HTMLElement>(INTERACTIVE);
        if (hit) {
          const r = hit.getBoundingClientRect();
          tsize = Math.min(Math.max(r.height, 36) + 14, 84);
          topacity = 0.45;
        } else {
          tsize = 28;
          topacity = 0.9;
        }
      }
      wake();
    };
    const onLeave = () => {
      topacity = 0;
      wake();
    };
    const onDown = () => {
      tsize *= 0.8;
      wake();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div ref={ring} className="cursor-ring" aria-hidden="true">
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="12.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
