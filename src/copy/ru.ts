/**
 * UI copy. Source: agents-anti-AI-slop/guidelines.md §3 + review-01 (final per orchestrator decision 2).
 * Typography: the whole dictionary goes through `typoDeep` (domain/typography.ts) — NBSP (U+00A0)
 * after short words, between a number and its unit, before «—» and «·». Strings are written with
 * plain spaces on purpose; the binding is mechanical and covered by a test (copy/ru.test.ts).
 * En dash for ranges, «ёлочки», ё everywhere.
 */
import { FESTIVAL_EVENT } from '@/data/event';
import {
  ADULT_MIN_AGE,
  errorMessage,
  formatPrice,
  MAX_PARTICIPANTS,
  NBSP,
  normalizeName,
  plural,
  TICKET_PRICES,
  typo,
  typoDeep,
  type FieldError,
  type Participant,
  type SeatAdvice,
  type TicketType,
} from '@/domain';

/** Non-breaking space (U+00A0). Exported so a test can pin it — it once silently became U+0020. */
export const N = NBSP;

export const ageWord = (n: number) => plural(n, ['год', 'года', 'лет']);
export const ticketsWord = (n: number) => plural(n, ['билет', 'билета', 'билетов']);
export const participantsWord = (n: number) => plural(n, ['участник', 'участника', 'участников']);
export const seatsWord = (n: number) => plural(n, ['место', 'места', 'мест']);
const participantsAcc = (n: number) => plural(n, ['участника', 'участников', 'участников']);
const fieldsWord = (n: number) => plural(n, ['поле', 'поля', 'полей']);

