import { useEffect, useRef } from 'react';
import { useOrderStore } from '@/state/orderStore';

/**
 * Focus management on step change (INV-07, a11y): the step heading gets focus so screen
 * readers announce the new step; a pending `focusRequest` (e.g. "edit participant 2" from
 * the summary) wins and scrolls the field into view.
 */
export function useStepFocus<T extends HTMLElement = HTMLHeadingElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const { focusRequest, requestFocus } = useOrderStore.getState();
      const target = focusRequest ? document.getElementById(focusRequest) : null;
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        requestFocus(null);
      } else {
        ref.current?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return ref;
}

/** Moves focus to the first invalid control / alert of the current step and scrolls to it. */
export function focusFirstError(root: ParentNode = document) {
  requestAnimationFrame(() => {
    const el =
      root.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      root.querySelector<HTMLElement>('[data-error-focus]');
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}
