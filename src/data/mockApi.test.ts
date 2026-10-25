import { describe, expect, it } from 'vitest';
import { ApiError, createMockApi, optionsFromSearch } from './mockApi';
import type { OrderDraft } from '@/domain';

const instant = { sleep: () => Promise.resolve() };

const order = (ages: number[]): OrderDraft => ({
  email: ' ivan@example.com ',
  participants: ages.map((age, i) => ({ id: `p${i}`, name: ` Участник ${'абвг'[i]} `, age, ticketType: age < 14 ? ('child' as const) : ('full' as const) })),
});

describe('mock api', () => {
  it('reserves and confirms an order', async () => {
    const api = createMockApi({ ...instant, seatsLeft: 10 });
    const r = await api.reserve(order([35, 8]));
    expect(r.quantity).toBe(2);
    expect(r.total).toBe(3000);
    expect(api.peekSeatsLeft()).toBe(8);
    const c = await api.confirm(r.reservationId);
    expect(c.total).toBe(3000);
    expect(c.email).toBe('ivan@example.com');
    expect(c.tickets.map((t) => t.type)).toEqual(['full', 'child']);
    expect(c.tickets[0].holder).toBe('Участник а');
    expect(c.orderId).toMatch(/^NW-2707-\d{4}$/);
    const seq = c.orderId.slice(-4);
    expect(c.tickets.map((t) => t.code)).toEqual([`NW-${seq}-1`, `NW-${seq}-2`]);
  });

  it('simulates network delay', async () => {
    const calls: number[] = [];
    const api = createMockApi({ sleep: async (ms) => void calls.push(ms) });
    const r = await api.reserve(order([30]));
    await api.confirm(r.reservationId);
    expect(calls).toEqual([500, 700]);
  });

  it('soldout scenario fails right at confirmation', async () => {
    const api = createMockApi({ ...instant, scenario: 'soldout' });
    const r = await api.reserve(order([30]));
    await expect(api.confirm(r.reservationId)).rejects.toMatchObject({ code: 'SOLD_OUT', available: 0 });
    expect(api.peekSeatsLeft()).toBe(0);
  });

  it('scenario can be switched at runtime', async () => {
    const api = createMockApi(instant);
    api.setScenario('soldout');
    expect(api.getScenario()).toBe('soldout');
    const r = await api.reserve(order([30]));
    await expect(api.confirm(r.reservationId)).rejects.toBeInstanceOf(ApiError);
  });

  it('fails reserve when not enough seats left', async () => {
    const api = createMockApi({ ...instant, seatsLeft: 2 });
    await expect(api.reserve(order([30, 30, 30]))).rejects.toMatchObject({ code: 'NOT_ENOUGH_SEATS', available: 2 });
    api.setSeatsLeft(0);
    await expect(api.reserve(order([30]))).rejects.toMatchObject({ code: 'SOLD_OUT' });
  });

  it('rejects invalid orders', async () => {
    const api = createMockApi(instant);
    await expect(api.reserve(order([8]))).rejects.toMatchObject({ code: 'INVALID_ORDER' });
  });

  it('expires reservations', async () => {
    let t = 0;
    const api = createMockApi({ ...instant, now: () => t, holdMs: 1000, seatsLeft: 5 });
    const r = await api.reserve(order([30]));
    t = 2000;
    await expect(api.confirm(r.reservationId)).rejects.toMatchObject({ code: 'RESERVATION_EXPIRED' });
    expect(api.peekSeatsLeft()).toBe(5);
    await expect(api.confirm('nope')).rejects.toMatchObject({ code: 'RESERVATION_EXPIRED' });
  });
});

describe('optionsFromSearch', () => {
  it('reads demo switches', () => {
    expect(optionsFromSearch('')).toEqual({});
    expect(optionsFromSearch('?soldout=1')).toEqual({ scenario: 'soldout' });
    expect(optionsFromSearch('?soldout')).toEqual({ scenario: 'soldout' });
    expect(optionsFromSearch('?soldout=0')).toEqual({});
    expect(optionsFromSearch('?seats=2')).toEqual({ seatsLeft: 2 });
    expect(optionsFromSearch('?seats=abc')).toEqual({});
    expect(optionsFromSearch('?delay=3000')).toEqual({ reserveDelayMs: 1200, confirmDelayMs: 1800 });
  });
});

describe('scenarios from the URL', () => {
  it('reads ?scenario= and the ?soldout=1 alias', () => {
    expect(optionsFromSearch('?scenario=soldout').scenario).toBe('soldout');
    expect(optionsFromSearch('?soldout=1').scenario).toBe('soldout');
    expect(optionsFromSearch('?scenario=partial').scenario).toBe('partial');
    expect(optionsFromSearch('?soldout=0').scenario).toBeUndefined();
  });
});
