/**
 * Shared, render-free channel between DOM and the WebGL scene (INV-00).
 * The scene reads these objects inside its frame loop — no React re-renders on pointer/scroll.
 *
 * Contents:
 *  - `sceneInput`: pointer / gyro / scroll / mode / one-shot effect triggers;
 *  - blob registry (INV-04): DOM boxes the scene draws metaball clusters into;
 *  - occluder (INV-00): the DOM panel/modal the background scene must not draw over;
 *  - quality tier detection and a tiny "scene ready" store for DOM fallbacks.
 */
import { useSyncExternalStore } from 'react';
import type { FlowStep, TicketType } from '@/domain';
import type { LayoutMode } from '@/hooks/useMediaQuery';

export type SceneMode = 'hero' | 'flow' | 'success' | 'soldout';
/** A — desktop (bloom, dense crystals); B — phones / weak CPUs; C — no 3D (poster + DOM fallbacks). */
export type Tier = 'A' | 'B' | 'C';

export function sceneModeFor(step: FlowStep): SceneMode {
  if (step === 'landing') return 'hero';
  if (step === 'success') return 'success';
  if (step === 'soldout') return 'soldout';
  return 'flow';
}

export const sceneInput = {
  /** Pointer in NDC (−1..1). On touch devices fed by the gyroscope instead. */
  pointer: { x: 0, y: 0 },
  /** Pointer in CSS px (for blob attraction); NaN when unknown. */
  pointerPx: { x: Number.NaN, y: Number.NaN },
  /** Device tilt, −1..1 (gyro, INV-01/11). */
  tilt: { x: 0, y: 0, active: false },
  /** Hero scroll progress 0..1 (0 = top of the page). */
  scroll: 0,
  /** performance.now() of the last scroll of any element — blobs track DOM at full rate while scrolling. */
  lastScroll: 0,
  mode: 'hero' as SceneMode,
  layout: 'panel' as LayoutMode,
  /** Brightness pulse (ticket count change), eased back to 0 by the scene. */
  pulse: 0,
  /** INV-03: performance.now() when the "through the portal" warp started (0 = none). */
  warpAt: 0,
  /** Where the last portal / confirm flash started, CSS px. */
  origin: { x: Number.NaN, y: Number.NaN, at: 0 },
  /** INV-13: success sequence — crystals assemble around `fxTarget`, then burst. */
  fxAt: 0,
  fxTarget: null as HTMLElement | null,
  /** INV-14: sold-out start time (crystals fall, ring flickers twice). */
  soldAt: 0,
  /** Bumps in reduced/demand mode to request a few frames. */
  kickUntil: 0,
};

// dev-only handle for frame-by-frame inspection of effects (agents-developer/probe scripts)
if (import.meta.env.DEV && typeof window !== 'undefined') (window as Window & { __scene?: typeof sceneInput }).__scene = sceneInput;

/** Request rendering for `ms` (used when the canvas runs on demand). */
export function kickScene(ms = 450) {
  sceneInput.kickUntil = Math.max(sceneInput.kickUntil, performance.now() + ms);
  kickListener?.();
}
let kickListener: (() => void) | null = null;
export function onKick(fn: (() => void) | null) {
  kickListener = fn;
}

let listening = false;
/** Starts global pointer/scroll listeners once (cheap, passive). */
export function bindSceneInput() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener(
    'pointermove',
    (e) => {
      sceneInput.pointerPx.x = e.clientX;
      sceneInput.pointerPx.y = e.clientY;
      if (e.pointerType === 'touch' && sceneInput.tilt.active) return;
      sceneInput.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      sceneInput.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true },
  );
  window.addEventListener(
    'scroll',
    () => {
      sceneInput.scroll = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
    },
    { passive: true },
  );
  // any scroll container (the flow panel body) — capture phase
  document.addEventListener(
    'scroll',
    () => {
      sceneInput.lastScroll = performance.now();
      kickScene(200);
    },
    { passive: true, capture: true },
  );
  window.addEventListener('resize', () => kickScene(300), { passive: true });
}

