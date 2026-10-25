/**
 * The single persistent WebGL canvas (INV-00). r3f owns the renderer, resize and the loop;
 * the frame itself is rendered by NeonPipeline (priority-1 useFrame → r3f stops auto-rendering).
 * Lazy chunk: three + r3f never compete with the hero LCP.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { NeonPipeline } from './pipeline';
import { adaptiveQuality, onKick, sceneInput } from './sceneState';

interface Props {
  paused: boolean;
  reduced: boolean;
  tier: 'A' | 'B';
  onReady(): void;
  /** Sustained low FPS: ask the layer to drop a tier (A → B; never below — the hero keeps its 3D). */
  onSlow(): void;
  /** The browser dropped the WebGL context (GPU reset, too many contexts): the layer remounts the canvas. */
  onLost(): void;
}

function Host({ reduced, tier, onReady, onSlow, onLost }: Omit<Props, 'paused'>) {
  const pipeline = useMemo(() => new NeonPipeline({ tier, reduced }), [tier, reduced]);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const ready = useRef(false);
  const perf = useRef({ t: 0, frames: 0, warm: 0, slowWindows: 0 });
  const adaptive = useMemo(() => adaptiveQuality(), []);

  useEffect(() => () => pipeline.dispose(), [pipeline]);
  // INN-01: compile all programs while the hero idles, not when the flow / success opens
  useEffect(() => {
    void pipeline.prewarm(gl, camera as PerspectiveCamera);
  }, [pipeline, gl, camera]);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onLost]);
  useEffect(() => {
    onKick(() => invalidate());
    return () => onKick(null);
  }, [invalidate]);

  useFrame((state, delta) => {
    pipeline.frame(state.gl, state.camera as PerspectiveCamera, state.size, delta);
    if (!ready.current) {
      ready.current = true;
      onReady();
    }
    // on-demand canvas (reduced motion): keep drawing while something asked for frames
    if (reduced && performance.now() < sceneInput.kickUntil) state.invalidate();

    // tiny PerformanceMonitor: two consecutive 2-second windows under the threshold → downgrade once
    if (!adaptive || reduced || tier === 'B' || delta > 0.25 || document.hidden) return;
    const p = perf.current;
    p.warm += delta;
    if (p.warm < 3) return;
    p.t += delta;
    p.frames += 1;
    if (p.t >= 2) {
      const fps = p.frames / p.t;
      p.slowWindows = fps < (tier === 'A' ? 40 : 24) ? p.slowWindows + 1 : 0;
      p.t = 0;
      p.frames = 0;
      if (p.slowWindows >= 2) {
        p.slowWindows = 0;
        p.warm = 0;
        onSlow();
      }
    }
  }, 1);

  return null;
}

export default function Scene({ paused, reduced, tier, onReady, onSlow, onLost }: Props) {
  return (
    <Canvas
      className="scene-canvas"
      // the scene is drawn into an MSAA target and composited by a quad — the default framebuffer needs
      // no antialiasing, and DPR 1.5 is visually identical for soft neon at a fraction of the fill cost
      dpr={tier === 'A' ? [1, 1.5] : [1, 1.25]}
      flat
      linear
      gl={{ antialias: false, alpha: true, premultipliedAlpha: true, stencil: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 6], fov: 45, near: 0.1, far: 40 }}
      frameloop={paused ? 'never' : reduced ? 'demand' : 'always'}
      style={{ pointerEvents: 'none' }}
    >
      <Host reduced={reduced} tier={tier} onReady={onReady} onSlow={onSlow} onLost={onLost} />
    </Canvas>
  );
}
