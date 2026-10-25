import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { useOrderStore } from '@/state/orderStore';
import { useLayoutMode } from '@/hooks/useMediaQuery';
import { bindSceneInput, detectTier, kickScene, sceneInput, sceneModeFor, setSceneReady, startGyro, gyroNeedsPermission, type Tier } from './sceneState';
import { RingPoster } from './RingPoster';

const Scene = lazy(() => import('./Scene'));

class SceneBoundary extends Component<{ onError(): void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Mount the 3D chunk only after the page has loaded (hero photo = LCP) and the main thread is idle. */
function useDeferredMount() {
  const [mount, setMount] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const go = () => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      const done = () => !cancelled && setMount(true);
      if (ric) ric(done, { timeout: 700 });
      else window.setTimeout(done, 300);
    };
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', go);
    };
  }, []);
  return mount;
}

/**
 * The single persistent WebGL layer (INV-00), fixed and pointer-events: none.
 *  - hero: under the hero text (z 1);
 *  - flow / success / sold-out: above the panel/modal; the pipeline cuts the DOM panel out of the
 *    background scene, so the ticket blobs (INV-04) can be drawn on the glass cards in the same context.
 * Tier C (no WebGL2, save-data, ≤2 GB RAM, repeated low FPS) → static SVG poster + DOM glyph fallbacks.
 * Rendering stops while the hero is scrolled away and on phone steps without 3D content.
 */
export function SceneLayer() {
  const step = useOrderStore((s) => s.step);
  const layout = useLayoutMode();
  const reduced = useReducedMotion() ?? false;
  const mount = useDeferredMount();
  const [tier, setTier] = useState<Tier>(() => (typeof window === 'undefined' ? 'C' : detectTier()));
  const [ready, setReady] = useState(false);
  const mode = sceneModeFor(step);

  useEffect(() => {
    bindSceneInput();
    // gyro where the browser allows it without a permission prompt (Android); iOS is skipped
    if (window.matchMedia('(pointer: coarse)').matches && !gyroNeedsPermission()) startGyro();
  }, []);

  const [heroVisible, setHeroVisible] = useState(true);
  useEffect(() => {
    const hero = document.querySelector('.hero');
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setHeroVisible(e.isIntersecting), { threshold: 0 });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    sceneInput.mode = mode;
    sceneInput.layout = layout;
    if (mode === 'soldout') sceneInput.soldAt = performance.now();
    kickScene(1200);
  }, [mode, layout]);

  const live = mount && tier !== 'C';
  useEffect(() => {
    setSceneReady(live && ready);
    return () => setSceneReady(false);
  }, [live, ready]);

  const onReady = useCallback(() => setReady(true), []);
  // FPS dips (tab switches, heavy transitions) used to walk A → B → C and the hero lost its 3D for good;
  // the monitor now only trades bloom/density for speed. C stays for devices detected as weak up front.
  const onSlow = useCallback(() => setTier((t) => (t === 'A' ? 'B' : t)), []);
  // a render error retries once with a fresh canvas before giving up to the poster
  const [canvasKey, setCanvasKey] = useState(0);
  const retried = useRef(false);
  const onError = useCallback(() => {
    setReady(false);
    if (retried.current) setTier('C');
    else {
      retried.current = true;
      setCanvasKey((k) => k + 1);
    }
  }, []);
  const onLost = useCallback(() => {
    setReady(false);
    setCanvasKey((k) => k + 1);
  }, []);

  // nothing to draw: hero scrolled away, or the phone participants step (no 3D objects on it)
  const paused = (mode === 'hero' && !heroVisible) || (layout === 'phone' && step === 'participants');

  return (
    <div
      className="scene-layer"
      data-mode={mode}
      data-front={(live && ready && mode !== 'hero') || undefined}
      data-hidden={paused || undefined}
      data-ready={(live && ready) || undefined}
      aria-hidden="true"
    >
      {!(live && ready) && <RingPoster />}
      {live && (
        <SceneBoundary key={canvasKey} onError={onError}>
          <Suspense fallback={null}>
            <Scene paused={paused} reduced={reduced} tier={tier === 'A' ? 'A' : 'B'} onReady={onReady} onSlow={onSlow} onLost={onLost} />
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  );
}
