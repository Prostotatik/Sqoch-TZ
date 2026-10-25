import { TICKET_PRICES } from '@/domain';

/** Mock festival — single source for dates/venue (guidelines §0: 10–11 июля 2027). */
export const FESTIVAL_EVENT = {
  id: 'neon-waves-2027',
  title: 'Neon Waves',
  tagline: 'More music. More life.',
  dates: { start: '2027-07-10', end: '2027-07-11', label: '10–11 июля 2027', short: '10–11 июля' },
  venue: { name: 'Green Arena', city: 'Москва', label: 'Москва, Green Arena' },
  prices: TICKET_PRICES,
  /** Seats left by default in the mock (overridable with ?seats=N). */
  seatsLeft: 37,
  /** Concrete facts, one line (guidelines §3.1, anti-slop review SLOP-03): no captions retelling numbers. */
  facts: ['2 дня', '4 сцены', 'с 14:00 до 23:00'],
} as const;

export type FestivalEvent = typeof FESTIVAL_EVENT;
