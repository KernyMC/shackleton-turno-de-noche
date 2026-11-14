// Presentación de 6 tarjetas para quien juega por primera vez (7–12 años): una idea por tarjeta,
// una ilustración SVG hecha en código y dos frases cortas. Sustituye a la vieja bienvenida.
// En modo repaso (`review`, desde "¿Cómo se juega?") solo se cierra: no toca el tutorial.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren, JSX } from 'preact';
import { t } from '../i18n';
import { CREW } from '../data/crew';
import { commanderName } from '../state/store';
import { ackTutorial, onboardingOpen, skipTutorial } from '../state/tutorial';
import { CrewPortrait } from './CrewPortrait';
import { Icon } from './icons';
import '../styles/onboarding.css';

const TOTAL = 6;
const AMBER = '#ffb347';
const INK = '#ece8df';
const DIM = '#a7a399';
const LINE = '#2a2d33';
const PANEL = '#16181c';
const [CYAN, GREEN, , ORANGE] = CREW.map((c) => c.css);

type Vars = Record<string, string | number>;

function Art({ children, viewBox = '0 0 240 120' }: { children: ComponentChildren; viewBox?: string }) {
  return (
    <svg class="onb-art" viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Tarjeta 1: cuatro astronautas en la superficie lunar y la nave de relevo arriba. */
function ArtMission() {
  return (
    <Art>
      {[[30, 18], [70, 30], [118, 12], [176, 24], [214, 14]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="1.4" fill={INK} opacity="0.6" />
      ))}
      <g class="onb-ship" fill="none" stroke={AMBER} stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
        <path d="M203 22l5-13 5 13v10h-10z" fill="#1a1205" />
        <path d="M203 28l-5 6M213 28l5 6" />
        <path d="M206 36l2 6 2-6" opacity="0.7" />
      </g>
      <path d="M0 106Q120 76 240 106V120H0Z" fill="#1d2026" stroke={LINE} stroke-width="2" />
      {CREW.map((c, i) => {
        const x = 40 + i * 46;
        const y = 86 - Math.sin((i / 3) * Math.PI) * 8;
        return (
          <g key={c.id} transform={`translate(${x} ${y})`}>
            <rect x="-11" y="6" width="22" height="22" rx="8" fill={c.css} />
            <circle r="13" fill={INK} stroke="#0b0c0e" stroke-width="2" />
            <rect x="-8" y="-6" width="16" height="11" rx="5.5" fill="#0b0c0e" />
            <path d="M-5-2q3-3 6-2" stroke={c.css} stroke-width="1.6" fill="none" stroke-linecap="round" />
          </g>
        );
      })}
    </Art>
  );
}

/** Tarjeta 2: Sol → Batería → Módulos. */
function ArtEnergy() {
  const rays = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
  const arrow = (x1: number, x2: number) => (
    <g stroke={AMBER} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path class="onb-flow" d={`M${x1} 60H${x2}`} />
      <path d={`M${x2 - 6} 53l7 7-7 7`} />
    </g>
  );
  return (
    <Art>
      <g stroke={AMBER} stroke-width="2.5" stroke-linecap="round">
        {rays.map((a) => (
          <path key={a} d={`M${34 + Math.cos(a) * 19} ${60 + Math.sin(a) * 19}L${34 + Math.cos(a) * 25} ${60 + Math.sin(a) * 25}`} />
        ))}
      </g>
      <circle cx="34" cy="60" r="13" fill={AMBER} />
      {arrow(64, 90)}
      <rect x="96" y="38" width="52" height="44" rx="7" fill={PANEL} stroke={INK} stroke-width="2.5" />
      <rect x="148" y="52" width="6" height="16" rx="2" fill={INK} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={103 + i * 15} y="45" width="11" height="30" rx="3" fill={AMBER} opacity={1 - i * 0.22} />
      ))}
      {arrow(160, 184)}
      {[CYAN, GREEN, ORANGE].map((c, i) => (
        <rect key={c} x="192" y={20 + i * 30} width="26" height="24" rx="6" fill="none" stroke={c} stroke-width="3" />
      ))}
      {[CYAN, GREEN, ORANGE].map((c, i) => (
        <circle key={c} cx="205" cy={32 + i * 30} r="4" fill={c} />
      ))}
    </Art>
  );
}

