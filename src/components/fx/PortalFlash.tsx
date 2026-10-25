import { AnimatePresence, m } from 'motion/react';
import { dropFlash, useFlashes, type Flash } from '@/motion/fx';
import { ease } from '@/motion/tokens';

/**
 * Light that blooms from the button the user pressed (INV-03 / INV-12): result grows out of the
 * cause. `portal` — a soft glow while the scene warps; `success` — the confirm orb's light
 * opens up to the whole screen (clip-path circle) and fades, revealing the success screen.
 */
function FlashLayer({ f }: { f: Flash }) {
  const at = `${f.x}px ${f.y}px`;
  if (f.kind === 'portal') {
    return (
      <m.div
        className="flash flash--portal"
        style={{ ['--fx' as string]: `${f.x}px`, ['--fy' as string]: `${f.y}px` }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.85, 0], scale: [0.6, 1.4, 1.8] }}
        transition={{ duration: 0.75, ease: ease.out, times: [0, 0.3, 1] }}
        onAnimationComplete={() => dropFlash(f.id)}
      />
    );
  }
  return (
    <m.div
      className="flash flash--success"
      style={{ ['--fx' as string]: `${f.x}px`, ['--fy' as string]: `${f.y}px` }}
      initial={{ clipPath: `circle(0px at ${at})`, opacity: 1 }}
      animate={{ clipPath: `circle(150vmax at ${at})`, opacity: [1, 1, 0] }}
      transition={{
        clipPath: { duration: 0.6, ease: ease.inOut },
        opacity: { duration: 1.05, times: [0, 0.6, 1], ease: 'linear' },
      }}
      onAnimationComplete={() => dropFlash(f.id)}
    />
  );
}

export function PortalFlash() {
  const flashes = useFlashes();
  return (
    <div className="flashes" aria-hidden="true">
      <AnimatePresence>
        {flashes.map((f) => (
          <FlashLayer key={f.id} f={f} />
        ))}
      </AnimatePresence>
    </div>
  );
}
