import { describe, expect, it } from 'vitest';
import { createParticipant, sortByTicketType, syncParticipantsWithPlan } from './flow';
import { planFromParticipants } from './pricing';
import type { Participant } from './types';

const ids = () => {
  let i = 0;
  return () => `new${(i += 1)}`;
};

const filled = (id: string, name: string, age: number, ticketType?: Participant['ticketType']): Participant => ({
  id,
  name,
  age,
  ticketType,
});

describe('syncParticipantsWithPlan', () => {
  it('creates blank slots from counters (full first)', () => {
    const res = syncParticipantsWithPlan([], { full: 2, child: 1 }, ids());
    expect(res.map((p) => [p.id, p.ticketType, p.name, p.age])).toEqual([
      ['new1', 'full', '', null],
      ['new2', 'full', '', null],
      ['new3', 'child', '', null],
    ]);
  });

  it('keeps entered data when counters grow', () => {
    const a = filled('a', 'Иван', 30, 'full');
    const res = syncParticipantsWithPlan([a], { full: 1, child: 1 }, ids());
    expect(res[0]).toBe(a);
    expect(res[1]).toMatchObject({ id: 'new1', ticketType: 'child' });
  });

  it('drops blank slots before filled ones when counters shrink', () => {
    const a = filled('a', 'Иван', 30, 'full');
    const blank = createParticipant('full', 'b');
    const c = filled('c', 'Олег', 40, 'full');
    const res = syncParticipantsWithPlan([a, blank, c], { full: 2, child: 0 }, ids());
    expect(res.map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('drops the last filled one when no blanks left', () => {
    const a = filled('a', 'Иван', 30, 'full');
    const c = filled('c', 'Олег', 40, 'full');
    expect(syncParticipantsWithPlan([a, c], { full: 1, child: 0 }, ids()).map((p) => p.id)).toEqual(['a']);
  });

  it('matches by the chosen ticket type, not by age', () => {
    // age says child, but the slot is "full" until the user switches it (validation flags it)
    const kid = filled('k', 'Маша', 9, 'full');
    const res = syncParticipantsWithPlan([kid], { full: 1, child: 1 }, ids());
    expect(res.map((p) => p.id)).toEqual(['k', 'new1']);
    expect(planFromParticipants(res)).toEqual({ full: 1, child: 1 });
  });

  it('never exceeds 4 participants', () => {
    expect(syncParticipantsWithPlan([], { full: 3, child: 3 }, ids())).toHaveLength(4);
  });
});

describe('sortByTicketType', () => {
  it('puts full tickets first and keeps order inside groups', () => {
    const res = sortByTicketType([
      filled('c1', 'А', 5, 'child'),
      filled('f1', 'Б', 30, 'full'),
      filled('c2', 'В', 6, 'child'),
      filled('f2', 'Г', 40, 'full'),
    ]);
    expect(res.map((p) => p.id)).toEqual(['f1', 'f2', 'c1', 'c2']);
  });
});
