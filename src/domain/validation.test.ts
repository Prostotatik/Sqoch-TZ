import { describe, expect, it } from 'vitest';
import {
  errorMessage,
  isAdult,
  isChild,
  parseAge,
  validateAge,
  validateComposition,
  validateEmail,
  validateName,
  validateOrder,
  validatePlan,
} from './validation';
import type { Participant } from './types';

let n = 0;
// ticket type matches the age, as in a correctly filled order
const p = (name: string, age: number | null): Participant => ({
  id: `id${(n += 1)}`,
  name,
  age,
  ticketType: age !== null && age < 14 ? 'child' : 'full',
});

describe('validateName', () => {
  it('requires at least 2 meaningful characters', () => {
    expect(validateName('')).toBe('required');
    expect(validateName('   ')).toBe('required');
    expect(validateName('И')).toBe('name_too_short');
    expect(validateName(' И ')).toBe('name_too_short');
    expect(validateName('Ия')).toBeNull();
    expect(validateName('Иван Петров')).toBeNull();
    expect(validateName('Anna-Maria O’Neil')).toBeNull();
    expect(validateName('Jo')).toBeNull();
  });

  it('rejects names without letters or with digits/symbols', () => {
    expect(validateName('12')).toBe('name_invalid');
    expect(validateName('--')).toBe('name_invalid');
    expect(validateName('Иван2')).toBe('name_invalid');
    expect(validateName('<script>')).toBe('name_invalid');
  });

  it('limits length', () => {
    expect(validateName('а'.repeat(60))).toBeNull();
    expect(validateName('а'.repeat(61))).toBe('name_too_long');
  });
});

describe('parseAge / validateAge', () => {
  it('parses input', () => {
    expect(parseAge('')).toBeNull();
    expect(parseAge('  ')).toBeNull();
    expect(parseAge('22')).toBe(22);
    expect(parseAge(' 7 ')).toBe(7);
    expect(parseAge('12,5')).toBe(12.5);
    expect(Number.isNaN(parseAge('abc'))).toBe(true);
    expect(Number.isNaN(parseAge('1e2'))).toBe(true);
  });

  it('accepts integers 0..99', () => {
    expect(validateAge(null)).toBe('required');
    expect(validateAge(0)).toBeNull();
    expect(validateAge(99)).toBeNull();
    expect(validateAge(100)).toBe('age_out_of_range');
    expect(validateAge(-1)).toBe('age_out_of_range');
    expect(validateAge(12.5)).toBe('age_not_integer');
    expect(validateAge(Number.NaN)).toBe('age_not_integer');
    expect(validateAge(Number.POSITIVE_INFINITY)).toBe('age_not_integer');
  });
});

describe('validateEmail', () => {
  it.each(['ivan@example.com', 'a.b+tag@mail.ru', ' user@sub.domain.org ', 'иван@почта.рф', 'x_y@d-1.io'])(
    'accepts %s',
    (email) => expect(validateEmail(email)).toBeNull(),
  );

  it.each([
    'ivan',
    'ivan@',
    '@example.com',
    'ivan@example',
    'ivan@example.c',
    'iv an@example.com',
    'ivan@@example.com',
    'ivan@-example.com',
    '.ivan@example.com',
    'iv..an@example.com',
    'ivan@example..com',
  ])('rejects %s', (email) => expect(validateEmail(email)).toBe('email_invalid'));

  it('requires a value', () => {
    expect(validateEmail('')).toBe('required');
    expect(validateEmail('   ')).toBe('required');
  });
});

describe('composition rules', () => {
  it('adult is 18+, child is under 14', () => {
    expect(isAdult(p('A', 18))).toBe(true);
    expect(isAdult(p('A', 17))).toBe(false);
    expect(isAdult(p('A', null))).toBe(false);
    expect(isChild(p('A', 13))).toBe(true);
    expect(isChild(p('A', 14))).toBe(false);
    expect(isChild(p('A', null))).toBe(false);
  });

  it('allows 1..4 participants', () => {
    expect(validateComposition([])).toEqual(['too_few_participants']);
    expect(validateComposition([p('A', 30)])).toEqual([]);
    expect(validateComposition([p('A', 30), p('B', 30), p('C', 30), p('D', 30)])).toEqual([]);
    expect(validateComposition([p('A', 30), p('B', 30), p('C', 30), p('D', 30), p('E', 30)])).toEqual([
      'too_many_participants',
    ]);
  });

  it('child needs an 18+ participant in the same order', () => {
    expect(validateComposition([p('A', 10)])).toEqual(['child_without_adult']);
    expect(validateComposition([p('A', 10), p('B', 17)])).toEqual(['child_without_adult']);
    expect(validateComposition([p('A', 10), p('B', 18)])).toEqual([]);
    expect(validateComposition([p('A', 15), p('B', 16)])).toEqual([]); // teens without kids are fine
    expect(validateComposition([p('A', 0), p('B', 1), p('C', 2), p('D', 45)])).toEqual([]);
  });

  it('plan counters: 1..4 tickets and a full ticket when there are kids', () => {
    expect(validatePlan({ full: 0, child: 0 })).toEqual(['too_few_participants']);
    expect(validatePlan({ full: 1, child: 0 })).toEqual([]);
    expect(validatePlan({ full: 0, child: 2 })).toEqual(['child_without_adult']);
    expect(validatePlan({ full: 1, child: 3 })).toEqual([]);
    expect(validatePlan({ full: 3, child: 2 })).toEqual(['too_many_participants']);
  });
});

describe('validateOrder', () => {
  it('collects field and order errors', () => {
    const kid = p('Маша', 8);
    const teen = p('', 16);
    const res = validateOrder({ participants: [kid, teen], email: 'bad' });
    expect(res.valid).toBe(false);
    expect(res.participants).toEqual({ [teen.id]: { name: 'required' } });
    expect(res.email).toBe('email_invalid');
    expect(res.order).toEqual(['child_without_adult']);
  });

  it('passes a correct order', () => {
    const res = validateOrder({ participants: [p('Иван Петров', 35), p('Маша', 8)], email: 'ivan@example.com' });
    expect(res).toEqual({ valid: true, participants: {}, email: null, order: [] });
  });

  it('has human-readable messages', () => {
    expect(errorMessage('child_without_adult')).toMatch(/18/);
    expect(errorMessage('age_full_too_young')).toMatch(/14/);
    expect(errorMessage('too_many_participants')).toMatch(/4/);
  });
});
