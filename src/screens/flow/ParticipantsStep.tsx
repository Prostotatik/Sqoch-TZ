import { useEffect, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { Mail, Plus, Trash2 } from 'lucide-react';
import { ageWord, copy, fieldError, seatAdviceText, TYPE_NAME, TYPE_SHORT } from '@/copy/ru';
import {
  effectiveTicketType,
  formatPrice,
  hasValidAge,
  isAdult,
  isChild,
  MAX_PARTICIPANTS,
  normalizeName,
  parseAge,
  seatAdvice,
  TICKET_PRICES,
  type Participant,
  type ParticipantErrors,
  type TicketType,
} from '@/domain';
import { useOrderStore, useOrderValidation } from '@/state/orderStore';
import { Banner } from '@/components/ui/Banner';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { ease } from '@/motion/tokens';
import { useStepFocus } from './useStepFocus';

// SLOP-04: the price lives inside the type switch (no duplicate chip in the card header)
const TYPE_OPTIONS: { value: TicketType; label: string; sub: string }[] = (['full', 'child'] as const).map((t) => ({
  value: t,
  label: TYPE_NAME[t],
  sub: formatPrice(TICKET_PRICES[t]),
}));

function ParticipantCard({
  p,
  index,
  errors,
  showErrors,
  canRemove,
  needsAdult,
  hasChildren,
}: {
  p: Participant;
  index: number;
  errors: ParticipantErrors | undefined;
  showErrors: boolean;
  canRemove: boolean;
  needsAdult: boolean;
  /** The order has a child ticket — only then the "can accompany children" note means something. */
  hasChildren: boolean;
}) {
  const update = useOrderStore((s) => s.updateParticipant);
  const setType = useOrderStore((s) => s.setTicketType);
  const remove = useOrderStore((s) => s.removeParticipant);
  const attempt = useOrderStore((s) => s.attempt);
  const [touched, setTouched] = useState<{ name?: boolean; age?: boolean }>({});
  const [ageRaw, setAgeRaw] = useState(() => (p.age === null || Number.isNaN(p.age) ? '' : String(p.age)));
  const type = effectiveTicketType(p);
  const n = index + 1;
  const nameId = `p-${p.id}-name`;
  const ageId = `p-${p.id}-age`;

  // external age changes (undo) keep the raw input in sync
  useEffect(() => {
    const parsed = parseAge(ageRaw);
    if (parsed !== p.age && !(Number.isNaN(parsed) && Number.isNaN(p.age))) {
      setAgeRaw(p.age === null || Number.isNaN(p.age) ? '' : String(p.age));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.age]);

  const nameErr = (showErrors || touched.name) && errors?.name ? fieldError('name', errors.name) : null;
  const ageCode = errors?.age;
  const mismatch = ageCode === 'age_full_too_young' || ageCode === 'age_child_too_old';
  const ageErr = (showErrors || touched.age) && ageCode ? fieldError('age', ageCode) : null;
  const fixType: TicketType = ageCode === 'age_full_too_young' ? 'child' : 'full';
  const delta = fixType === 'child' ? TICKET_PRICES.child - TICKET_PRICES.full : TICKET_PRICES.full - TICKET_PRICES.child;
  const adult = isAdult(p);

  return (
    <article
      className={clsx('person-card', needsAdult && isChild(p) && 'person-card--alert')}
      aria-labelledby={`p-${p.id}-title`}
    >
      <header className="person-card__head">
        <h2 className="person-card__title" id={`p-${p.id}-title`}>
          {copy.people.cardTitle(n)}
          <span className="visually-hidden">, {TYPE_SHORT[type]} билет</span>
        </h2>
        <IconButton
          label={copy.people.remove(n)}
          tone="danger"
          className="person-card__remove"
          onClick={() => remove(p.id)}
          disabled={!canRemove}
        >
          <Trash2 size={20} strokeWidth={1.5} aria-hidden="true" />
        </IconButton>
      </header>

      <Segmented
        name={`type-${p.id}`}
        id={`p-${p.id}-type`}
        legend={`${copy.people.typeLegend}: ${copy.people.cardTitle(n)}`}
        value={type}
        options={TYPE_OPTIONS}
        onChange={(v) => setType(p.id, v)}
      />

      <Field
        id={nameId}
        label={copy.people.nameLabel}
        value={p.name}
        autoComplete={index === 0 ? 'name' : 'off'}
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={80}
        onChange={(e) => update(p.id, { name: e.target.value })}
        onBlur={() => setTouched((t) => ({ ...t, name: true }))}
        error={nameErr}
        shakeKey={attempt}
      />

      <Field
        id={ageId}
        label={copy.people.ageLabel}
        value={ageRaw}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={3}
        autoComplete="off"
        enterKeyHint="next"
        className="field--age"
        suffix={ageRaw && !Number.isNaN(Number(ageRaw)) ? ageWord(Number(ageRaw)) : 'лет'}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
          setAgeRaw(digits);
          update(p.id, { age: parseAge(digits) });
        }}
        onBlur={() => setTouched((t) => ({ ...t, age: true }))}
        error={ageErr}
        errorAction={
          mismatch ? (
            <button type="button" className="inline-action inline-action--strong" onClick={() => setType(p.id, fixType)}>
              {copy.people.switchTo(fixType)}{' '}
              <span className="tabular">({delta > 0 ? '+' : ''}{formatPrice(delta)})</span>
            </button>
          ) : undefined
        }
        shakeKey={attempt}
        hint={adult && hasChildren ? <span className="badge-adult">{copy.people.adultBadge}</span> : undefined}
      />
    </article>
  );
}

