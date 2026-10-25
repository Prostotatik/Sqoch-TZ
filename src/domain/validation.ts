import {
  ADULT_MIN_AGE,
  FULL_TICKET_MIN_AGE,
  MAX_AGE,
  MAX_PARTICIPANTS,
  MIN_AGE,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
} from './rules';
import { ticketTypeMismatch } from './pricing';
import { typoDeep } from './typography';
import type { OrderDraft, Participant, TicketPlan } from './types';

export type FieldError =
  | 'required'
  | 'name_too_short'
  | 'name_too_long'
  | 'name_invalid'
  | 'age_not_integer'
  | 'age_out_of_range'
  | 'age_full_too_young'
  | 'age_child_too_old'
  | 'email_invalid';

export type OrderError = 'too_few_participants' | 'too_many_participants' | 'child_without_adult';

/**
 * Generic texts (copy: agents-anti-AI-slop/guidelines.md §3.4), NBSP-bound by `typoDeep`. Field-specific wording
 * for `required` (name / age / email) lives in the UI copy dictionary (src/copy/ru.ts).
 */
export const ERROR_MESSAGES: Readonly<Record<FieldError | OrderError, string>> = typoDeep({
  required: 'Заполните поле',
  name_too_short: `Впишите имя полностью, хотя бы ${NAME_MIN_LENGTH} буквы`,
  name_too_long: `Слишком длинно, уложитесь в ${NAME_MAX_LENGTH} символов`,
  name_invalid: 'В имени могут быть только буквы, пробел, дефис и апостроф',
  age_not_integer: 'Укажите возраст целым числом',
  age_out_of_range: `Проверьте возраст: от ${MIN_AGE} до ${MAX_AGE}`,
  age_full_too_young: `Полный билет — с ${FULL_TICKET_MIN_AGE} лет`,
  age_child_too_old: `Детский билет — до ${FULL_TICKET_MIN_AGE - 1} лет включительно`,
  email_invalid: 'Похоже, в адресе опечатка. Проверьте, что есть @ и домен',
  too_few_participants: 'В заказе пока нет билетов',
  too_many_participants: `В одном заказе до ${MAX_PARTICIPANTS} участников`,
  child_without_adult: `Детям нужен взрослый от ${ADULT_MIN_AGE} лет в этом же заказе`,
});

export function errorMessage(code: FieldError | OrderError): string {
  return ERROR_MESSAGES[code];
}

/* ---------- name ---------- */

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

const NAME_RE = /^\p{L}[\p{L}\p{M}\s'’.-]*$/u;

export function validateName(raw: string): FieldError | null {
  const name = normalizeName(raw);
  if (name.length === 0) return 'required';
  if (name.length < NAME_MIN_LENGTH) return 'name_too_short';
  if (name.length > NAME_MAX_LENGTH) return 'name_too_long';
  if (!NAME_RE.test(name)) return 'name_invalid';
  return null;
}

/* ---------- age ---------- */

/**
 * Parses raw age input. Empty -> null; anything that is not a plain number -> NaN
 * (validateAge then reports it). "12,5" -> 12.5 (rejected as not integer).
 */
export function parseAge(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  if (!/^-?\d+([.,]\d+)?$/.test(s)) return Number.NaN;
  return Number(s.replace(',', '.'));
}

export function validateAge(age: number | null): FieldError | null {
  if (age === null) return 'required';
  if (!Number.isFinite(age) || !Number.isInteger(age)) return 'age_not_integer';
  if (age < MIN_AGE || age > MAX_AGE) return 'age_out_of_range';
  return null;
}

/* ---------- email ---------- */

// Pragmatic check: local@domain.tld, single @, no spaces, TLD of 2+ letters, IDN allowed.
const EMAIL_RE = /^[^\s@"(),:;<>[\]\\]+@(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+\p{L}{2,}$/u;

export function normalizeEmail(raw: string): string {
  return raw.trim();
}

export function validateEmail(raw: string): FieldError | null {
  const email = normalizeEmail(raw);
  if (email === '') return 'required';
  if (email.length > 254 || !EMAIL_RE.test(email)) return 'email_invalid';
  const local = email.slice(0, email.indexOf('@'));
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return 'email_invalid';
  }
  return null;
}

/* ---------- participants & order ---------- */

export interface ParticipantErrors {
  name?: FieldError;
  age?: FieldError;
}

export function validateParticipant(p: Participant): ParticipantErrors {
  const errors: ParticipantErrors = {};
  const name = validateName(p.name);
  const age = validateAge(p.age) ?? ticketTypeMismatch(p);
  if (name) errors.name = name;
  if (age) errors.age = age;
  return errors;
}

export function isAdult(p: Participant): boolean {
  return validateAge(p.age) === null && (p.age as number) >= ADULT_MIN_AGE;
}

/** Under 14 by the entered age (the person who needs an 18+ companion). */
export function isChild(p: Participant): boolean {
  return validateAge(p.age) === null && (p.age as number) < FULL_TICKET_MIN_AGE;
}

/** Order-level rules that do not belong to a single field. */
export function validateComposition(participants: readonly Participant[]): OrderError[] {
  const errors: OrderError[] = [];
  if (participants.length < 1) errors.push('too_few_participants');
  if (participants.length > MAX_PARTICIPANTS) errors.push('too_many_participants');
  if (participants.some(isChild) && !participants.some(isAdult)) errors.push('child_without_adult');
  return errors;
}

/** Rules for the counters on the "tickets" step (ages are not known yet). */
export function validatePlan(plan: TicketPlan): OrderError[] {
  const errors: OrderError[] = [];
  const qty = plan.full + plan.child;
  if (qty < 1) errors.push('too_few_participants');
  if (qty > MAX_PARTICIPANTS) errors.push('too_many_participants');
  // An 18+ participant always holds a full ticket, so children need at least one full ticket.
  if (plan.child > 0 && plan.full === 0) errors.push('child_without_adult');
  return errors;
}

export interface OrderValidation {
  valid: boolean;
  participants: Record<string, ParticipantErrors>;
  email: FieldError | null;
  order: OrderError[];
}

export function validateOrder(draft: OrderDraft): OrderValidation {
  const participants: Record<string, ParticipantErrors> = {};
  for (const p of draft.participants) {
    const e = validateParticipant(p);
    if (e.name || e.age) participants[p.id] = e;
  }
  const email = validateEmail(draft.email);
  const order = validateComposition(draft.participants);
  const valid = Object.keys(participants).length === 0 && email === null && order.length === 0;
  return { valid, participants, email, order };
}
