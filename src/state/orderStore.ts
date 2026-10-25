import { useMemo } from 'react';
import { create } from 'zustand';
import {
  createParticipant,
  isValidReduction,
  MAX_PARTICIPANTS,
  planFromParticipants,
  sortByTicketType,
  summarizeOrder,
  syncParticipantsWithPlan,
  validateOrder,
  validatePlan,
  type FlowStep,
  type OrderSummary,
  type OrderValidation,
  type Participant,
  type TicketPlan,
  type TicketType,
} from '@/domain';
import { api as defaultApi, isApiError, type ApiScenario, type Confirmation, type MockApi } from '@/data/mockApi';

/** `resolved` — the API answered; the confirm button plays its result (INV-12) before the screen changes. */
export type SubmitPhase = 'idle' | 'reserving' | 'confirming' | 'resolved';
export type SubmitOutcome = 'success' | 'soldout' | null;

export interface SoldOutInfo {
  /** SOLD_OUT — nothing left; NOT_ENOUGH_SEATS — fewer seats than in the order. */
  reason: 'SOLD_OUT' | 'NOT_ENOUGH_SEATS';
  available: number;
  /** Order size at the moment of the failure. */
  requested: number;
}

/** A field the next mounted step should focus (and scroll to). DOM id. */
export type FocusRequest = string | null;

export interface RemovedParticipant {
  participant: Participant;
  index: number;
  /** 1-based number shown in the toast. */
  number: number;
}

export interface OrderState {
  step: FlowStep;
  /** Direction of the last navigation, for enter/exit animations. */
  direction: 1 | -1;
  /** Counters on step 02. Always derived from `participants` (single source of truth). */
  plan: TicketPlan;
  participants: Participant[];
  email: string;
  /** Show validation errors on the participants step after the first "Next" attempt. */
  showErrors: boolean;
  /** Same for the tickets step (child without a full ticket). */
  planAttempted: boolean;
  /** Bumped on every failed submit — UI uses it as a trigger for the shake animation. */
  attempt: number;
  phase: SubmitPhase;
  /** Result being played by the confirm button while `phase === 'resolved'`. */
  outcome: SubmitOutcome;
  confirmation: Confirmation | null;
  soldOut: SoldOutInfo | null;
  /** After NOT_ENOUGH_SEATS: the order must be reduced to this size. */
  seatLimit: number | null;
  /** Unexpected error (network etc.). */
  error: string | null;
  /** Demo scenario mirrored from the mock API (toggle on step 04). */
  scenario: ApiScenario;
  focusRequest: FocusRequest;
  lastRemoved: RemovedParticipant | null;

  goTo(step: FlowStep): void;
  start(): void;
  back(): void;
  close(): void;

  setCount(type: TicketType, value: number): void;
  increment(type: TicketType): void;
  decrement(type: TicketType): void;
  /** tickets -> participants */
  submitPlan(): boolean;

  updateParticipant(id: string, patch: Partial<Pick<Participant, 'name' | 'age'>>): void;
  setTicketType(id: string, type: TicketType): void;
  /** Returns the id of the new participant (or null at the limit). */
  addParticipant(type?: TicketType): string | null;
  removeParticipant(id: string): void;
  undoRemove(): void;
  dismissRemoved(): void;
  setEmail(email: string): void;
  /** participants -> summary */
  submitParticipants(): boolean;
  /** From summary: open the participants step focused on a field. */
  editField(fieldId: string): void;
  requestFocus(fieldId: FocusRequest): void;

  setScenario(s: ApiScenario): void;
  /** summary -> processing -> success | soldout */
  confirm(): Promise<void>;
  /** soldout (NOT_ENOUGH_SEATS) -> participants with a seat limit */
  reduceOrder(): void;
  /**
   * Keeps only these participants when the seats are short (one-click fix from 06 / the 03 banner).
   * Refuses a set that breaks the order rules (child without an adult). Valid result -> summary.
   */
  keepOnly(ids: readonly string[]): boolean;
  reset(toStep?: FlowStep): void;
}

const ORDER: FlowStep[] = ['landing', 'tickets', 'participants', 'summary', 'processing', 'success', 'soldout'];
const BACK: Partial<Record<FlowStep, FlowStep>> = {
  tickets: 'landing',
  participants: 'tickets',
  summary: 'participants',
  soldout: 'summary',
};

function withPlan(participants: Participant[]) {
  return { participants, plan: planFromParticipants(participants) };
}

export interface StoreOptions {
  /** Pause between the API answer and the result screen (confirm-button result animation). */
  resultDelayMs?: () => number;
}

const wait = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

