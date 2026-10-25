import { useEffect } from 'react';
import clsx from 'clsx';
import { PencilLine, RefreshCw } from 'lucide-react';
import { copy, TYPE_SHORT } from '@/copy/ru';
import { effectiveTicketType, formatPrice, normalizeEmail, normalizeName, TICKET_PRICES } from '@/domain';
import type { ApiScenario } from '@/data/mockApi';
import { useOrderStore } from '@/state/orderStore';
import { Banner } from '@/components/ui/Banner';
import { IconButton } from '@/components/ui/Button';
import { useStepFocus } from './useStepFocus';

const SCENARIOS: { value: ApiScenario; label: string }[] = [
  { value: 'normal', label: copy.demo.ok },
  { value: 'soldout', label: copy.demo.soldout },
  { value: 'partial', label: copy.demo.partial },
];

/**
 * 04 · order review: who goes (type + price per person), where the tickets go, demo switch.
 * The total sits in the action bar right above "Подтвердить заказ" on every width (DES-02);
 * one edit pattern — a pencil per row (SLOP-07/08/24).
 */
export function SummaryStep() {
  const titleRef = useStepFocus();
  const participants = useOrderStore((s) => s.participants);
  const email = useOrderStore((s) => s.email);
  const phase = useOrderStore((s) => s.phase);
  const error = useOrderStore((s) => s.error);
  const scenario = useOrderStore((s) => s.scenario);
  const setScenario = useOrderStore((s) => s.setScenario);
  const editField = useOrderStore((s) => s.editField);
  const confirm = useOrderStore((s) => s.confirm);
  const busy = phase !== 'idle';

  // the success screen uses the handwritten face — fetch it while the user reviews
  useEffect(() => {
    void import('@fontsource/bad-script/400.css');
  }, []);

  return (
    <section className={clsx('step step--summary', busy && 'is-busy')} aria-labelledby="step-title" aria-busy={busy || undefined}>
      <h1 className="step__title" id="step-title" tabIndex={-1} ref={titleRef}>
        {copy.review.title}
      </h1>

      {error && (
        <Banner
          tone="danger"
          actions={
            <button type="button" className="inline-action" data-error-focus onClick={() => void confirm()}>
              <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
              {copy.network.retry}
            </button>
          }
        >
          <strong>{copy.network.title}.</strong> {copy.network.text}
        </Banner>
      )}

      <div className="review" inert={busy}>
        <section className="review__section" aria-labelledby="review-people">
          <header className="review__head">
            <h2 id="review-people" className="review__h2">
              {copy.review.people}
            </h2>
          </header>
          <ul className="outline-card review-people">
            {participants.map((p) => {
              const t = effectiveTicketType(p);
              const name = normalizeName(p.name);
              return (
                <li key={p.id} className="review-person">
                  <div className="review-person__text">
                    <p className="review-person__name">{copy.review.person(name, p.age ?? 0)}</p>
                    <p className={`review-person__meta review-person__meta--${t}`}>{TYPE_SHORT[t]}</p>
                  </div>
                  <p className="review-person__price tabular">{formatPrice(TICKET_PRICES[t])}</p>
                  <IconButton label={copy.review.editPerson(name)} onClick={() => editField(`p-${p.id}-name`)}>
                    <PencilLine size={20} strokeWidth={1.5} aria-hidden="true" />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="review__section" aria-labelledby="review-email">
          <div className="outline-card review-contact">
            <div>
              <h2 id="review-email" className="review-contact__label">
                {copy.review.email}
              </h2>
              <p className="review-contact__email">{normalizeEmail(email)}</p>
            </div>
            <IconButton label={copy.review.editEmail} onClick={() => editField('email')}>
              <PencilLine size={20} strokeWidth={1.5} aria-hidden="true" />
            </IconButton>
          </div>
        </section>

        <fieldset className="demo-switch">
          <legend className="demo-switch__legend">{copy.demo.label}</legend>
          {SCENARIOS.map((o) => (
            <label key={o.value} className="demo-switch__opt">
              <input type="radio" name="demo-scenario" value={o.value} checked={scenario === o.value} onChange={() => setScenario(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
          <p className="demo-switch__note">{copy.review.demo}</p>
        </fieldset>
      </div>

      {busy && (
        <p className="review__phase" aria-hidden="true">
          {phase === 'reserving' ? copy.review.phaseReserving : copy.review.phaseConfirming}
        </p>
      )}
    </section>
  );
}
