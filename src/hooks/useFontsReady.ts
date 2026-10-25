import { useEffect, useState } from 'react';

/**
 * Resolves when the display face is loaded (or after `timeoutMs`), so the hero reveal
 * hides the font swap instead of showing a FOUT jump (guidelines §1).
 */
export function useFontsReady(timeoutMs = 1500): boolean {
  const [ready, setReady] = useState(() => {
    if (typeof document === 'undefined' || !document.fonts) return true;
    return document.fonts.check('800 1em "Unbounded Variable"');
  });

  useEffect(() => {
    if (ready) return;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    const timer = window.setTimeout(finish, timeoutMs);
    Promise.all([
      document.fonts.load('800 1em "Unbounded Variable"', 'MORE MUSIC NEON'),
      document.fonts.load('500 1em "Onest Variable"', 'Купить билеты'),
    ])
      .catch(() => undefined)
      .then(finish);
    return () => window.clearTimeout(timer);
  }, [ready, timeoutMs]);

  return ready;
}
