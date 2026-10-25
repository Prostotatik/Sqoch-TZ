import { MAX_PARTICIPANTS } from './rules';
import { effectiveTicketType, planFromParticipants } from './pricing';
import type { Participant, TicketPlan, TicketType } from './types';

/**
 * Flow: landing -> tickets -> participants -> summary -> processing -> success | soldout.
 * From summary the user can go back to participants (edit data) or tickets (quantity).
 */
export type FlowStep = 'landing' | 'tickets' | 'participants' | 'summary' | 'processing' | 'success' | 'soldout';

/** Steps shown in the progress indicator. */
export const PROGRESS_STEPS = ['tickets', 'participants', 'summary'] as const satisfies readonly FlowStep[];

let seq = 0;
export function createParticipantId(): string {
  seq += 1;
  return `p${seq}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createParticipant(ticketType: TicketType = 'full', id = createParticipantId()): Participant {
  return { id, name: '', age: null, ticketType };
}

export function isBlankParticipant(p: Participant): boolean {
  return p.name.trim() === '' && p.age === null;
}

/**
 * Reconciles participant slots with the counters from the "tickets" step:
 * - keeps entered participants (matched by their effective ticket type);
 * - drops surplus slots: blank ones first, then the last added;
 * - appends blank slots of the missing type.
 * Original order of the kept participants is preserved.
 */
export function syncParticipantsWithPlan(
  participants: readonly Participant[],
  plan: TicketPlan,
  makeId: () => string = createParticipantId,
): Participant[] {
  const dropped = new Set<string>();
  for (const type of ['full', 'child'] as const) {
    const ofType = participants.filter((p) => effectiveTicketType(p) === type);
    let surplus = Math.max(0, ofType.length - plan[type]);
    const candidates = [...ofType.filter(isBlankParticipant).reverse(), ...ofType.filter((p) => !isBlankParticipant(p)).reverse()];
    for (const p of candidates) {
      if (surplus === 0) break;
      dropped.add(p.id);
      surplus -= 1;
    }
  }
  const result = participants.filter((p) => !dropped.has(p.id));
  const current = planFromParticipants(result);
  for (const type of ['full', 'child'] as const) {
    for (let i = current[type]; i < plan[type]; i += 1) result.push(createParticipant(type, makeId()));
  }
  return result.slice(0, MAX_PARTICIPANTS);
}

/** Full tickets first, then children; stable inside a group (spec: card order on step 03). */
export function sortByTicketType(participants: readonly Participant[]): Participant[] {
  const full = participants.filter((p) => effectiveTicketType(p) === 'full');
  const child = participants.filter((p) => effectiveTicketType(p) === 'child');
  return [...full, ...child];
}
