import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { m, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { copy, TYPE_COND, TYPE_NAME } from '@/copy/ru';
import { FESTIVAL_EVENT } from '@/data/event';
import { formatPrice, TICKET_PRICES, typo, type TicketType } from '@/domain';
import { useFontsReady } from '@/hooks/useFontsReady';
import { useMagnetic } from '@/hooks/useMagnetic';
import { ease } from '@/motion/tokens';
import { portalFrom } from '@/motion/fx';
import { scrollToTop } from '@/motion/scrollTop';
import { useOrderStore } from '@/state/orderStore';
import { Logo } from '@/components/ui/Logo';

/** INV-02: the reveal waits for the display font *and* the decoded hero photo (no jump, no FOUT). */
function useHeroReady(img: React.RefObject<HTMLImageElement | null>) {
  const fonts = useFontsReady();
  const [decoded, setDecoded] = useState(false);
  useEffect(() => {
    const el = img.current;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setDecoded(true);
      }
    };
    const timer = window.setTimeout(finish, 1500);
    if (!el) finish();
    else {
      const loaded = el.complete ? Promise.resolve() : new Promise((r) => el.addEventListener('load', r, { once: true }));
      loaded
        .then(() => el.decode())
        .catch(() => undefined)
        .then(finish);
    }
    return () => window.clearTimeout(timer);
  }, [img]);
  return fonts && decoded;
}

/** One slogan line: masked reveal + its own parallax speed (lines drift apart while scrolling). */
function SloganLine({ text, i, ready, reduced, scrollY }: { text: string; i: number; ready: boolean; reduced: boolean; scrollY: MotionValue<number> }) {
  const y = useTransform(scrollY, (v) => (reduced ? 0 : -v * 0.035 * i));
  const reveal = reduced
    ? { initial: { opacity: 0 }, animate: ready ? { opacity: 1 } : undefined, transition: { duration: 0.15 } }
    : {
        initial: { y: '110%' },
        animate: ready ? { y: '0%' } : undefined,
        transition: { delay: 0.15 + i * 0.08, duration: 0.7, ease: ease.outExpo },
      };
  return (
    <m.span className="hero__line" aria-hidden="true" style={{ y }}>
      <m.span className="hero__line-inner" {...reveal}>
        {text}
      </m.span>
    </m.span>
  );
}

/** The one "buy" control of the landing (SLOP-19): the same magnetic pill in the hero and under the prices. */
function PillCta({
  onClick,
  className,
  btnRef,
}: {
  onClick(e: MouseEvent<HTMLButtonElement>): void;
  className?: string;
  btnRef?: React.Ref<HTMLButtonElement>;
}) {
  const mag = useMagnetic<HTMLSpanElement>(90, 0.3);
  return (
    <m.span ref={mag.ref} className={`pill-wrap${className ? ` ${className}` : ''}`} style={mag.enabled ? { x: mag.x, y: mag.y } : undefined}>
      <button ref={btnRef} type="button" className="pill-cta" onClick={onClick}>
        <span>{copy.home.cta}</span>
        <ArrowRight className="pill-cta__arrow" size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </m.span>
  );
}

function HeroCta({
  onClick,
  ready,
  btnRef,
}: {
  onClick(e: MouseEvent<HTMLButtonElement>): void;
  ready: boolean;
  btnRef: React.Ref<HTMLButtonElement>;
}) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className="hero__cta"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={ready ? { opacity: 1, y: 0 } : undefined}
      transition={{ delay: reduced ? 0 : 0.75, duration: 0.6, ease: ease.outExpo }}
    >
      <PillCta onClick={onClick} btnRef={btnRef} />
      <p className="hero__note tabular">{copy.home.ctaNote}</p>
    </m.div>
  );
}

function PriceRow({ type }: { type: TicketType }) {
  return (
    <li className={`price-row price-row--${type}`}>
      <div>
        <p className="price-row__name">{TYPE_NAME[type]}</p>
        <p className="price-row__cond">{TYPE_COND[type]}</p>
      </div>
      <p className="price-row__value tabular">{formatPrice(TICKET_PRICES[type])}</p>
      {type === 'child' && (
        <p className="price-row__rule">
          <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
          {copy.home.childRule}
        </p>
      )}
    </li>
  );
}

/**
 * 01 · Landing: photo hero (+ the shared 3D layer behind the text), chrome slogan with a
 * masked line reveal, magnetic pill CTA; then concrete facts over the stage photo and prices.
 */
