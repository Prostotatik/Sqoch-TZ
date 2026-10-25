import { describe, expect, it } from 'vitest';
import { isValidReduction, seatAdvice } from './seats';
import type { Participant } from './types';

const person = (id: string, age: number): Participant => ({ id, name: id, age, ticketType: age >= 14 ? 'full' : 'child' });
const ivan = person('Иван', 35);
const olga = person('Ольга', 40);
const teen = person('Петя', 16);
const masha = person('Маша', 9);
const kolya = person('Коля', 6);

describe('seatAdvice (fewer seats than participants)', () => {
  it('adult + child, one seat: the only option is the adult', () => {
    const a = seatAdvice([ivan, masha], 1);
    expect(a.excess).toBe(1);
    expect(a.only?.map((p) => p.id)).toEqual(['Иван']);
    expect(a.childrenOut).toBe(true);
  });

  it('one adult + two children, two seats: the adult must stay', () => {
    const a = seatAdvice([ivan, masha, kolya], 2);
    expect(a.only).toBeNull();
    expect(a.options).toHaveLength(2);
    expect(a.options.every((o) => o.includes('Иван'))).toBe(true);
    expect(a.mustKeep.map((p) => p.id)).toEqual(['Иван']);
  });

  it('a teen (14–17) cannot be the one left with a child', () => {
    const a = seatAdvice([ivan, teen, masha], 2);
    expect(a.options).not.toContainEqual(['Петя', 'Маша']);
    expect(a.mustKeep.map((p) => p.id)).toEqual(['Иван']);
  });

  it('no children: any reduction works, nobody is pinned', () => {
    const a = seatAdvice([ivan, olga, teen], 2);
    expect(a.options).toHaveLength(3);
    expect(a.only).toBeNull();
    expect(a.mustKeep).toEqual([]);
    expect(a.childrenOut).toBe(false);
  });

  it('isValidReduction rejects a child left alone', () => {
    expect(isValidReduction([ivan, masha], ['Маша'], 1)).toBe(false);
    expect(isValidReduction([ivan, masha], ['Иван'], 1)).toBe(true);
    expect(isValidReduction([ivan, masha], ['Иван', 'Маша'], 1)).toBe(false);
  });
});
