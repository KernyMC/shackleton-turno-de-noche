// Intro en estilo cómic tras «Comenzar»: 5 viñetas con ilustración SVG hecha en código y 2–3 frases
// cortas cada una. Se muestra siempre (no se guarda). Una viñeta a la vez; Atrás / Siguiente / Saltar.
// Teclado: flechas, Enter avanza, Esc salta. Funciona sin WebGL (todo es SVG).
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t } from '../i18n';
import { CREW } from '../data/crew';
import '../styles/comic.css';

const PANELS = [1, 2, 3, 4, 5] as const;
const AMBER = '#ffb347';
const INK = '#ece8df';
const DIM = '#a7a399';
const DARK = '#0b0c0e';
const GROUND = '#1d2026';
const [CYAN, GREEN] = CREW.map((c) => c.css);

function Art({ children }: { children: ComponentChildren }) {
  return (
    <svg class="comic-art" viewBox="0 0 320 200" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="comic-dots" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="3.5" cy="3.5" r="1.3" fill="#fff" />
        </pattern>
      </defs>
      <rect width="320" height="200" fill={DARK} />
      {children}
    </svg>
  );
}

const stars = [[20, 18], [58, 40], [96, 14], [140, 34], [188, 12], [236, 30], [284, 16], [300, 58], [30, 84], [270, 96]];
function Stars() {
  return (
    <g fill={INK}>
      {stars.map(([x, y], i) => <circle key={x} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.2} />)}
    </g>
  );
}

