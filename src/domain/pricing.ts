import { FULL_TICKET_MIN_AGE, MAX_AGE, MIN_AGE } from './rules';
import { NBSP } from './typography';
import type { OrderSummary, Participant, TicketPlan, TicketType } from './types';

export const TICKET_PRICES: Readonly<Record<TicketType, number>> = {
  full: 2000,
  child: 1000,
};

export const TICKET_LABELS: Readonly<Record<TicketType, { title: string; hint: string; short: string }>> = {
  full: { title: 'Полный', hint: `от${NBSP}14${NBSP}лет`, short: 'полный' },
  child: { title: 'Детский', hint: `младше${NBSP}14${NBSP}лет`, short: 'детский' },
};

export const TICKET_TYPES: readonly TicketType[] = ['full', 'child'];

export function ticketTypeForAge(age: number): TicketType {
  return age >= FULL_TICKET_MIN_AGE ? 'full' : 'child';
}

export function hasValidAge(p: Participant): p is Participant & { age: number } {
  return p.age !== null && Number.isInteger(p.age) && p.age >= MIN_AGE && p.age <= MAX_AGE;
}

/** Ticket type that is charged: the one chosen for the participant (defaults to full). */
export function effectiveTicketType(p: Participant): TicketType {
  return p.ticketType ?? 'full';
}

/**
 * Age contradicts the chosen ticket type (full under 14, child from 14).
 * Returned code doubles as a FieldError for the age field; the UI offers "switch type".
 */
export function ticketTypeMismatch(p: Participant): 'age_full_too_young' | 'age_child_too_old' | null {
  if (!hasValidAge(p)) return null;
  const expected = ticketTypeForAge(p.age);
  const actual = effectiveTicketType(p);
  if (expected === actual) return null;
  return actual === 'full' ? 'age_full_too_young' : 'age_child_too_old';
}

export function planFromParticipants(participants: readonly Participant[]): TicketPlan {
  const plan: TicketPlan = { full: 0, child: 0 };
  for (const p of participants) plan[effectiveTicketType(p)] += 1;
  return plan;
}

export function planQuantity(plan: TicketPlan): number {
  return plan.full + plan.child;
}

export function planTotal(plan: TicketPlan): number {
  return plan.full * TICKET_PRICES.full + plan.child * TICKET_PRICES.child;
}

export function summarizePlan(plan: TicketPlan): OrderSummary {
  const lines = TICKET_TYPES.map((type) => ({
    type,
    quantity: plan[type],
    unitPrice: TICKET_PRICES[type],
    subtotal: plan[type] * TICKET_PRICES[type],
  }));
  return { lines, quantity: planQuantity(plan), total: planTotal(plan) };
}

export function summarizeOrder(participants: readonly Participant[]): OrderSummary {
  return summarizePlan(planFromParticipants(participants));
}

export function calcTotal(participants: readonly Participant[]): number {
  return summarizeOrder(participants).total;
}

/** 2000 -> "2 000 ₽" with non-breaking spaces (thousands separator and before the sign). */
export function formatPrice(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '−' : '';
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${sign}${digits}${NBSP}₽`;
}

/** Russian plural: plural(2, ['билет', 'билета', 'билетов']) -> 'билета'. */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}
