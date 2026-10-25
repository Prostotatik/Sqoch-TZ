/**
 * Russian typography for UI strings (anti-slop guidelines §NBSP).
 * Written as escapes on purpose: an editor/formatter must not turn the character back into a space.
 */
export const NBSP = ' ';

/** Short words that must not hang at the end of a line (prepositions, conjunctions, particles). */
const SHORT_WORDS = 'в|во|с|со|к|ко|о|об|у|и|а|но|на|от|до|из|за|не|ни|по|без|для|при|про|над|под|из-за';
const SHORT_WORD_RE = new RegExp(`(?<=^|[\\s«(„"])(${SHORT_WORDS}) +`, 'giu');
/** "18 лет", "4 участника", "2 000 ₽": a number never parts from what it counts. */
const NUMBER_UNIT_RE = /(\d) +(?=[\p{L}₽%])/gu;
/** "№ 12", "Шаг 1": a label never parts from its number. */
const LABEL_NUMBER_RE = /(№|[Шш]аг|[Уу]частник) +(?=\d)/gu;
/** Particles stick to the previous word: «этого же», «если бы». */
const PARTICLE_RE = / +(же|ли|бы)(?=$|[\s.,:;!?»)])/gu;
/** Dash and middle-dot separators stick to the previous word. */
const DASH_RE = / +(—|·)/g;

/** Binds short words, numbers and separators with NBSP. Idempotent. */
export function typo(text: string): string {
  return text
    .replace(SHORT_WORD_RE, `$1${NBSP}`)
    .replace(NUMBER_UNIT_RE, `$1${NBSP}`)
    .replace(LABEL_NUMBER_RE, `$1${NBSP}`)
    .replace(PARTICLE_RE, `${NBSP}$1`)
    .replace(DASH_RE, `${NBSP}$1`);
}

type Typo<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Typo<R>
    : T extends readonly unknown[]
      ? { readonly [K in keyof T]: Typo<T[K]> }
      : T extends object
        ? { [K in keyof T]: Typo<T[K]> }
        : T;

/** Applies `typo` to every string of a dictionary, including the results of its functions. */
export function typoDeep<T>(value: T): Typo<T> {
  if (typeof value === 'string') return typo(value) as Typo<T>;
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    return ((...args: unknown[]) => typoDeep(fn(...args))) as Typo<T>;
  }
  if (Array.isArray(value)) return value.map((v) => typoDeep(v)) as Typo<T>;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = typoDeep(v);
    return out as Typo<T>;
  }
  return value as Typo<T>;
}

/** Plain-space short word at a line-breakable position (used by tests to catch regressions). */
export const HANGING_RE = new RegExp(`(?:^|[\\s«(])(${SHORT_WORDS}) `, 'iu');
