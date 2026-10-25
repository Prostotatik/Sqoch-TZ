import NumberFlow from '@number-flow/react';
import { useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { formatPrice } from '@/domain';

const FORMAT = { useGrouping: 'always', maximumFractionDigits: 0 } as const;

/**
 * Animated money value "2 000 ₽" (INV-06): digits roll, tabular numbers, NBSP before ₽.
 * The visible text is aria-hidden; the static formatted value is read by screen readers.
 */
export function Price({ value, className, live }: { value: number; className?: string; live?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <span className={clsx('price tabular', className)} aria-live={live ? 'polite' : undefined} aria-atomic={live || undefined}>
      <span className="visually-hidden">{formatPrice(value)}</span>
      <NumberFlow
        aria-hidden="true"
        value={value}
        locales="ru-RU"
        format={FORMAT}
        suffix={' ₽'}
        animated={!reduced}
        willChange
      />
    </span>
  );
}

/** Small rolling integer (counters). */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <NumberFlow
      className={clsx('tabular', className)}
      value={value}
      locales="ru-RU"
      animated={!reduced}
      trend={(prev, next) => Math.sign(next - prev)}
    />
  );
}
