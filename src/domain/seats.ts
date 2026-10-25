import type { Participant } from './types';
import { isAdult, isChild, validateComposition } from './validation';

/**
 * Fewer seats than participants (NOT_ENOUGH_SEATS): which reductions keep the order valid?
 * Brute force over subsets — at most C(4, k) ≤ 6 of them. A suggestion must never lead to
 * "a child without an adult" (brief rule 01), so the copy is built from these options.
 */
export interface SeatAdvice {
  limit: number;
  /** How many participants have to go. */
  excess: number;
  /** Every valid way to keep exactly `limit` participants (ids, original order). */
  options: string[][];
  /** The single valid option, if there is only one (e.g. an adult and a child, one seat left). */
  only: Participant[] | null;
  /** The order has children, but none of them can stay (no option keeps a child). */
  childrenOut: boolean;
  /** Adults that are in every option while a child can stay: removing them breaks the rule. */
  mustKeep: Participant[];
}

function subsets<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [head, ...rest] = items;
  return [...subsets(rest, size - 1).map((s) => [head, ...s]), ...subsets(rest, size)];
}

export function seatAdvice(participants: readonly Participant[], limit: number): SeatAdvice {
  const size = Math.max(0, Math.min(limit, participants.length));
  const valid = size === 0 ? [] : subsets(participants, size).filter((s) => validateComposition(s).length === 0);
  const options = valid.map((s) => s.map((p) => p.id));
  const hasChildren = participants.some(isChild);
  const childCanStay = valid.some((s) => s.some(isChild));
  const mustKeep =
    childCanStay && valid.length > 0
      ? participants.filter((p) => isAdult(p) && valid.every((s) => s.includes(p)))
      : [];
  return {
    limit,
    excess: Math.max(0, participants.length - limit),
    options,
    only: valid.length === 1 ? valid[0] : null,
    childrenOut: hasChildren && valid.length > 0 && !childCanStay,
    mustKeep,
  };
}

/** True when keeping exactly these participants is one of the valid options. */
export function isValidReduction(participants: readonly Participant[], keepIds: readonly string[], limit: number): boolean {
  const kept = participants.filter((p) => keepIds.includes(p.id));
  return kept.length > 0 && kept.length <= limit && kept.length === keepIds.length && validateComposition(kept).length === 0;
}
