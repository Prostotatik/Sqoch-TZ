import { describe, expect, it } from 'vitest';
import {
  calcTotal,
  effectiveTicketType,
  formatPrice,
  ticketTypeMismatch,
  planFromParticipants,
  plural,
  summarizeOrder,
  summarizePlan,
  ticketTypeForAge,
  TICKET_PRICES,
} from './pricing';
import type { Participant } from './types';

// without an explicit type the ticket matches the age (what a valid order looks like)
const p = (age: number | null, ticketType?: Participant['ticketType']): Participant => ({
  id: Math.random().toString(36),
  name: 'Иван',
  age,
  ticketType: ticketType ?? (age !== null && age < 14 ? 'child' : 'full'),
});

describe('ticketTypeForAge', () => {
  it('14 and older -> full, younger -> child', () => {
    expect(ticketTypeForAge(0)).toBe('child');
    expect(ticketTypeForAge(13)).toBe('child');
    expect(ticketTypeForAge(14)).toBe('full');
    expect(ticketTypeForAge(18)).toBe('full');
    expect(ticketTypeForAge(120)).toBe('full');
  });
});

describe('prices', () => {
  it('match the brief', () => {
    expect(TICKET_PRICES).toEqual({ full: 2000, child: 1000 });
  });
});

describe('effectiveTicketType / ticketTypeMismatch', () => {
  it('charges the chosen type (default full)', () => {
    expect(effectiveTicketType(p(10, 'full'))).toBe('full');
    expect(effectiveTicketType(p(30, 'child'))).toBe('child');
    expect(effectiveTicketType({ id: 'x', name: '', age: null })).toBe('full');
  });

  it('flags age that contradicts the chosen type', () => {
    expect(ticketTypeMismatch(p(10, 'full'))).toBe('age_full_too_young');
    expect(ticketTypeMismatch(p(14, 'child'))).toBe('age_child_too_old');
    expect(ticketTypeMismatch(p(13, 'child'))).toBeNull();
    expect(ticketTypeMismatch(p(14, 'full'))).toBeNull();
    expect(ticketTypeMismatch(p(null, 'full'))).toBeNull();
    expect(ticketTypeMismatch(p(Number.NaN, 'child'))).toBeNull();
  });
});

describe('totals', () => {
  it('calculates total from ticket types', () => {
    expect(calcTotal([])).toBe(0);
    expect(calcTotal([p(30)])).toBe(2000);
    expect(calcTotal([p(30), p(13)])).toBe(3000);
    expect(calcTotal([p(40), p(38), p(10), p(5)])).toBe(6000);
    expect(calcTotal([p(14), p(14), p(14), p(14)])).toBe(8000);
  });

  it('builds order lines', () => {
    const s = summarizeOrder([p(40), p(10), p(8)]);
    expect(s.quantity).toBe(3);
    expect(s.total).toBe(4000);
    expect(s.lines).toEqual([
      { type: 'full', quantity: 1, unitPrice: 2000, subtotal: 2000 },
      { type: 'child', quantity: 2, unitPrice: 1000, subtotal: 2000 },
    ]);
    expect(summarizePlan({ full: 2, child: 1 }).total).toBe(5000);
    expect(planFromParticipants([p(null, 'child'), p(20)])).toEqual({ full: 1, child: 1 });
  });
});

describe('formatPrice', () => {
  it('uses non-breaking spaces', () => {
    expect(formatPrice(2000)).toBe('2 000 ₽');
    expect(formatPrice(1000)).toBe('1 000 ₽');
    expect(formatPrice(0)).toBe('0 ₽');
    expect(formatPrice(999)).toBe('999 ₽');
    expect(formatPrice(8000)).toBe('8 000 ₽');
    expect(formatPrice(1234567)).toBe('1 234 567 ₽');
    expect(formatPrice(-1000)).toBe('−1 000 ₽');
    expect(formatPrice(1999.6)).toBe('2 000 ₽');
  });

  it('never contains a regular space', () => {
    expect(formatPrice(12345)).not.toContain(' ');
  });
});

describe('plural', () => {
  const forms = ['билет', 'билета', 'билетов'] as const;
  it('follows Russian rules', () => {
    expect(plural(1, forms)).toBe('билет');
    expect(plural(2, forms)).toBe('билета');
    expect(plural(4, forms)).toBe('билета');
    expect(plural(5, forms)).toBe('билетов');
    expect(plural(11, forms)).toBe('билетов');
    expect(plural(21, forms)).toBe('билет');
    expect(plural(0, forms)).toBe('билетов');
  });
});
