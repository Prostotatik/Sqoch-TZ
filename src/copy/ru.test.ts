import { describe, expect, it } from 'vitest';
import { copy, fieldError, N, seatAdviceText, TYPE_COND } from './ru';
import { ERROR_MESSAGES, HANGING_RE, NBSP, seatAdvice, typo, type Participant } from '@/domain';

const ivan: Participant = { id: 'a', name: 'Иван Петров', age: 35, ticketType: 'full' };
const masha: Participant = { id: 'b', name: 'Маша', age: 9, ticketType: 'child' };
const kolya: Participant = { id: 'c', name: 'Коля', age: 6, ticketType: 'child' };

/** Every string of the dictionary; functions are called with representative arguments. */
function collect(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') {
    const fn = value as (...a: unknown[]) => unknown;
    const samples: unknown[][] = [[1], [2], [5], ['full'], ['child'], ['Иван Петров', 16], ['ivan@example.com'], [[ivan]], [[ivan, masha]]];
    for (const args of samples) {
      try {
        const r = fn(...args);
        if (typeof r === 'string' && !r.includes('undefined') && !r.includes('NaN')) out.push(r);
      } catch {
        /* argument shape does not fit this function */
      }
    }
  } else if (Array.isArray(value)) value.forEach((v) => collect(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collect(v, out));
  return out;
}

const ALL = [
  ...collect(copy),
  ...collect(TYPE_COND),
  ...Object.values(ERROR_MESSAGES),
  ...(['name', 'age', 'email'] as const).map((f) => fieldError(f, 'required')),
  seatAdviceText(seatAdvice([ivan, masha], 1), 2),
  seatAdviceText(seatAdvice([ivan, masha, kolya], 2), 3),
];

describe('copy typography (SLOP-01)', () => {
  it('N and NBSP are the real U+00A0, not a space', () => {
    expect(N).toBe(' ');
    expect(NBSP).toBe(' ');
    expect(N.charCodeAt(0)).toBe(0xa0);
  });

  it('no short word hangs before a plain space', () => {
    const hanging = ALL.filter((s) => HANGING_RE.test(s));
    expect(hanging).toEqual([]);
  });

  it('a number never parts from its unit, a dash never starts a line', () => {
    const broken = ALL.filter((s) => /\d (лет|года?|мест[оа]?|участник\w*|билет\w*|дн[яей]|сцен\w*|пол[ея]\w*|буквы|символов|₽)/u.test(s) || / [—·]/.test(s));
    expect(broken).toEqual([]);
  });

  it('key strings are bound exactly as the review asked', () => {
    expect(copy.tickets.childRule).toContain(`со${N}взрослым от${N}18${N}лет`);
    expect(ERROR_MESSAGES.age_out_of_range).toBe(`Проверьте возраст: от${N}0${N}до${N}99`);
    expect(ERROR_MESSAGES.age_full_too_young).toBe(`Полный билет${N}— с${N}14${N}лет`);
    expect(copy.success.ticketMeta('full', 35)).toBe(`полный${N}· 35${N}лет`);
    expect(copy.steps.label(1)).toBe(`Шаг${N}1${N}из${N}3`);
  });

  it('typo is idempotent', () => {
    const once = typo('Ребёнок проходит только со взрослым от 18 лет — Unsplash · фото');
    expect(typo(once)).toBe(once);
  });
});