/** Tarjeta 3: tres reguladores de energía y el botón de pasar el día. */
function ArtPlan() {
  const rows: [string, number][] = [[CYAN, 0.7], [GREEN, 0.45], [ORANGE, 0.25]];
  return (
    <Art>
      <rect x="36" y="8" width="168" height="104" rx="10" fill={PANEL} stroke={LINE} stroke-width="2" />
      {rows.map(([c, v], i) => {
        const y = 28 + i * 22;
        const x = 78 + v * 96;
        return (
          <g key={c}>
            <circle cx="56" cy={y} r="6" fill={c} />
            <path d={`M78 ${y}H174`} stroke={LINE} stroke-width="6" stroke-linecap="round" />
            <path d={`M78 ${y}H${x}`} stroke={c} stroke-width="6" stroke-linecap="round" />
            <circle cx={x} cy={y} r="8" fill={INK} stroke="#0b0c0e" stroke-width="2" />
          </g>
        );
      })}
      <g class="onb-press">
        <rect x="72" y="90" width="96" height="16" rx="8" fill={AMBER} />
        <path d="M112 94l9 4-9 4z" fill="#1a1205" />
      </g>
    </Art>
  );
}

/** Mini-íconos de la tarjeta 4 (cuadrícula de 40×40, trazo propio). */
function MiniIcon({ kind }: { kind: 'night' | 'storm' | 'repair' | 'ice' }) {
  const common = { fill: 'none', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
  let body: JSX.Element;
  let color = INK;
  if (kind === 'night') {
    color = '#c9d2ff';
    body = (
      <>
        <path d="M27 7a14 14 0 1 0 8 24A12 12 0 0 1 27 7z" />
        <path d="M32 9v4M30 11h4" />
      </>
    );
  } else if (kind === 'storm') {
    color = AMBER;
    const rays = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
    body = (
      <>
        <circle cx="15" cy="15" r="6" />
        {rays.map((a) => (
          <path key={a} d={`M${15 + Math.cos(a) * 10} ${15 + Math.sin(a) * 10}L${15 + Math.cos(a) * 13} ${15 + Math.sin(a) * 13}`} />
        ))}
        <path d="M28 22l-4 7h6l-4 8" />
        <circle cx="35" cy="26" r="1" fill={color} />
      </>
    );
  } else if (kind === 'repair') {
    color = ORANGE;
    const teeth = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
    body = (
      <>
        <circle cx="20" cy="20" r="8" />
        <circle cx="20" cy="20" r="3" />
        {teeth.map((a) => (
          <path key={a} d={`M${20 + Math.cos(a) * 8} ${20 + Math.sin(a) * 8}L${20 + Math.cos(a) * 13} ${20 + Math.sin(a) * 13}`} />
        ))}
      </>
    );
  } else {
    color = CYAN;
    body = (
      <>
        <path d="M20 5v30M7 12.5l26 15M7 27.5l26-15" />
        <path d="M16 8l4 3 4-3M16 32l4-3 4 3" />
      </>
    );
  }
  return (
    <svg class="onb-mini" viewBox="0 0 40 40" aria-hidden="true" focusable="false" stroke={color} {...common}>
      {body}
    </svg>
  );
}

/** Tarjeta 5: el camino de los días hasta la nave de relevo. */
function ArtGoal() {
  const dots = Array.from({ length: 7 }, (_, i) => 24 + i * 24);
  return (
    <Art viewBox="0 0 240 90">
      <path d="M24 56H204" stroke={LINE} stroke-width="4" stroke-linecap="round" stroke-dasharray="2 9" />
      {dots.map((x, i) => (
        <circle key={x} cx={x} cy="56" r={i === 0 ? 5 : 3} fill={i === 0 ? AMBER : DIM} />
      ))}
      <g transform="translate(24 30)">
        <circle r="10" fill={INK} stroke="#0b0c0e" stroke-width="2" />
        <rect x="-6" y="-4" width="12" height="8" rx="4" fill="#0b0c0e" />
      </g>
      <g transform="translate(212 20)" fill="none" stroke={AMBER} stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
        <path d="M0 8l5-13 5 13v10h-10z" fill="#1a1205" />
        <path d="M0 14l-5 6M10 14l5 6" />
      </g>
    </Art>
  );
}

export function Onboarding({ review = false, vars }: { review?: boolean; vars: Vars }) {
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const last = index === TOTAL - 1;
  const name = commanderName.value.trim() || t('crew.commander_default');

  const close = (): void => {
    if (review) onboardingOpen.value = false;
    else skipTutorial();
  };
  const finish = (): void => {
    if (review) onboardingOpen.value = false;
    else ackTutorial();
  };
  const go = (delta: number): void => setIndex((i) => Math.min(TOTAL - 1, Math.max(0, i + delta)));
  const forward = (): void => (last ? finish() : go(1));

  // El teclado vive en la ventana; siempre usa los manejadores de la última pasada.
  const latest = useRef({ forward, go, close });
  latest.current = { forward, go, close };
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const h = latest.current;
      if (e.key === 'ArrowRight') h.forward();
      else if (e.key === 'ArrowLeft') h.go(-1);
      else if (e.key === 'Escape') h.close();
      else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) h.forward();
      else if (e.key === 'Tab' && dialog.current) {
        const items = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
        if (items.length === 0) return;
        const first = items[0];
        const lastItem = items[items.length - 1];
        const active = document.activeElement;
        if (!dialog.current.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && active === lastItem) {
          e.preventDefault();
          first.focus();
        }
      } else return;
      if (e.key !== 'Tab') e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // El foco vuelve al botón principal al abrir y al cambiar de tarjeta.
  useEffect(() => primary.current?.focus(), [index]);

  const n = index + 1;
  const title = t(`onb.${n}.title`);
  let body: JSX.Element;
  switch (index) {
    case 0:
      body = (
        <>
          <ArtMission />
          <p class="onb-text">{t('onb.1.a', vars)}</p>
          <p class="onb-text">{t('onb.1.b')}</p>
        </>
      );
      break;
    case 1:
      body = (
        <>
          <ArtEnergy />
          <p class="onb-text">{t('onb.2.a')}</p>
          <p class="onb-text">{t('onb.2.b')}</p>
        </>
      );
      break;
    case 2:
      body = (
        <>
          <ArtPlan />
          <p class="onb-text">{t('onb.3.a')}</p>
          <p class="onb-text">{t('onb.3.b')}</p>
        </>
      );
      break;
    case 3:
      body = (
        <ul class="onb-coming">
          {(['night', 'storm', 'repair', 'ice'] as const).map((k) => (
            <li key={k}>
              <MiniIcon kind={k} />
              <span>
                <b>{t(`onb.4.${k}.name`)}</b>
                {t(`onb.4.${k}.text`)}
              </span>
            </li>
          ))}
        </ul>
      );
      break;
    case 4:
      body = (
        <>
          <ArtGoal />
          <ul class="onb-rules">
            <li class="onb-rules__win">
              <Icon name="check" size={26} />
              <span>{t('onb.5.win', vars)}</span>
            </li>
            <li class="onb-rules__lose">
              <Icon name="alert" size={26} />
              <span>{t('onb.5.lose')}</span>
            </li>
          </ul>
          <p class="onb-text onb-text--soft">{t('onb.5.safe')}</p>
        </>
      );
      break;
    default:
      body = (
        <>
          <ul class="onb-crew">
            {CREW.map((c) => (
              <li key={c.id} style={{ '--crew': c.css }}>
                <span class="onb-crew__face" aria-hidden="true">
                  <CrewPortrait color={c.css} size={56} mood="happy" />
                </span>
                <b>{t(`crew.${c.id}.short`)}</b>
                <span>{t(`crew.${c.id}.role`)}</span>
                <span class="onb-crew__mod">{t(`module.${c.module}`)}</span>
              </li>
            ))}
          </ul>
          <p class="onb-text">{t('onb.6.a')}</p>
        </>
      );
  }

  return (
    <div class="overlay">
      <section ref={dialog} class="card onb-card" role="dialog" aria-modal="true" aria-labelledby="onb-title">
        <header class="onb-head">
          <p class="card__kicker">{index === 0 ? t('onb.hello', { nombre: name }) : t('onb.kicker')}</p>
          <span class="onb-dots" role="img" aria-label={t('coach.step', { n, total: TOTAL })}>
            {Array.from({ length: TOTAL }, (_, i) => (
              <span key={i} class={`onb-dot${i === index ? ' onb-dot--now' : i < index ? ' onb-dot--done' : ''}`} />
            ))}
          </span>
        </header>
        <h2 id="onb-title">{title}</h2>
        <div class="onb-body" key={index} aria-live="polite">
          {body}
        </div>
        <div class="onb-actions">
          <button type="button" class="btn" disabled={index === 0} onClick={() => go(-1)}>
            {t('onb.back')}
          </button>
          <button ref={primary} type="button" class="btn btn--primary" onClick={forward}>
            {last ? (review ? t('onb.close') : t('coach.welcome.start')) : t('onb.next')}
          </button>
        </div>
        {!(review && last) && (
          <button type="button" class="linkbtn onb-skip" onClick={close}>
            {review ? t('onb.close') : t('onb.skip')}
          </button>
        )}
      </section>
    </div>
  );
}
