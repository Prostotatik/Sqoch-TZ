import { useState } from 'react';
import clsx from 'clsx';
import { Plus, ShieldCheck, TriangleAlert } from 'lucide-react';
import { copy, TYPE_COND, TYPE_NAME } from '@/copy/ru';
import { formatPrice, MAX_PARTICIPANTS, TICKET_PRICES, type TicketType } from '@/domain';
import { useOrderStore } from '@/state/orderStore';
import { Counter } from '@/components/ui/Counter';
import { Logo } from '@/components/ui/Logo';
import { TicketGlyph } from '@/components/ui/TicketGlyph';
import { useStepFocus } from './useStepFocus';

function TicketCard({ type, onLimit }: { type: TicketType; onLimit(): void }) {
  const plan = useOrderStore((s) => s.plan);
  const increment = useOrderStore((s) => s.increment);
  const decrement = useOrderStore((s) => s.decrement);
  const count = plan[type];
  // DES-05: "a child needs a full ticket" lives right in the child card, next to the counter
  // that caused it — always in view (also on 320×700), with the one-click fix inline
  const childOnly = type === 'child' && count > 0 && plan.full === 0;
  const total = plan.full + plan.child;
  const titleId = `ticket-${type}-title`;
  // INV-05: adding a child ticket lights up the "only with an adult" rule — attention, not a block
  const [rulePing, setRulePing] = useState(0);

  return (
    <article className={clsx('ticket-card', `ticket-card--${type}`, count > 0 && 'is-selected')} aria-labelledby={titleId}>
      <div className="ticket-card__text">
        <h2 className="ticket-card__title" id={titleId}>
          {TYPE_NAME[type]}
        </h2>
        <p className="ticket-card__cond">{TYPE_COND[type]}</p>
      </div>
      <p className="ticket-card__price tabular">{formatPrice(TICKET_PRICES[type])}</p>
      <div className="ticket-card__glyph">
        <TicketGlyph type={type} count={count} alert={type === 'child' && count > 0 && plan.full === 0} />
      </div>
      {type === 'child' &&
        (childOnly ? (
          <div className="ticket-card__rule is-error" role="alert">
            <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{copy.tickets.childOnly}</span>
            <button type="button" className="inline-action" data-error-focus onClick={() => increment('full')}>
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              {copy.tickets.childOnlyFix}
            </button>
          </div>
        ) : (
          <p className={clsx('ticket-card__rule', rulePing > 0 && 'is-ping')} key={rulePing}>
            <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{copy.tickets.childRule}</span>
          </p>
        ))}
      <div className="ticket-card__counter">
        <Counter
          value={count}
          canDec={count > 0}
          canInc={total < MAX_PARTICIPANTS}
          onInc={() => {
            increment(type);
            if (type === 'child') setRulePing((n) => n + 1);
          }}
          onDec={() => decrement(type)}
          onBlockedInc={onLimit}
          groupLabel={copy.tickets.counterGroup(type)}
          incLabel={copy.tickets.inc(type)}
          decLabel={copy.tickets.dec(type)}
          valueLabel={`${TYPE_NAME[type]}: ${count}`}
          incBlockedHint={copy.tickets.limitReached}
        />
      </div>
    </article>
  );
}

/** 02 · ticket counters. Counters reflect the participant list (single source of truth). */
export function TicketsStep() {
  const titleRef = useStepFocus();
  const plan = useOrderStore((s) => s.plan);
  const [limitHit, setLimitHit] = useState(0);
  const total = plan.full + plan.child;
  const atLimit = total >= MAX_PARTICIPANTS;

  return (
    <section className="step step--tickets" aria-labelledby="step-title">
      <Logo compact className="step__lockup" />
      <h1 className="step__title" id="step-title" tabIndex={-1} ref={titleRef}>
        {copy.tickets.title}
      </h1>

      <div className="ticket-list">
        <TicketCard type="full" onLimit={() => setLimitHit((n) => n + 1)} />
        <TicketCard type="child" onLimit={() => setLimitHit((n) => n + 1)} />
      </div>

      <p className={clsx('step__note', atLimit && 'step__note--warning')} aria-live="polite" key={limitHit}>
        {atLimit ? copy.tickets.limitReached : copy.tickets.limit}
      </p>
    </section>
  );
}
