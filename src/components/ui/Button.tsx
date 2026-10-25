import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { m } from 'motion/react';
import clsx from 'clsx';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useMagnetic } from '@/hooks/useMagnetic';

type Variant = 'primary' | 'outline' | 'ghost' | 'link';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'> & {
  variant?: Variant;
  /** Trailing arrow (primary CTA). */
  arrow?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  loadingText?: string;
  block?: boolean;
  /** Magnetic pull to the cursor (desktop only). */
  magnetic?: boolean;
};

/**
 * Buttons from spec §4.1. Disabled primary is a solid dark fill, not 50% opacity.
 * `aria-disabled` is used instead of `disabled` when the button must stay focusable
 * and explain why (pass `aria-disabled` + handle click yourself).
 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', arrow, icon, loading, loadingText, block, magnetic, className, children, disabled, ...rest },
  forwarded,
) {
  const mag = useMagnetic<HTMLSpanElement>(70, 0.3);
  const useMag = magnetic && mag.enabled;
  const content = (
    <>
      {loading ? (
        <>
          <LoaderCircle className="btn__spinner" size={20} aria-hidden="true" />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        <>
          {icon}
          <span className="btn__label">{children}</span>
          {arrow && <ArrowRight className="btn__arrow" size={18} strokeWidth={1.75} aria-hidden="true" />}
        </>
      )}
    </>
  );

  return (
    <m.span
      ref={mag.ref}
      className={clsx('btn-wrap', block && 'btn-wrap--block')}
      style={useMag ? { x: mag.x, y: mag.y } : undefined}
    >
      <button
        ref={forwarded}
        type="button"
        className={clsx('btn', `btn--${variant}`, block && 'btn--block', loading && 'is-loading', className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {content}
      </button>
    </m.span>
  );
});

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode; tone?: 'default' | 'danger' };

/** 40px visual, 44px hit area (spec §4.1). Always has an accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, className, tone = 'default', ...rest },
  ref,
) {
  return (
    <button ref={ref} type="button" aria-label={label} title={label} className={clsx('icon-btn', `icon-btn--${tone}`, className)} {...rest}>
      {children}
    </button>
  );
});