/* ---------- gyroscope (INV-01 / INV-11) ---------- */

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/** iOS / iPadOS (iPad reports itself as a Mac with touch). */
function isAppleTouch(): boolean {
  const nav = navigator;
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
}

/**
 * Only iOS Safari really asks for motion-sensor access (from a tap). Recent Chromium also exposes
 * `DeviceOrientationEvent.requestPermission`, but resolves it without a prompt and fires events
 * anyway — there (Android, desktop mobile emulation) the gyro just starts. On iOS the scene stays
 * pointer-free: an unexplained system permission dialog on a ticket page costs more than the tilt.
 */
export function gyroNeedsPermission(): boolean {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return false;
  return typeof (DeviceOrientationEvent as OrientationCtor).requestPermission === 'function' && isAppleTouch();
}

let gyroBound = false;
export function startGyro() {
  if (gyroBound || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
  gyroBound = true;
  let base: { b: number; g: number } | null = null;
  window.addEventListener(
    'deviceorientation',
    (e) => {
      if (e.beta === null || e.gamma === null) return;
      if (!base) base = { b: e.beta, g: e.gamma };
      // slowly re-centre so holding the phone at any angle feels neutral
      base.b += (e.beta - base.b) * 0.01;
      base.g += (e.gamma - base.g) * 0.01;
      const clamp = (v: number) => Math.max(-1, Math.min(1, v / 15));
      sceneInput.tilt.x = clamp(e.gamma - base.g);
      sceneInput.tilt.y = clamp(e.beta - base.b);
      sceneInput.tilt.active = true;
      sceneInput.pointer.x = sceneInput.tilt.x;
      sceneInput.pointer.y = -sceneInput.tilt.y;
    },
    { passive: true },
  );
}

/* ---------- blob registry (INV-04) ---------- */

export interface BlobSlot {
  el: HTMLElement;
  type: TicketType;
  count: number;
  /** Child tickets without an adult — the cluster trembles (hint, not a block). */
  alert: boolean;
  /** Bumped on every count change — the scene plays the pop/merge springs. */
  version: number;
}

export const blobSlots = new Set<BlobSlot>();

export function registerBlob(slot: BlobSlot) {
  blobSlots.add(slot);
  kickScene(600);
  return () => {
    blobSlots.delete(slot);
    kickScene(200);
  };
}

/* ---------- occluder (INV-00) ---------- */

/** The panel / modal currently in front of the background scene (ring + crystals are clipped out of it). */
export const occluder: { el: HTMLElement | null } = { el: null };

export function setOccluder(el: HTMLElement | null) {
  occluder.el = el;
  kickScene(400);
}

/* ---------- quality tier ---------- */

export function detectTier(): Tier {
  if (typeof window === 'undefined') return 'C';
  const q = new URLSearchParams(window.location.search).get('tier');
  if (q === 'A' || q === 'B' || q === 'C') return q;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return 'C';
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return 'C';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return 'C';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    return 'C';
  }
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (coarse || (navigator.hardwareConcurrency ?? 8) <= 4) return 'B';
  return 'A';
}

/** `?perf=fixed` disables adaptive downgrades (screenshots in software GL). */
export function adaptiveQuality(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('perf') !== 'fixed';
}

/* ---------- "3D is live" flag for DOM fallbacks ---------- */

let ready = false;
const readyListeners = new Set<() => void>();
export function setSceneReady(v: boolean) {
  if (ready === v) return;
  ready = v;
  readyListeners.forEach((l) => l());
}
export function useSceneReady(): boolean {
  return useSyncExternalStore(
    (cb) => {
      readyListeners.add(cb);
      return () => readyListeners.delete(cb);
    },
    () => ready,
    () => false,
  );
}
