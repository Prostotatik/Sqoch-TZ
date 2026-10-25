/**
 * One-shot feedback animations (shake, wiggle, bounce) through the native Web Animations API —
 * no JS animation engine in the main bundle for them. Callers skip these with reduced motion.
 */
export function play(el: Element | null | undefined, keyframes: Keyframe[], durationS: number) {
  el?.animate?.(keyframes, { duration: durationS * 1000, easing: 'ease-out' });
}

export const xKeys = (xs: readonly number[]): Keyframe[] => xs.map((x) => ({ transform: `translateX(${x}px)` }));
export const scaleKeys = (ss: readonly number[]): Keyframe[] => ss.map((s) => ({ transform: `scale(${s})` }));
