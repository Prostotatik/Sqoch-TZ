import type { ReactNode } from 'react';
import { m, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { CircleAlert, Info, ShieldCheck } from 'lucide-react';

type Tone = 'danger' | 'info' | 'warning' | 'rule';

const ICONS = { danger: CircleAlert, info: Info, warning: CircleAlert, rule: ShieldCheck } as const;

/** Inline banner (spec §4.7). Danger banners are announced (`role="alert"`). */
export function Banner({
  tone = 'info',
  children,
  actions,
  className,
  id,
  focusable,
}: {
  /** Makes the banner itself a focus target for "focus the first problem". */
  focusable?: boolean;
  tone?: Tone;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  id?: string;
}) {
  const Icon = ICONS[tone];
  const reduced = useReducedMotion();
  return (
    <m.div
      id={id}
      layout={!reduced}
      className={clsx('banner', `banner--${tone}`, className)}
      role={tone === 'danger' ? 'alert' : undefined}
      tabIndex={focusable ? -1 : undefined}
      data-error-focus={focusable || undefined}
      initial={reduced ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Icon className="banner__icon" size={16} strokeWidth={1.75} aria-hidden="true" />
      <div className="banner__body">
        <p className="banner__text">{children}</p>
        {actions && <div className="banner__actions">{actions}</div>}
      </div>
    </m.div>
  );
}
