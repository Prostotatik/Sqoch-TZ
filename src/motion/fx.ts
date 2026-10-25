/**
 * One-shot visual effects shared by DOM and the 3D scene:
 *  - portal (INV-03): "Купить билеты" → the scene warps, a soft flash blooms from the button;
 *  - confirm flash (INV-12): the confirm orb bursts and its light opens the success screen.
 * Origins are recorded in `sceneInput.origin` so the crystals of INV-13 start from the button.
 */
import { useSyncExternalStore } from 'react';
import { kickScene, sceneInput } from '@/components/three/sceneState';

export type FlashKind = 'portal' | 'success';
export interface Flash {
  id: number;
  kind: FlashKind;
  x: number;
  y: number;
}

let flashes: Flash[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useFlashes(): Flash[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => flashes,
    () => flashes,
  );
}

export function dropFlash(id: number) {
  flashes = flashes.filter((f) => f.id !== id);
  notify();
}

function centerOf(el: Element | null | undefined) {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function emitFlash(kind: FlashKind, from?: Element | null) {
  const { x, y } = centerOf(from);
  sceneInput.origin = { x, y, at: performance.now() };
  if (reducedMotion()) return;
  flashes = [...flashes, { id: nextId++, kind, x, y }];
  notify();
}

/** INV-03: start the purchase "through the portal". */
export function portalFrom(el: Element | null | undefined) {
  emitFlash('portal', el);
  if (!reducedMotion()) {
    sceneInput.warpAt = performance.now();
    kickScene(1000);
  }
}
