import clsx from 'clsx';
import { copy } from '@/copy/ru';

/** Typographic logo lockup (asset #15). `compact` = the small lockup of step 02. */
export function Logo({ compact, meta = true, className, as: Tag = 'p' }: { compact?: boolean; meta?: boolean; className?: string; as?: 'p' | 'h1' | 'div' }) {
  return (
    <Tag className={clsx('logo', compact && 'logo--compact', className)}>
      <span className="logo__word" lang="en">
        <span>Neon</span> <span>Waves</span>
      </span>
      {meta && (
        <span className="logo__meta">
          <span className="logo__dates">{copy.dates}</span>
          {!compact && <span className="logo__venue">{copy.venue}</span>}
        </span>
      )}
    </Tag>
  );
}