function Rocket({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`} fill="#1a1205" stroke={AMBER} stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
      <path d="M0-16l7 18v12h-14V2z" />
      <path d="M-7 8l-7 8M7 8l7 8" fill="none" />
      <path d="M-3 14l3 8 3-8" fill={AMBER} />
    </g>
  );
}

/** Viñeta 1: la Tierra, la Luna y una nave en camino. */
function ArtEarthMoon() {
  return (
    <Art>
      <Stars />
      <circle cx="82" cy="128" r="62" fill={CYAN} stroke={INK} stroke-width="3" />
      <path d="M44 106q14-18 34-10t4 28q-16 8-26 24-14-10-12-42zM92 150q18-8 32 4-8 20-28 22z" fill={GREEN} />
      <circle cx="82" cy="128" r="62" fill="url(#comic-dots)" opacity="0.18" />
      <path d="M82 66a62 62 0 0 1 0 124a46 62 0 0 0 0-124z" fill={DARK} opacity="0.45" />
      <circle cx="262" cy="56" r="26" fill={INK} stroke={DARK} stroke-width="3" />
      <circle cx="254" cy="48" r="5" fill={DIM} />
      <circle cx="270" cy="64" r="7" fill={DIM} />
      <circle cx="268" cy="46" r="3" fill={DIM} />
      <path d="M126 96Q176 38 226 64" fill="none" stroke={AMBER} stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" />
      <Rocket x={172} y={58} rot={52} />
    </Art>
  );
}

/** Viñeta 2: corte del cráter Shackleton: borde con Sol, fondo oscuro con hielo. */
function ArtCrater() {
  const ice = [[150, 160], [172, 170], [196, 158], [168, 148], [214, 172]];
  return (
    <Art>
      <Stars />
      <g stroke={AMBER} stroke-width="3" stroke-linecap="round">
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return <path key={i} d={`M${46 + Math.cos(a) * 24} ${46 + Math.sin(a) * 24}L${46 + Math.cos(a) * 33} ${46 + Math.sin(a) * 33}`} />;
        })}
      </g>
      <circle cx="46" cy="46" r="18" fill={AMBER} />
      <path d="M0 100L84 88L116 98Q160 196 204 98L240 90L320 104V200H0Z" fill={GROUND} stroke={INK} stroke-width="3" stroke-linejoin="round" />
      <path d="M0 100L84 88L116 98Q160 196 204 98L240 90L320 104V200H0Z" fill="url(#comic-dots)" opacity="0.1" />
      <path d="M116 98Q160 196 204 98Z" fill={DARK} />
      <path d="M72 90L116 98M204 98L248 88" stroke={AMBER} stroke-width="5" stroke-linecap="round" />
      <g fill={CYAN} stroke={INK} stroke-width="1.5" stroke-linejoin="round">
        {ice.map(([x, y]) => <path key={x} d={`M${x} ${y - 8}l6 8-6 8-6-8z`} />)}
      </g>
    </Art>
  );
}

/** Viñeta 3: la base (invernadero, módulo, antena, paneles solares) y los cuatro tripulantes. */
function ArtBase() {
  return (
    <Art>
      <Stars />
      <path d="M0 138Q160 118 320 138V200H0Z" fill={GROUND} stroke={INK} stroke-width="3" />
      <path d="M0 138Q160 118 320 138V200H0Z" fill="url(#comic-dots)" opacity="0.1" />
      <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="M30 126a40 40 0 0 1 80 0z" fill="#16281c" />
        <path d="M70 86V126M46 94Q50 112 52 126M94 94Q90 112 88 126" fill="none" stroke-width="2" />
        <rect x="116" y="96" width="62" height="32" rx="5" fill="#16181c" />
        <path d="M178 112h14" fill="none" />
        <rect x="192" y="104" width="30" height="24" rx="5" fill="#16181c" />
        <path d="M207 104V76M207 76l-16-6M207 76l16-6" fill="none" />
        <path d="M188 66q19 20 38 0z" fill="#16181c" />
        <path d="M250 128V108M290 126V106" fill="none" />
        <path d="M234 96l34-6 8 20-38 6zM274 94l34-4 6 20-36 6z" fill="#14202e" />
      </g>
      <g stroke={CYAN} stroke-width="1.5" fill="none">
        <path d="M244 100l8 20M256 98l8 20M280 94l8 20M292 92l8 20" />
      </g>
      <g fill={AMBER}>
        <rect x="126" y="106" width="12" height="10" />
        <rect x="148" y="106" width="12" height="10" />
        <rect x="200" y="112" width="12" height="8" />
      </g>
      {CREW.map((c, i) => (
        <g key={c.id} transform={`translate(${64 + i * 62} ${152 - Math.sin((i / 3) * Math.PI) * 4})`}>
          <rect x="-11" y="5" width="22" height="24" rx="8" fill={c.css} stroke={DARK} stroke-width="3" />
          <circle r="12" fill={INK} stroke={DARK} stroke-width="3" />
          <rect x="-8" y="-5" width="16" height="10" rx="5" fill={DARK} />
        </g>
      ))}
    </Art>
  );
}

/** Viñeta 4: tormenta solar y comunicación cortada; solo avisos cortos por la antena. */
function ArtStorm() {
  return (
    <Art>
      <Stars />
      <circle cx="58" cy="64" r="30" fill={AMBER} stroke={INK} stroke-width="3" />
      <circle cx="58" cy="64" r="30" fill="url(#comic-dots)" opacity="0.25" />
      <g fill="none" stroke={AMBER} stroke-width="4" stroke-linecap="round">
        <path d="M92 44Q122 28 138 58" />
        <path d="M96 84Q136 90 150 118" />
        <path d="M74 98Q84 140 118 150" />
      </g>
      <path d="M170 62l-14 26h16l-12 28" fill="none" stroke={INK} stroke-width="4" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx="268" cy="38" r="22" fill={CYAN} stroke={INK} stroke-width="3" />
      <path d="M200 52L248 44" stroke={DIM} stroke-width="3" stroke-dasharray="6 8" stroke-linecap="round" />
      <path d="M0 170Q160 150 320 170V200H0Z" fill={GROUND} stroke={INK} stroke-width="3" />
      <g stroke={INK} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <path d="M226 164V132" />
        <path d="M208 122q18 18 36 0z" fill="#16181c" />
        <path d="M226 128l8-20" />
      </g>
      <g fill={AMBER}>
        <rect x="244" y="100" width="6" height="6" />
        <rect x="256" y="92" width="6" height="6" />
        <rect x="268" y="84" width="6" height="6" />
      </g>
    </Art>
  );
}

/** Viñeta 5: el camino de 30 días desde la base hasta la nave de relevo, con la noche lunar a mitad. */
function ArtDays() {
  const days = Array.from({ length: 30 }, (_, i) => ({ i, x: 66 + i * 6.5, night: i >= 10 && i < 20, mark: i % 10 === 9 }));
  return (
    <Art>
      <Stars />
      <rect x="127" y="34" width="68" height="112" fill="#05060a" stroke={INK} stroke-width="3" stroke-dasharray="6 5" />
      <rect x="127" y="34" width="68" height="112" fill="url(#comic-dots)" opacity="0.08" />
      <path d="M170 52a16 16 0 1 0 8 28a13 13 0 0 1-8-28z" fill={INK} stroke={DARK} stroke-width="2" />
      <g fill={INK}>
        <circle cx="142" cy="50" r="1.6" />
        <circle cx="150" cy="88" r="1.2" />
        <circle cx="184" cy="96" r="1.6" />
        <circle cx="140" cy="76" r="1.2" />
      </g>
      <g stroke={AMBER} stroke-width="3" stroke-linecap="round">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <path key={i} d={`M${60 + Math.cos(a) * 16} ${46 + Math.sin(a) * 16}L${60 + Math.cos(a) * 23} ${46 + Math.sin(a) * 23}`} />;
        })}
      </g>
      <circle cx="60" cy="46" r="11" fill={AMBER} />
      <path d="M0 160Q160 138 320 160V200H0Z" fill={GROUND} stroke={INK} stroke-width="3" />
      <path d="M0 160Q160 138 320 160V200H0Z" fill="url(#comic-dots)" opacity="0.1" />
      <g stroke={INK} stroke-width="3" stroke-linejoin="round">
        <path d="M14 148a22 22 0 0 1 44 0z" fill="#16281c" />
        <rect x="26" y="130" width="8" height="8" fill={AMBER} stroke="none" />
      </g>
      {days.map((d) => (
        <rect
          key={d.i}
          x={d.x - (d.mark ? 5 : 3)}
          y={122 - Math.sin((d.i / 29) * Math.PI) * 14 - (d.mark ? 5 : 3)}
          width={d.mark ? 10 : 6}
          height={d.mark ? 10 : 6}
          fill={d.night ? DIM : AMBER}
          stroke={DARK}
          stroke-width="1.5"
        />
      ))}
      <path d="M62 128Q160 100 262 128" fill="none" stroke={DIM} stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round" />
      <Rocket x={292} y={128} />
      <path d="M278 152h28" stroke={AMBER} stroke-width="3" stroke-linecap="round" />
    </Art>
  );
}

const ARTS = [ArtEarthMoon, ArtCrater, ArtBase, ArtStorm, ArtDays];
const LINES = ['a', 'b', 'c'];

export function IntroComic({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const primary = useRef<HTMLButtonElement>(null);
  const total = PANELS.length;
  const last = index === total - 1;

  const go = (delta: number): void => {
    if (index + delta < 0) onBack();
    else setIndex((i) => Math.min(total - 1, i + delta));
  };
  const forward = (): void => (last ? onDone() : go(1));

  const latest = useRef({ forward, go, onDone });
  latest.current = { forward, go, onDone };
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const h = latest.current;
      if (e.key === 'ArrowRight') h.forward();
      else if (e.key === 'ArrowLeft') h.go(-1);
      else if (e.key === 'Escape') h.onDone();
      else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) h.forward();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => primary.current?.focus(), [index]);

  const n = PANELS[index];
  const PanelArt = ARTS[index];
  return (
    <div class="comic">
      <section class="comic-page" role="dialog" aria-modal="true" aria-labelledby="comic-title">
        <header class="comic-head">
          <p class="comic-tag">{t('comic.label')}</p>
          <span class="comic-dots" role="img" aria-label={t('comic.progress', { n: index + 1, total })}>
            {PANELS.map((p, i) => (
              <span key={p} class={`comic-dot${i === index ? ' comic-dot--now' : i < index ? ' comic-dot--done' : ''}`} />
            ))}
          </span>
          <button type="button" class="comic-skip" onClick={onDone}>
            {t('comic.skip')}
          </button>
        </header>
        <div class="comic-panel" key={index} aria-live="polite">
          <div class="comic-frame">
            <PanelArt />
          </div>
          <div class="comic-caption">
            <h2 id="comic-title" class="comic-title">{t(`comic.${n}.title`)}</h2>
            {LINES.map((l) => <p key={l} class="comic-text">{t(`comic.${n}.${l}`)}</p>)}
          </div>
        </div>
        <div class="comic-actions">
          <button type="button" class="btn" onClick={() => go(-1)}>
            {index === 0 ? t('comic.title_screen') : t('comic.prev')}
          </button>
          <button ref={primary} type="button" class="btn btn--primary" onClick={forward}>
            {last ? t('comic.finish') : t('comic.next')}
          </button>
        </div>
      </section>
    </div>
  );
}