export function createOrderStore(api: MockApi = defaultApi, options: StoreOptions = {}) {
  const resultDelay = options.resultDelayMs ?? (() => 0);
  const initialData = () => ({
    step: 'landing' as FlowStep,
    direction: 1 as const,
    ...withPlan([createParticipant('full')]),
    email: '',
    showErrors: false,
    planAttempted: false,
    attempt: 0,
    phase: 'idle' as SubmitPhase,
    outcome: null as SubmitOutcome,
    confirmation: null,
    soldOut: null,
    seatLimit: null,
    error: null,
    focusRequest: null,
    lastRemoved: null,
  });

  return create<OrderState>()((set, get) => ({
    ...initialData(),
    scenario: api.getScenario(),

    goTo(step) {
      const from = ORDER.indexOf(get().step);
      set({ step, direction: ORDER.indexOf(step) >= from ? 1 : -1, lastRemoved: null });
    },
    start() {
      get().goTo('tickets');
    },
    back() {
      const prev = BACK[get().step];
      if (prev) get().goTo(prev);
    },
    close() {
      if (get().phase !== 'idle') return;
      set({ step: 'landing', direction: -1, lastRemoved: null });
    },

    setCount(type, value) {
      const { plan, participants } = get();
      const other = type === 'full' ? plan.child : plan.full;
      const clamped = Math.max(0, Math.min(Math.floor(value), MAX_PARTICIPANTS - other));
      set(withPlan(syncParticipantsWithPlan(participants, { ...plan, [type]: clamped })));
    },
    increment(type) {
      get().setCount(type, get().plan[type] + 1);
    },
    decrement(type) {
      get().setCount(type, get().plan[type] - 1);
    },
    submitPlan() {
      const { plan, participants } = get();
      if (validatePlan(plan).length > 0) {
        set({ planAttempted: true, attempt: get().attempt + 1 });
        return false;
      }
      set({ planAttempted: false, participants: sortByTicketType(participants) });
      get().goTo('participants');
      return true;
    },

    updateParticipant(id, patch) {
      set({ participants: get().participants.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    },
    setTicketType(id, type) {
      set(withPlan(get().participants.map((p) => (p.id === id ? { ...p, ticketType: type } : p))));
    },
    addParticipant(type = 'full') {
      const { participants } = get();
      if (participants.length >= MAX_PARTICIPANTS) return null;
      const added = createParticipant(type);
      set({ ...withPlan([...participants, added]), lastRemoved: null, focusRequest: `p-${added.id}-name` });
      return added.id;
    },
    removeParticipant(id) {
      const { participants } = get();
      const index = participants.findIndex((p) => p.id === id);
      if (index < 0 || participants.length <= 1) return;
      const next = participants.filter((p) => p.id !== id);
      set({ ...withPlan(next), lastRemoved: { participant: participants[index], index, number: index + 1 } });
    },
    undoRemove() {
      const { lastRemoved, participants } = get();
      if (!lastRemoved || participants.length >= MAX_PARTICIPANTS) return;
      const next = [...participants];
      next.splice(Math.min(lastRemoved.index, next.length), 0, lastRemoved.participant);
      set({ ...withPlan(next), lastRemoved: null });
    },
    dismissRemoved() {
      set({ lastRemoved: null });
    },
    setEmail(email) {
      set({ email });
    },
    submitParticipants() {
      const { participants, email, seatLimit } = get();
      const tooMany = seatLimit !== null && participants.length > seatLimit;
      if (!validateOrder({ participants, email }).valid || tooMany) {
        set({ showErrors: true, attempt: get().attempt + 1 });
        return false;
      }
      set({ showErrors: false, error: null });
      get().goTo('summary');
      return true;
    },
    editField(fieldId) {
      set({ focusRequest: fieldId });
      get().goTo('participants');
    },
    requestFocus(fieldId) {
      set({ focusRequest: fieldId });
    },

    setScenario(s) {
      api.setScenario(s);
      set({ scenario: api.getScenario() });
    },

    async confirm() {
      const { participants, email, phase } = get();
      if (phase !== 'idle') return;
      set({ phase: 'reserving', error: null, soldOut: null });
      get().goTo('processing');
      try {
        const reservation = await api.reserve({ participants, email });
        set({ phase: 'confirming' });
        const confirmation = await api.confirm(reservation.reservationId);
        set({ phase: 'resolved', outcome: 'success' });
        await wait(resultDelay());
        set({ confirmation, phase: 'idle', outcome: null, seatLimit: null, scenario: api.getScenario() });
        get().goTo('success');
      } catch (e) {
        if (isApiError(e) && (e.code === 'SOLD_OUT' || e.code === 'NOT_ENOUGH_SEATS')) {
          set({ phase: 'resolved', outcome: 'soldout' });
          await wait(resultDelay());
          set({
            phase: 'idle',
            outcome: null,
            scenario: api.getScenario(),
            soldOut: { reason: e.code, available: e.available ?? 0, requested: participants.length },
          });
          get().goTo('soldout');
        } else {
          set({ phase: 'idle', error: e instanceof Error ? e.message : 'unknown' });
          get().goTo('summary');
        }
      }
    },

    reduceOrder() {
      const { soldOut } = get();
      if (!soldOut || soldOut.reason !== 'NOT_ENOUGH_SEATS') return;
      set({ seatLimit: soldOut.available, showErrors: true });
      get().goTo('participants');
    },

    keepOnly(ids) {
      const { participants, soldOut, seatLimit, email } = get();
      const limit = seatLimit ?? (soldOut?.reason === 'NOT_ENOUGH_SEATS' ? soldOut.available : null);
      if (limit === null || !isValidReduction(participants, ids, limit)) return false;
      const kept = participants.filter((p) => ids.includes(p.id));
      set({ ...withPlan(kept), seatLimit: limit, lastRemoved: null });
      if (validateOrder({ participants: kept, email }).valid) {
        set({ showErrors: false });
        get().goTo('summary');
      } else {
        set({ showErrors: true });
        get().goTo('participants');
      }
      return true;
    },

    reset(toStep = 'landing') {
      set({ ...initialData(), step: toStep, direction: toStep === 'landing' ? -1 : 1 });
    },
  }));
}

export const useOrderStore = createOrderStore(defaultApi, {
  resultDelayMs: () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 560,
});

/* ---------- derived data (memoized: never return fresh objects from a zustand selector) ---------- */

export function useOrderSummary(): OrderSummary {
  const participants = useOrderStore((s) => s.participants);
  return useMemo(() => summarizeOrder(participants), [participants]);
}

export function useOrderValidation(): OrderValidation {
  const participants = useOrderStore((s) => s.participants);
  const email = useOrderStore((s) => s.email);
  return useMemo(() => validateOrder({ participants, email }), [participants, email]);
}

export function usePlanErrors() {
  const plan = useOrderStore((s) => s.plan);
  return useMemo(() => validatePlan(plan), [plan]);
}
