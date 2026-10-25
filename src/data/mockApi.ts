import {
  normalizeEmail,
  normalizeName,
  planFromParticipants,
  planTotal,
  validateOrder,
  effectiveTicketType,
  type OrderDraft,
  type TicketType,
} from '@/domain';
import { FESTIVAL_EVENT } from './event';

/**
 * Scenarios:
 *  - 'normal'  — everything succeeds while seats are available;
 *  - 'soldout' — reserve succeeds, but confirm fails with SOLD_OUT
 *                ("seats ran out right before confirmation", brief item 04);
 *  - 'partial' — one-shot: on the next reserve only (quantity − 1) seats are left,
 *                so it fails with NOT_ENOUGH_SEATS (SOLD_OUT for a single ticket);
 *                then the scenario falls back to 'normal' so a reduced order succeeds.
 * Independently, a small `seatsLeft` makes reserve fail with NOT_ENOUGH_SEATS
 * when the order is bigger than what is left.
 */
export type ApiScenario = 'normal' | 'soldout' | 'partial';

export type ApiErrorCode = 'SOLD_OUT' | 'NOT_ENOUGH_SEATS' | 'INVALID_ORDER' | 'RESERVATION_EXPIRED';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** Seats still available (for SOLD_OUT / NOT_ENOUGH_SEATS). */
  readonly available?: number;

  constructor(code: ApiErrorCode, message: string, available?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.available = available;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export interface Availability {
  seatsLeft: number;
}

export interface Reservation {
  reservationId: string;
  quantity: number;
  total: number;
  expiresAt: number;
}

export interface IssuedTicket {
  code: string;
  holder: string;
  age: number;
  type: TicketType;
}

export interface Confirmation {
  orderId: string;
  email: string;
  total: number;
  tickets: IssuedTicket[];
}

export interface MockApiOptions {
  scenario?: ApiScenario;
  seatsLeft?: number;
  /** Network delay per call, ms (~1.2 s for reserve + confirm in total by default). */
  reserveDelayMs?: number;
  confirmDelayMs?: number;
  availabilityDelayMs?: number;
  /** Reservation hold time. */
  holdMs?: number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface MockApi {
  getAvailability(): Promise<Availability>;
  reserve(order: OrderDraft): Promise<Reservation>;
  confirm(reservationId: string): Promise<Confirmation>;
  setScenario(s: ApiScenario): void;
  getScenario(): ApiScenario;
  setSeatsLeft(n: number): void;
  /** Synchronous peek, for demo UI. */
  peekSeatsLeft(): number;
}

export function createMockApi(options: MockApiOptions = {}): MockApi {
  let scenario: ApiScenario = options.scenario ?? 'normal';
  const initialSeats = options.seatsLeft ?? FESTIVAL_EVENT.seatsLeft;
  let seatsLeft = initialSeats;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const reserveDelay = options.reserveDelayMs ?? 500;
  const confirmDelay = options.confirmDelayMs ?? 700;
  const availabilityDelay = options.availabilityDelayMs ?? 300;
  const holdMs = options.holdMs ?? 10 * 60 * 1000;

  const reservations = new Map<string, { draft: OrderDraft; reservation: Reservation }>();
  // SLOP-17: numbers a person can dictate — NW-2707-0412 (festival year+month, then a counter),
  // tickets NW-0412-1, NW-0412-2
  let orderSeq = 400 + Math.floor(random() * 500);
  const festivalTag = FESTIVAL_EVENT.dates.start.slice(2, 4) + FESTIVAL_EVENT.dates.start.slice(5, 7);
  const id = (prefix: string, len = 6) =>
    `${prefix}-${Array.from({ length: len }, () => '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(random() * 34)]).join('')}`;

  return {
    async getAvailability() {
      await sleep(availabilityDelay);
      return { seatsLeft };
    },

    async reserve(order) {
      await sleep(reserveDelay);
      const validation = validateOrder(order);
      if (!validation.valid) throw new ApiError('INVALID_ORDER', 'Заказ заполнен с ошибками');
      const quantity = order.participants.length;
      if (scenario === 'partial') {
        seatsLeft = Math.max(0, quantity - 1);
        scenario = 'normal';
      }
      if (seatsLeft === 0) throw new ApiError('SOLD_OUT', 'Места закончились', 0);
      if (quantity > seatsLeft) {
        throw new ApiError('NOT_ENOUGH_SEATS', `Осталось мест: ${seatsLeft}`, seatsLeft);
      }
      const reservation: Reservation = {
        reservationId: id('R'),
        quantity,
        total: planTotal(planFromParticipants(order.participants)),
        expiresAt: now() + holdMs,
      };
      seatsLeft -= quantity; // seats are held
      reservations.set(reservation.reservationId, { draft: structuredClone(order), reservation });
      return reservation;
    },

    async confirm(reservationId) {
      await sleep(confirmDelay);
      const entry = reservations.get(reservationId);
      if (!entry) throw new ApiError('RESERVATION_EXPIRED', 'Бронь не найдена');
      reservations.delete(reservationId);
      if (now() > entry.reservation.expiresAt) {
        seatsLeft += entry.reservation.quantity;
        throw new ApiError('RESERVATION_EXPIRED', 'Время брони истекло');
      }
      if (scenario === 'soldout') {
        // somebody else bought the last seats while the user was confirming
        seatsLeft = 0;
        throw new ApiError('SOLD_OUT', 'Места закончились', 0);
      }
      const { draft, reservation } = entry;
      orderSeq += 1;
      const seq = String(orderSeq % 10000).padStart(4, '0');
      return {
        orderId: `NW-${festivalTag}-${seq}`,
        email: normalizeEmail(draft.email),
        total: reservation.total,
        tickets: draft.participants.map((p, i) => ({
          code: `NW-${seq}-${i + 1}`,
          holder: normalizeName(p.name),
          age: p.age as number,
          type: effectiveTicketType(p),
        })),
      };
    },

    setScenario(s) {
      scenario = s;
      // switching the demo back to "seats available" refills what earlier demos drained
      if (s === 'normal' && seatsLeft === 0) seatsLeft = initialSeats;
    },
    getScenario() {
      return scenario;
    },
    setSeatsLeft(n) {
      seatsLeft = Math.max(0, Math.floor(n));
    },
    peekSeatsLeft() {
      return seatsLeft;
    },
  };
}

/**
 * Reads demo switches from the URL:
 *   ?scenario=soldout -> confirm fails with SOLD_OUT (alias: ?soldout=1)
 *   ?scenario=partial -> fewer seats than in the order (NOT_ENOUGH_SEATS)
 *   ?seats=2          -> only 2 seats left (bigger orders fail at reserve)
 *   ?delay=3000       -> total network delay (split 40/60 between reserve/confirm)
 */
export function optionsFromSearch(search: string): MockApiOptions {
  const q = new URLSearchParams(search);
  const opts: MockApiOptions = {};
  const soldout = q.get('soldout');
  if (soldout !== null && soldout !== '0' && soldout !== 'false') opts.scenario = 'soldout';
  const scenario = q.get('scenario');
  if (scenario === 'soldout' || scenario === 'partial' || scenario === 'normal') opts.scenario = scenario;
  const seats = q.get('seats');
  if (seats !== null && /^\d+$/.test(seats)) opts.seatsLeft = Number(seats);
  const delay = q.get('delay');
  if (delay !== null && /^\d+$/.test(delay)) {
    const total = Number(delay);
    opts.reserveDelayMs = Math.round(total * 0.4);
    opts.confirmDelayMs = total - Math.round(total * 0.4);
  }
  return opts;
}

/** App-wide singleton configured from the current URL. */
export const api: MockApi = createMockApi(
  typeof window !== 'undefined' ? optionsFromSearch(window.location.search) : {},
);
