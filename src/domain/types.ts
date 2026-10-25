export type TicketType = 'full' | 'child';

export interface Participant {
  id: string;
  /** Raw user input; trimmed/validated by domain functions. */
  name: string;
  /** Integer 0..99 when valid; null while not entered; NaN for garbage input. */
  age: number | null;
  /**
   * Ticket type chosen for this participant (counters on the "tickets" step or the
   * type switch on the participant card). It is what gets charged. If the entered age
   * contradicts it, validation reports `age_full_too_young` / `age_child_too_old`
   * and the UI offers a one-click fix. Optional so a plain {id, name, age} works (= full).
   */
  ticketType?: TicketType;
}

/** Ticket counters chosen on the "tickets" step. */
export interface TicketPlan {
  full: number;
  child: number;
}

export interface OrderDraft {
  participants: Participant[];
  email: string;
}

export interface OrderLine {
  type: TicketType;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderSummary {
  lines: OrderLine[];
  quantity: number;
  total: number;
}
