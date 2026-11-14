// Tarjeta de acto: a pantalla completa al empezar cada acto. "ACTO 3" pequeño, el nombre grande,
// la meta en una línea y un dibujo propio por acto. Se cierra sola a los 4,5 s o con un toque,
// Enter, Espacio o Esc. Solo lee el store (src/state/acts.ts decide cuándo sale).
import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren, JSX } from 'preact';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { actCard, ACT_CARD_MS, dismissActCard } from '../state/acts';
import '../styles/acts.css';

const AMBER = '#ffb347';
const INK = '#ece8df';
const DIM = '#a7a399';
const GROUND = '#2a2d33';
const GROUND_DARK = '#16181c';
const MOON = '#c9d2ff';

/** Variables del texto de la meta de un acto: meta numérica, día en que cierra y número. */
export function actVars(n: number): { n: number; meta: number; dia: number } {
  const def = defaultConfig.balance.acts.list.find((a) => a.id === n);
  return { n, meta: def?.goal.target ?? 0, dia: def?.to ?? 0 };
}

function Art({ children }: { children: ComponentChildren }) {
  return (
    <svg class="actcard__art" viewBox="0 0 200 130" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const rays = (cx: number, cy: number, r1: number, r2: number, from: number, to: number, count: number): JSX.Element[] =>
  Array.from({ length: count }, (_, i) => {
    const a = from + ((to - from) * i) / (count - 1);
    return <path key={i} d={`M${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1}L${cx + Math.cos(a) * r2} ${cy + Math.sin(a) * r2}`} />;
  });

/** 1 · Un módulo aterriza sobre el suelo lunar. */
function ArtArrival() {
  return (
    <Art>
      <path d="M0 106Q100 92 200 106V130H0Z" fill={GROUND} />
      <path d="M0 118Q100 108 200 118V130H0Z" fill={GROUND_DARK} />
      <g class="actart-drop">
        <path d="M82 40l18-14 18 14v26H82z" fill="#d9d4c7" stroke={INK} stroke-width="2.5" stroke-linejoin="round" />
        <rect x="93" y="46" width="14" height="10" rx="5" fill="#1a1205" stroke={AMBER} stroke-width="2" />
        <path d="M84 66l-10 22M116 66l10 22M70 90h12M118 90h12" stroke={INK} stroke-width="3" stroke-linecap="round" fill="none" />
        <path class="actart-flame" d="M94 68q6 18 12 0z" fill={AMBER} />
      </g>
      <g stroke={DIM} stroke-width="2.5" stroke-linecap="round" opacity="0.8">
        <path d="M58 104h-14M142 104h14M62 98l-12-5M138 98l12-5" />
      </g>
    </Art>
  );
}

/** 2 · El Sol asoma tras el horizonte, con rayos. */
function ArtSunrise() {
  return (
    <Art>
      <g class="actart-rays" stroke={AMBER} stroke-width="4" stroke-linecap="round" fill="none">
        {rays(100, 92, 44, 62, Math.PI * 1.08, Math.PI * 1.92, 9)}
      </g>
      <path d="M62 92a38 38 0 0 1 76 0z" fill={AMBER} />
      <path d="M0 92Q100 82 200 92V130H0Z" fill={GROUND} />
      <path d="M0 108Q100 98 200 108V130H0Z" fill={GROUND_DARK} />
    </Art>
  );
}

/** 3 · Luna creciente con una estrella. */
function ArtNight() {
  return (
    <Art>
      <path d="M118 22a44 44 0 1 0 28 76A38 38 0 0 1 118 22z" fill={MOON} />
      <g class="actart-twinkle" fill={INK}>
        <path d="M156 34c.8 5.4 4.2 8.8 9.6 9.6-5.4.8-8.8 4.2-9.6 9.6-.8-5.4-4.2-8.8-9.6-9.6 5.4-.8 8.8-4.2 9.6-9.6z" />
      </g>
      <circle cx="40" cy="30" r="2" fill={INK} opacity="0.7" />
      <circle cx="176" cy="84" r="2" fill={INK} opacity="0.7" />
      <path d="M0 112Q100 102 200 112V130H0Z" fill={GROUND} />
    </Art>
  );
}

/** 4 · Sol redondo con una flecha hacia arriba. */
function ArtRecover() {
  return (
    <Art>
      <g stroke={AMBER} stroke-width="4" stroke-linecap="round" fill="none">
        {rays(80, 62, 36, 50, 0, Math.PI * 2 - 0.01, 12)}
      </g>
      <circle cx="80" cy="62" r="27" fill={AMBER} />
      <g class="actart-up" fill="none" stroke={INK} stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M152 108V50" />
        <path d="M132 68l20-20 20 20" />
      </g>
      <path d="M0 116Q100 108 200 116V130H0Z" fill={GROUND} />
    </Art>
  );
}

/** 5 · Una bandera en una cima. */
function ArtFlag() {
  return (
    <Art>
      <path d="M20 118L88 44l24 28 24-20 44 66z" fill={GROUND} stroke={DIM} stroke-width="2.5" stroke-linejoin="round" />
      <path d="M88 44l10 12-8 6-10-4z" fill={INK} opacity="0.85" />
      <path d="M100 18v32" stroke={INK} stroke-width="4" stroke-linecap="round" />
      <path class="actart-flag" d="M102 18h30l-8 9 8 9h-30z" fill={AMBER} />
    </Art>
  );
}

const ART = [ArtArrival, ArtSunrise, ArtNight, ArtRecover, ArtFlag];

export function ActCard() {
  const card = actCard.value;
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!card) return;
    const opener = document.activeElement;
    root.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      dismissActCard();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [card?.key]);

  if (!card) return null;
  const n = Math.min(5, Math.max(1, card.act));
  const Drawing = ART[n - 1]!;
  const vars = actVars(n);
  return (
    <div
      ref={root}
      class="actcard"
      role="dialog"
      aria-modal="true"
      aria-labelledby="actcard-name"
      tabIndex={-1}
      key={card.key}
      onClick={dismissActCard}
    >
      <div class="actcard__panel">
        <Drawing />
        <p class="actcard__kicker">{t('act.kicker', { n })}</p>
        <h2 class="actcard__name" id="actcard-name">{t(`act.${n}.name`)}</h2>
        <p class="actcard__goal">
          <span>{t('act.goal_label')}</span>
          {t(`act.${n}.goal`, vars)}
        </p>
        <ol class="actcard__dots" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <li key={i} class={i === n ? 'actcard__dot actcard__dot--now' : i < n ? 'actcard__dot actcard__dot--past' : 'actcard__dot'} />
          ))}
        </ol>
        <p class="actcard__skip">{t('act.skip')}</p>
        <span class="actcard__timer" style={{ '--life': `${ACT_CARD_MS}ms` }} aria-hidden="true" />
      </div>
    </div>
  );
}