export function Landing({ hidden, inert }: { hidden: boolean; inert: boolean }) {
  const startFlow = useOrderStore((s) => s.start);
  const reduced = useReducedMotion() ?? false;
  const heroRef = useRef<HTMLElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const ready = useHeroReady(imgRef);
  const heroCtaRef = useRef<HTMLButtonElement>(null);
  const starting = useRef(false);
  // INV-03: the purchase starts "through the portal" from the hero button. Pressed further down the
  // page, the landing first glides back to the hero, so the ring flies into the flow from where it lives
  // instead of appearing out of nowhere over the text below.
  const start = async (e: MouseEvent<HTMLButtonElement>) => {
    if (starting.current) return;
    starting.current = true;
    const pressed = e.currentTarget;
    try {
      if (window.scrollY > 4) await scrollToTop();
      portalFrom(heroCtaRef.current ?? pressed);
      startFlow();
    } finally {
      starting.current = false;
    }
  };
  const { scrollY } = useScroll();
  // layered scroll parallax (spec §3.1): photo slow, text faster
  const photoY = useTransform(scrollY, (v) => (reduced ? 0 : v * 0.6));
  const photoScale = useTransform(scrollY, [0, 900], reduced ? [1, 1] : [1.04, 1.12]);
  const textY = useTransform(scrollY, (v) => (reduced ? 0 : v * -0.12));

  return (
    <main className="landing" hidden={hidden} inert={inert} id={hidden || inert ? undefined : 'main'}>
      <section className="hero" ref={heroRef}>
        <m.div className="hero__photo" style={{ y: photoY, scale: photoScale }} aria-hidden="true">
          <picture>
            <source media="(max-width: 640px)" srcSet="/assets/hero-crowd-mobile.webp" />
            <img
              ref={imgRef}
              src="/assets/hero-crowd-1280.webp"
              srcSet="/assets/hero-crowd-1280.webp 1280w, /assets/hero-crowd.webp 2400w"
              sizes="100vw"
              alt=""
              fetchPriority="high"
              decoding="async"
            />
          </picture>
        </m.div>
        <div className="hero__shade" aria-hidden="true" />

        <m.div className="hero__inner" style={{ y: textY }}>
          <m.header
            className="hero__top"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={ready ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.4, ease: ease.out }}
          >
            <Logo as="h1" className="hero__logo" />
          </m.header>

          <div className="hero__bottom">
            <p className="hero__slogan" aria-label={copy.home.sloganAria} lang="en">
              {copy.home.sloganLines.map((line, i) => (
                <SloganLine key={i} text={line} i={i} ready={ready} reduced={reduced} scrollY={scrollY} />
              ))}
            </p>
            <HeroCta onClick={start} ready={ready} btnRef={heroCtaRef} />
          </div>
        </m.div>
      </section>

      <section className="info" aria-labelledby="facts-title">
        <div className="info__media">
          <picture>
            <source media="(max-width: 640px)" srcSet="/assets/stage-arch-mobile.webp" />
            <img src="/assets/stage-arch-1280.webp" alt="" loading="lazy" decoding="async" />
          </picture>
          <svg className="info__arcs" viewBox="0 0 400 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <defs>
              <linearGradient id="arc-grad" x1="0" x2="1">
                <stop offset="0" stopColor="#7f4bda" />
                <stop offset=".5" stopColor="#e06aca" />
                <stop offset="1" stopColor="#f19a59" />
              </linearGradient>
            </defs>
            {[150, 120, 92].map((r, i) => (
              <m.path
                key={r}
                d={`M ${200 - r} 260 A ${r} ${r} 0 0 1 ${200 + r} 260`}
                fill="none"
                stroke="url(#arc-grad)"
                strokeWidth={i === 0 ? 2.5 : 1.5}
                strokeLinecap="round"
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 0.9 - i * 0.2 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 1.4, delay: i * 0.15, ease: ease.inOut }}
              />
            ))}
          </svg>
          <div className="info__media-text">
            <h2 className="info__title" id="facts-title">
              {copy.home.factsTitle}
            </h2>
            <p className="info__meta">{copy.home.factsMeta}</p>
          </div>
        </div>

        <p className="facts tabular">
          {FESTIVAL_EVENT.facts.map((f, i) => (
            <m.span
              className="fact"
              key={f}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: ease.outExpo }}
            >
              {typo(f)}
            </m.span>
          ))}
        </p>

        <section className="prices" aria-labelledby="prices-title">
          <h2 className="prices__title" id="prices-title">
            {copy.home.pricesTitle}
          </h2>
          <p className="prices__lead">{copy.home.pricesLead}</p>
          <ul className="prices__list">
            <PriceRow type="full" />
            <PriceRow type="child" />
          </ul>
          <PillCta onClick={start} className="prices__cta" />
        </section>
      </section>

      <footer className="footer">
        <p className="footer__copy">{copy.home.copyright}</p>
        <ul className="footer__legal">
          {copy.home.legal.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </footer>
    </main>
  );
}
