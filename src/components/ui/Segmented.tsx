import { m, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { spring } from '@/motion/tokens';

interface Option<T extends string> {
  value: T;
  label: string;
  /** Optional second line (e.g. the price), quieter than the label. */
  sub?: string;
}

/** Pill segmented control as a radio group (keyboard: arrows via native radios). */
export function Segmented<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  id,
}: {
  name: string;
  legend: string;
  value: T;
  options: Option<T>[];
  onChange(v: T): void;
  id?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <fieldset className="segmented" id={id}>
      <legend className="visually-hidden">{legend}</legend>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <label key={o.value} className={clsx('segmented__opt', active && 'is-active')}>
            <input type="radio" name={name} value={o.value} checked={active} onChange={() => onChange(o.value)} />
            {active && (
              <m.span
                layoutId={reduced ? undefined : `seg-${name}`}
                className={clsx('segmented__thumb', `segmented__thumb--${o.value}`)}
                transition={spring.snappy}
              />
            )}
            <span className="segmented__label">
              {o.label}
              {o.sub && <span className="segmented__sub tabular">{o.sub}</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
