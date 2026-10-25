import { describe, expect, it } from 'vitest';
import { createOrderStore } from './orderStore';
import { createMockApi } from '@/data/mockApi';

const setup = (opts: Parameters<typeof createMockApi>[0] = {}) =>
  createOrderStore(createMockApi({ sleep: () => Promise.resolve(), ...opts }));

function fillValid(store: ReturnType<typeof setup>) {
  const [a, b] = store.getState().participants;
  store.getState().updateParticipant(a.id, { name: 'Иван Петров', age: 35 });
  store.getState().updateParticipant(b.id, { name: 'Маша', age: 8 });
  store.getState().setEmail('ivan@example.com');
}

describe('order flow store', () => {
  it('walks the happy path', async () => {
    const store = setup();
    const s = store.getState;
    s().start();
    expect(s().step).toBe('tickets');
    s().increment('child');
    expect(s().plan).toEqual({ full: 1, child: 1 });
    expect(s().submitPlan()).toBe(true);
    expect(s().step).toBe('participants');
    expect(s().participants.map((p) => p.ticketType)).toEqual(['full', 'child']);

    expect(s().submitParticipants()).toBe(false);
    expect(s().showErrors).toBe(true);

    fillValid(store);
    expect(s().submitParticipants()).toBe(true);
    expect(s().step).toBe('summary');

    const pending = s().confirm();
    expect(s().step).toBe('processing');
    expect(s().phase).toBe('reserving');
    await pending;
    expect(s().step).toBe('success');
    expect(s().confirmation?.total).toBe(3000);
  });

  it('clamps counters to 4 tickets in total', () => {
    const store = setup();
    const s = store.getState;
    s().setCount('full', 3);
    s().increment('child');
    s().increment('child');
    expect(s().plan).toEqual({ full: 3, child: 1 });
    s().decrement('full');
    s().decrement('full');
    s().decrement('full');
    s().decrement('full');
    expect(s().plan.full).toBe(0);
  });

  it('blocks children without a full ticket', () => {
    const store = setup();
    const s = store.getState;
    s().setCount('full', 0);
    s().setCount('child', 2);
    expect(s().submitPlan()).toBe(false);
    expect(s().step).toBe('landing');
  });

  it('age contradicting the ticket type blocks with a one-click fix; counters follow', () => {
    const store = setup();
    const s = store.getState;
    s().start();
    s().setCount('full', 2);
    s().submitPlan();
    const [first, second] = s().participants;
    s().updateParticipant(first.id, { name: 'Иван', age: 40 });
    s().updateParticipant(second.id, { name: 'Маша', age: 9 });
    s().setEmail('ivan@example.com');
    expect(s().submitParticipants()).toBe(false);
    s().setTicketType(second.id, 'child');
    expect(s().plan).toEqual({ full: 1, child: 1 });
    expect(s().submitParticipants()).toBe(true);
    s().back();
    s().back();
    expect(s().step).toBe('tickets');
    s().submitPlan();
    expect(s().participants.find((p) => p.id === second.id)?.name).toBe('Маша');
  });

  it('counters on step 02 add and remove participant slots', () => {
    const store = setup();
    const s = store.getState;
    expect(s().participants).toHaveLength(1);
    s().increment('child');
    expect(s().participants.map((p) => p.ticketType)).toEqual(['full', 'child']);
    s().decrement('full');
    expect(s().participants.map((p) => p.ticketType)).toEqual(['child']);
  });

  it('undo restores a removed participant at its place', () => {
    const store = setup();
    const s = store.getState;
    s().setCount('full', 3);
    const ids = s().participants.map((p) => p.id);
    s().removeParticipant(ids[1]);
    expect(s().lastRemoved?.number).toBe(2);
    s().undoRemove();
    expect(s().participants.map((p) => p.id)).toEqual(ids);
  });

  it('partial scenario: fewer seats, reduce order, then success', async () => {
    const store = setup({ scenario: 'partial' });
    const s = store.getState;
    s().start();
    s().increment('child');
    s().submitPlan();
    fillValid(store);
    s().submitParticipants();
    await s().confirm();
    expect(s().soldOut).toEqual({ reason: 'NOT_ENOUGH_SEATS', available: 1, requested: 2 });
    s().reduceOrder();
    expect(s().step).toBe('participants');
    expect(s().seatLimit).toBe(1);
    expect(s().submitParticipants()).toBe(false);
    const child = s().participants.find((p) => p.ticketType === 'child')!;
    s().removeParticipant(child.id);
    expect(s().submitParticipants()).toBe(true);
    await s().confirm();
    expect(s().step).toBe('success');
  });

  it('partial: the reduction cannot leave a child without an adult (SLOP-10)', async () => {
    const store = setup({ scenario: 'partial' });
    const s = store.getState;
    s().start();
    s().increment('child');
    s().submitPlan();
    fillValid(store);
    s().submitParticipants();
    await s().confirm();
    const [adult, child] = s().participants;
    // keeping only the child is refused outright
    expect(s().keepOnly([child.id])).toBe(false);
    expect(s().participants).toHaveLength(2);
    // removing the adult by hand under the seat limit is caught by validation
    s().reduceOrder();
    s().removeParticipant(adult.id);
    expect(s().submitParticipants()).toBe(false);
    s().undoRemove();
    // the one valid option goes straight to the summary, data kept
    expect(s().keepOnly([adult.id])).toBe(true);
    expect(s().step).toBe('summary');
    expect(s().participants.map((p) => p.name)).toEqual(['Иван Петров']);
    await s().confirm();
    expect(s().step).toBe('success');
  });

  it('goes to soldout screen when seats run out before confirmation', async () => {
    const store = setup({ scenario: 'soldout' });
    const s = store.getState;
    s().start();
    s().increment('child');
    s().submitPlan();
    fillValid(store);
    s().submitParticipants();
    await s().confirm();
    expect(s().step).toBe('soldout');
    expect(s().soldOut).toEqual({ reason: 'SOLD_OUT', available: 0, requested: 2 });
    s().back();
    expect(s().step).toBe('summary');
  });

  it('reports NOT_ENOUGH_SEATS with remaining amount', async () => {
    const store = setup({ seatsLeft: 1 });
    const s = store.getState;
    s().start();
    s().increment('child');
    s().submitPlan();
    fillValid(store);
    s().submitParticipants();
    await s().confirm();
    expect(s().soldOut).toEqual({ reason: 'NOT_ENOUGH_SEATS', available: 1, requested: 2 });
  });

  it('add/remove participants keeps 1..4 and syncs plan', () => {
    const store = setup();
    const s = store.getState;
    s().submitPlan();
    s().addParticipant('child');
    s().addParticipant();
    s().addParticipant();
    s().addParticipant();
    expect(s().participants).toHaveLength(4);
    expect(s().plan).toEqual({ full: 3, child: 1 });
    for (const p of [...s().participants]) s().removeParticipant(p.id);
    expect(s().participants).toHaveLength(1);
  });

  it('reset returns to the landing', () => {
    const store = setup();
    store.getState().start();
    store.getState().reset();
    expect(store.getState().step).toBe('landing');
  });
});
