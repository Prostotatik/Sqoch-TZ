import type Lenis from 'lenis';

/**
 * "Back to the hero" scroll before the purchase starts from the bottom of the landing:
 * the portal transition only reads well from the hero (ring + button in view), so the page
 * first glides up and the flow opens from there. Uses Lenis on desktop (it owns the wheel),
 * a rAF tween elsewhere; instant under reduced motion.
 */
let lenis: Lenis | null = null;
export function setLenis(instance: Lenis | null) {
  lenis = instance;
}

const easeInOutQuart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

function reduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Resolves on the tail of the glide (≈85% of the time, the page is ~99% home by then with the
 * quartic ease), so the portal starts while the scroll is still settling — no dead beat between them.
 */
export function scrollToTop(): Promise<void> {
  const from = window.scrollY;
  if (from <= 0) return Promise.resolve();
  if (reduced()) {
    lenis?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    return Promise.resolve();
  }
  // long pages travel a bit longer, but never feel like waiting
  const duration = Math.min(1.25, 0.65 + from / 5000);
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration * 850);
    if (lenis) {
      lenis.scrollTo(0, { duration, easing: easeInOutQuart, force: true, lock: true, onComplete: () => resolve() });
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / (duration * 1000));
      window.scrollTo(0, Math.round(from * (1 - easeInOutQuart(t))));
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}