/** 03 · participants: name + age each, one email, add/remove (1–4), inline one-click fixes. */
export function ParticipantsStep() {
  const titleRef = useStepFocus();
  const reduced = useReducedMotion();
  const participants = useOrderStore((s) => s.participants);
  const email = useOrderStore((s) => s.email);
  const setEmail = useOrderStore((s) => s.setEmail);
  const showErrors = useOrderStore((s) => s.showErrors);
  const attempt = useOrderStore((s) => s.attempt);
  const addParticipant = useOrderStore((s) => s.addParticipant);
  const requestFocus = useOrderStore((s) => s.requestFocus);
  const seatLimit = useOrderStore((s) => s.seatLimit);
  const focusRequest = useOrderStore((s) => s.focusRequest);
  const validation = useOrderValidation();
  const [emailTouched, setEmailTouched] = useState(false);

  const needsAdult = showErrors && validation.order.includes('child_without_adult');
  const full = participants.length >= MAX_PARTICIPANTS;
  const emailErr = (showErrors || emailTouched) && validation.email ? fieldError('email', validation.email) : null;
  // a teen (14–17) with a valid age holds a full ticket: name them instead of re-telling the rule (SLOP-06)
  const teen = participants.find((p) => effectiveTicketType(p) === 'full' && hasValidAge(p) && !isAdult(p) && !isChild(p));
  const hasChildren = participants.some((p) => effectiveTicketType(p) === 'child' || isChild(p));
  const overLimit = seatLimit !== null && participants.length > seatLimit;
  const keepOnly = useOrderStore((s) => s.keepOnly);
  const advice = overLimit ? seatAdvice(participants, seatLimit) : null;

  // focus a freshly added participant's name (requested by the store)
  useEffect(() => {
    if (!focusRequest) return;
    const el = document.getElementById(focusRequest);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    requestFocus(null);
  }, [focusRequest, participants.length, requestFocus, reduced]);

  return (
    <section className="step step--people" aria-labelledby="step-title">
      <h1 className="step__title" id="step-title" tabIndex={-1} ref={titleRef}>
        {copy.people.title}
      </h1>
      <p className="step__lead">{copy.people.lead}</p>

      {seatLimit !== null && (
        <Banner
          tone={overLimit ? 'warning' : 'info'}
          id="seat-banner"
          focusable={overLimit}
          actions={
            advice?.only ? (
              <button type="button" className="inline-action" data-error-focus onClick={() => keepOnly(advice.only!.map((p) => p.id))}>
                {copy.people.keep(advice.only)}
              </button>
            ) : undefined
          }
        >
          {advice ? seatAdviceText(advice, participants.length) : copy.people.seatLimitOk(seatLimit)}
        </Banner>
      )}

      {needsAdult && (
        <Banner
          tone="danger"
          id="adult-banner"
          actions={
            <>
              {teen && (
                <button
                  type="button"
                  className="inline-action"
                  data-error-focus
                  onClick={() => {
                    const el = document.getElementById(`p-${teen.id}-age`);
                    el?.focus({ preventScroll: true });
                    el?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
                  }}
                >
                  {copy.people.adultMissingFixAge}
                </button>
              )}
              {!full && (
                <button type="button" className="inline-action" data-error-focus={teen ? undefined : true} onClick={() => addParticipant('full')}>
                  <Plus size={16} strokeWidth={2} aria-hidden="true" />
                  {copy.people.adultMissingFixAdd}
                </button>
              )}
            </>
          }
        >
          {teen ? copy.people.adultTeen(normalizeName(teen.name) || copy.people.cardTitle(participants.indexOf(teen) + 1), teen.age as number) : copy.people.adultNone}
        </Banner>
      )}

      <m.ol className="person-list" layout={!reduced}>
        <AnimatePresence initial={false}>
          {participants.map((p, i) => (
            <m.li
              key={p.id}
              layout={!reduced}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, transition: { duration: 0.2, ease: ease.in } }}
              transition={{ duration: 0.3, ease: ease.outExpo }}
            >
              <ParticipantCard
                p={p}
                index={i}
                errors={validation.participants[p.id]}
                showErrors={showErrors}
                canRemove={participants.length > 1}
                needsAdult={needsAdult}
                hasChildren={hasChildren}
              />
            </m.li>
          ))}
        </AnimatePresence>
      </m.ol>

      <m.div className="add-person" layout={!reduced}>
        {full ? (
          <p className="add-person__max">{copy.people.addMax}</p>
        ) : (
          <>
            <p className="add-person__label" id="add-person-label">
              {copy.people.add}
            </p>
            <div className="add-person__row" role="group" aria-labelledby="add-person-label">
              <button type="button" className="btn btn--ghost" onClick={() => addParticipant('full')}>
                <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
                <span className="tabular">{copy.people.addFull}</span>
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => addParticipant('child')}>
                <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
                <span className="tabular">{copy.people.addChild}</span>
              </button>
            </div>
          </>
        )}
      </m.div>

      <m.div className="email-block" layout={!reduced}>
        <Field
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          autoCapitalize="none"
          label={copy.people.emailLabel}
          placeholder={copy.people.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          error={emailErr}
          valid={emailTouched && !validation.email}
          icon={<Mail size={18} strokeWidth={1.5} />}
          hint={copy.people.emailHint}
          shakeKey={attempt}
        />
      </m.div>
    </section>
  );
}