/** «Иван», «Иван и Маша», «Иван, Маша и Петя». */
export function joinNames(people: readonly Participant[]): string {
  const names = people.map((p) => normalizeName(p.name) || 'участник');
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`;
}

export const TYPE_NAME: Record<TicketType, string> = { full: 'Полный', child: 'Детский' };
export const TYPE_SHORT: Record<TicketType, string> = { full: 'полный', child: 'детский' };
export const TYPE_COND: Record<TicketType, string> = typoDeep({ full: 'от 14 лет', child: 'младше 14 лет' });

const dict = {
  brand: 'Neon Waves',
  dates: FESTIVAL_EVENT.dates.label,
  venue: FESTIVAL_EVENT.venue.label,

  home: {
    sloganLines: ['More', 'music', 'more', 'life'],
    sloganAria: 'More music, more life',
    cta: 'Купить билеты',
    ctaNote: `от ${formatPrice(TICKET_PRICES.child)} · до ${MAX_PARTICIPANTS} участников в заказе`,
    factsTitle: `${FESTIVAL_EVENT.venue.name}, ${FESTIVAL_EVENT.dates.short}`,
    factsMeta: `${FESTIVAL_EVENT.venue.city} · суббота и воскресенье`,
    pricesTitle: 'Билеты',
    pricesLead: `До ${MAX_PARTICIPANTS} участников в заказе. Email — один на всех`,
    childRule: `Ребёнок проходит только вместе со взрослым от ${ADULT_MIN_AGE} лет из этого же заказа`,
    copyright: `© ${FESTIVAL_EVENT.dates.start.slice(0, 4)} Neon Waves`,
    legal: ['Политика конфиденциальности', 'Использование cookie', 'Пользовательское соглашение', 'Возврат билетов'],
  },

  steps: {
    names: ['Билеты', 'Участники', 'Проверка'] as const,
    label: (n: number) => `Шаг ${n} из 3`,
    aria: 'Шаги оформления',
    back: 'Назад',
    close: 'Закрыть оформление',
  },

  tickets: {
    title: 'Билеты',
    childRule: `Только вместе со взрослым от ${ADULT_MIN_AGE} лет из этого же заказа`,
    limit: `В одном заказе до ${MAX_PARTICIPANTS} участников`,
    limitReached: 'Это максимум. Для пятого участника оформите второй заказ',
    dec: (t: TicketType) => `Убрать один ${TYPE_SHORT[t]} билет`,
    inc: (t: TicketType) => `Добавить один ${TYPE_SHORT[t]} билет`,
    counterGroup: (t: TicketType) => `Количество: ${TYPE_SHORT[t]} билет`,
    childOnly: 'Добавьте полный билет: ребёнок проходит только со взрослым',
    childOnlyFix: 'Добавить полный',
    empty: 'Выберите билеты',
    total: 'Итого',
    count: (n: number) => `${n} ${ticketsWord(n)}`,
    next: 'Дальше',
  },

  people: {
    title: 'Участники',
    lead: 'Для каждого нужны имя и возраст. Email — один на весь заказ',
    cardTitle: (n: number) => `Участник ${n}`,
    typeLegend: 'Билет',
    nameLabel: 'Имя',
    ageLabel: 'Возраст',
    adultBadge: 'Может сопровождать детей',
    add: 'Добавить участника',
    addFull: `Полный · ${formatPrice(TICKET_PRICES.full)}`,
    addChild: `Детский · ${formatPrice(TICKET_PRICES.child)}`,
    addMax: `В заказе уже ${MAX_PARTICIPANTS} участника — это максимум`,
    remove: (n: number) => `Убрать участника ${n}`,
    removed: (n: number) => `Участник ${n} убран`,
    undo: 'Вернуть',
    emailLabel: 'Email',
    emailHint: 'Пришлём сюда билеты всех участников',
    emailPlaceholder: 'you@example.com',
    next: 'Проверить заказ',
    switchTo: (t: TicketType) => `Сменить на ${TYPE_SHORT[t]}`,
    /** A 14–17 teen holds the only full ticket: say so by name instead of re-telling the rule. */
    adultTeen: (name: string, age: number) =>
      `${name} — ${age} ${ageWord(age)}, а сопровождать детей можно с ${ADULT_MIN_AGE}. Добавьте взрослого или исправьте возраст`,
    adultNone: `Детям нужен взрослый от ${ADULT_MIN_AGE} лет в этом же заказе`,
    adultMissingFixAdd: 'Добавить взрослого',
    adultMissingFixAge: 'Исправить возраст',
    seatLimitOk: (limit: number) => `Теперь заказ помещается в ${limit} ${seatsWord(limit)}`,
    keep: (people: readonly Participant[]) => `Оставить: ${joinNames(people)}`,
    fieldsLeft: (n: number) => `Осталось исправить ${n} ${fieldsWord(n)}`,
    orderOnly: `Нужен взрослый от ${ADULT_MIN_AGE} лет — см. сообщение выше`,
  },

  review: {
    title: 'Проверьте заказ',
    people: 'Участники',
    email: 'Билеты придут на',
    editPerson: (name: string) => `Изменить данные: ${name}`,
    editEmail: 'Изменить email',
    person: (name: string, age: number) => `${name}, ${age} ${ageWord(age)}`,
    confirm: 'Подтвердить заказ',
    confirming: 'Оформляем…',
    phaseReserving: 'Бронируем места…',
    phaseConfirming: 'Подтверждаем заказ…',
    demo: 'Демо: деньги не списываются',
  },

  demo: {
    label: 'Сценарий демо',
    ok: 'Места есть',
    soldout: 'Места закончатся при подтверждении',
    partial: 'Мест останется меньше, чем в заказе',
  },

  success: {
    title: 'Заказ оформлен',
    text: (email: string) => `Билеты отправили на ${email}`,
    order: (id: string) => `Заказ № ${id}`,
    ticketMeta: (t: TicketType, age: number) => `${TYPE_SHORT[t]} · ${age} ${ageWord(age)}`,
    script: 'Увидимся на фестивале',
    calendar: 'Добавить в календарь',
    home: 'На главную',
    again: 'Купить ещё билеты',
    ticketsHeading: 'Билеты',
    qrAlt: (name: string) => `QR-код билета: ${name}`,
  },

  soldout: {
    title: 'Билеты закончились',
    text: 'Пока вы заполняли данные, последние места раскупили. Заказ не оформлен',
    home: 'На главную',
    notify: 'Сообщить, когда появятся места',
    notified: (email: string) => `Напишем на ${email}, если кто-то вернёт билеты`,
    partialTitle: 'Мест стало меньше',
    partialFix: 'Изменить заказ',
  },

  network: {
    title: 'Не получилось отправить заказ',
    text: 'Проверьте интернет и попробуйте ещё раз, данные на месте',
    retry: 'Повторить',
  },
};

export const copy = typoDeep(dict);

/**
 * SLOP-10: what to say when fewer seats are left than people in the order. Built from the valid
 * options (domain/seats.ts), so the advice never leads to «a child without an adult».
 */
export function seatAdviceText(a: SeatAdvice, inOrder: number): string {
  const left = `Осталось ${a.limit} ${seatsWord(a.limit)}`;
  let text: string;
  if (a.only) {
    const verb = a.only.length === 1 ? 'может остаться только' : 'могут остаться только';
    text = `${left}. Детский билет без взрослого оформить нельзя, поэтому в заказе ${verb} ${joinNames(a.only)}`;
  } else {
    text = `${left}, а в заказе ${inOrder}. Уберите ${a.excess} ${participantsAcc(a.excess)}, данные остальных сохранятся`;
    if (a.childrenOut) text += '. Детский билет без взрослого оформить нельзя, поэтому детей тоже придётся убрать';
    else if (a.mustKeep.length > 0) text += `. ${joinNames(a.mustKeep)} — не убирайте: детям нужен взрослый из этого заказа`;
  }
  return typo(text);
}

/** Field-specific wording for generic validation codes. */
export function fieldError(field: 'name' | 'age' | 'email', code: FieldError): string {
  if (code === 'required') {
    if (field === 'name') return 'Впишите имя';
    if (field === 'age') return 'Укажите возраст';
    return typo('Укажите email, на него придут билеты');
  }
  return errorMessage(code);
}
