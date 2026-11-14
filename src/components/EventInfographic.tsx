// Infografía animada de un evento: un dibujo SVG y hasta tres frases cortas. Solo muestra; no decide nada.
// Cada diagrama es decorativo-explicativo: el role="img" lleva el mismo mensaje en texto.
import type { ComponentChildren } from 'preact';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import type { EventKind, ModuleId, PendingEvent } from '../sim/types';
import '../styles/infographic.css';

const KINDS_WITH_INFO: readonly EventKind[] = ['storm', 'night_warning', 'breakdown', 'ice', 'dust'];

export function hasInfographic(kind: EventKind): boolean {
  return KINDS_WITH_INFO.includes(kind);
}

function Frame({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <svg class="info__svg" viewBox="0 0 360 150" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {children}
    </svg>
  );
}

function Lines({ keys, vars }: { keys: string[]; vars?: Record<string, string | number> }) {
  return (
    <ul class="info__lines">
      {keys.map((k) => <li key={k}>{t(k, vars)}</li>)}
    </ul>
  );
}

/** Suelo lunar con un domo de base. */
function BaseDome({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path class="info-base" d="M-18 0 A18 16 0 0 1 18 0 Z" />
      <rect class="info-base-dark" x="-24" y="0" width="48" height="5" rx="2" />
      <rect class="info-sun info-twinkle" x="-4" y="-9" width="8" height="5" rx="1" />
    </g>
  );
}

/* ---------- Tormenta solar ---------- */
export function StormDiagram({ level }: { level: number }) {
  const lv = Math.min(4, Math.max(1, level || 1));
  const n = 2 + lv * 2; // 4 a 10 rayitas: más nivel, más partículas
  const rays = Array.from({ length: n }, (_, i) => ({
    y: ((i * 7) % 5 - 2) * 6,
    delay: -(i * 0.37),
  }));
  return (
    <Frame label={t('info.storm.alt', { nivel: lv })}>
      {/* Luna y base */}
      <path class="info-reg" d="M150 150 L150 134 Q230 118 360 128 L360 150 Z" />
      <path class="info-reg-dark" d="M150 142 Q250 130 360 138 L360 150 L150 150 Z" />
      <BaseDome x={292} y={126} />
      {/* Sol */}
      <circle class="info-sunglow" cx="34" cy="62" r="38" />
      <circle class="info-sun" cx="34" cy="62" r="22" />
      {/* Partículas rumbo a la base */}
      <g transform="translate(64 62) rotate(14)">
        {rays.map((r, i) => (
          <line key={i} class="info-p" x1="0" y1={r.y} x2="12" y2={r.y} style={`animation-delay:${r.delay.toFixed(2)}s`} />
        ))}
      </g>
      {/* Tierra con escudo, para comparar */}
      <circle class="info-earth" cx="326" cy="34" r="14" />
      <path class="info-land" d="M318 28 q6 -4 10 2 q-2 8 -8 6 z" />
      <path class="info-shield" d="M300 10 A30 30 0 0 0 300 58" />
      <g transform="translate(78 30)">
        {[0, 1, 2].map((i) => (
          <line key={i} class="info-p info-p--earth" x1="0" y1={i * 4} x2="12" y2={i * 4} style={`animation-delay:-${(i * 0.5).toFixed(2)}s`} />
        ))}
      </g>
      <g>
        {[0, 1].map((i) => (
          <line key={i} class="info-p info-bounce" x1="288" y1={26 + i * 10} x2="296" y2={20 + i * 10} />
        ))}
      </g>
    </Frame>
  );
}

/* ---------- Noche lunar ---------- */
export function NightDiagram() {
  return (
    <Frame label={t('info.night.alt')}>
      <g class="info-sunset">
        <circle class="info-sunglow" cx="190" cy="52" r="34" />
        <circle class="info-sun" cx="190" cy="52" r="18" />
      </g>
      {/* Montañas del borde del cráter delante del Sol */}
      <path class="info-reg-dark" d="M0 110 L50 80 L92 98 L150 70 L214 100 L270 74 L320 96 L360 84 L360 150 L0 150 Z" />
      <path class="info-reg" d="M0 124 Q120 112 230 122 Q300 128 360 120 L360 150 L0 150 Z" />
      {/* Base en sombra */}
      <BaseDome x={180} y={128} scale={1.2} />
      <rect class="info-night info-dim" x="0" y="0" width="360" height="150" />
    </Frame>
  );
}

/* ---------- Avería ---------- */
function ModuleShape({ id }: { id: ModuleId }) {
  switch (id) {
    case 'recycler':
      return (
        <g>
          <rect class="info-base" x="112" y="52" width="48" height="66" rx="8" />
          <rect class="info-base-dark" x="112" y="52" width="48" height="12" rx="6" />
          <rect class="info-line" x="160" y="76" width="34" height="8" rx="3" />
          <path class="info-line" d="M118 76 h36 M118 90 h36" />
        </g>
      );
    case 'greenhouse':
      return (
        <g>
          <path class="info-base" d="M100 118 A50 56 0 0 1 200 118 Z" opacity="0.9" />
          <path class="info-line" d="M150 118 V70 M100 118 Q150 40 200 118" />
          <path class="info-plant" d="M132 118 q-2 -16 10 -22 q4 12 -4 22 z M158 118 q2 -20 14 -26 q4 14 -6 26 z" />
        </g>
      );
    case 'shield':
      return (
        <g>
          <rect class="info-base" x="104" y="60" width="92" height="58" rx="5" />
          <path class="info-line" d="M104 80 H196 M104 99 H196 M135 60 V118 M166 60 V118" />
        </g>
      );
    default:
      return (
        <g>
          <rect class="info-base" x="106" y="70" width="80" height="48" rx="5" />
          <path class="info-base-dark" d="M118 70 V42 H160 V50 H132 V70 Z" />
          <circle class="info-line" cx="146" cy="96" r="12" />
          <path class="info-line" d="M146 80 v6 M146 106 v6 M130 96 h6 M156 96 h6" />
        </g>
      );
  }
}

export function BreakdownDiagram({ module }: { module: ModuleId }) {
  const min = defaultConfig.balance.effects.workshopMinEnergy;
  return (
    <Frame label={t('info.breakdown.alt', { modulo: t(`module.${module}`), min })}>
      <path class="info-reg" d="M0 150 L0 118 Q180 110 360 118 L360 150 Z" />
      <ModuleShape id={module} />
      {/* Pieza rota resaltada */}
      <circle class="info-red info-pulse" cx="176" cy="74" r="14" />
      <path class="info-red-line" d="M168 66 l6 6 l-4 5 l8 6 M178 66 l-3 5" />
      <g transform="translate(176 74)">
        {[[-12, -12, -20, -20], [12, -12, 20, -22], [14, 6, 24, 10], [-14, 8, -24, 14]].map(([x1, y1, x2, y2], i) => (
          <line key={i} class="info-spark info-flick" x1={x1} y1={y1} x2={x2} y2={y2} style={`animation-delay:-${(i * 0.27).toFixed(2)}s`} />
        ))}
      </g>
      {/* Batería: costo de reparar */}
      <g transform="translate(262 52)">
        <rect class="info-line" x="0" y="8" width="52" height="30" rx="5" />
        <rect class="info-base-dark" x="52" y="17" width="5" height="12" rx="2" />
        <path class="info-bolt" d="M28 11 l-10 15 h8 l-3 10 l12 -16 h-8 z" />
      </g>
      <path class="info-line" d="M236 94 q20 -10 40 -2" opacity="0.5" />
    </Frame>
  );
}

/* ---------- Hielo ---------- */
export function IceDiagram() {
  return (
    <Frame label={t('info.ice.alt')}>
      {/* Corte del cráter: bordes claros, fondo en sombra permanente */}
      <path class="info-reg" d="M0 62 L70 62 Q110 66 130 100 Q150 128 180 128 Q210 128 230 100 Q250 66 290 62 L360 62 L360 150 L0 150 Z" />
      <path class="info-reg-deep" d="M96 68 Q124 100 150 116 Q165 126 180 126 Q195 126 210 116 Q236 100 264 68 Q230 74 180 74 Q130 74 96 68 Z" opacity="0.85" />
      {/* Hielo en el fondo */}
      <path class="info-ice" d="M150 120 Q165 112 180 118 Q196 112 210 120 Q196 128 180 127 Q164 128 150 120 Z" />
      {[[162, 118], [182, 116], [198, 120]].map(([x, y], i) => (
        <circle key={i} class="info-ice info-twinkle" cx={x} cy={y} r="2" style={`animation-delay:-${i}s`} />
      ))}
      {/* Rover en el borde */}
      <g class="info-sway">
        <g transform="translate(60 52)">
          <rect class="info-base" x="-14" y="-12" width="28" height="9" rx="3" />
          <rect class="info-sun" x="-3" y="-17" width="10" height="5" rx="1" />
          <circle class="info-reg-deep" cx="-9" cy="-1" r="5" />
          <circle class="info-reg-deep" cx="9" cy="-1" r="5" />
        </g>
      </g>
      {/* Sol bajo al fondo: la luz no entra al cráter */}
      <circle class="info-sunglow" cx="330" cy="30" r="22" />
      <circle class="info-sun" cx="330" cy="30" r="10" />
    </Frame>
  );
}

/* ---------- Polvo en los paneles ---------- */
export function DustDiagram() {
  return (
    <Frame label={t('info.dust.alt')}>
      <path class="info-reg" d="M0 150 L0 122 Q180 114 360 122 L360 150 Z" />
      {/* Rayos de Sol */}
      {[0, 1, 2].map((i) => (
        <line key={i} class="info-ray info-twinkle" x1={52 + i * 18} y1="10" x2={72 + i * 18} y2="38" style={`animation-delay:-${i}s`} />
      ))}
      {/* Panel solar inclinado */}
      <g transform="translate(150 96) rotate(-14)">
        <rect class="info-panel" x="-70" y="-10" width="140" height="22" rx="3" />
        <path class="info-line" d="M-23 -10 V12 M23 -10 V12" opacity="0.5" />
      </g>
      <path class="info-line" d="M150 100 V122" />
      {/* Polvo pegado */}
      {[[100, 92], [118, 86], [134, 90], [152, 82], [168, 80], [186, 76], [126, 94], [160, 88]].map(([x, y], i) => (
        <circle key={i} class="info-dust" cx={x} cy={y - 6} r={i % 2 ? 3 : 4} />
      ))}
      {/* Rover con cepillo */}
      <g transform="translate(286 120)">
        <rect class="info-base" x="-24" y="-18" width="44" height="12" rx="4" />
        <circle class="info-reg-deep" cx="-15" cy="-4" r="6" />
        <circle class="info-reg-deep" cx="11" cy="-4" r="6" />
        <g transform="translate(-24 -14)">
          <g class="info-brush">
            <path class="info-line" d="M0 0 L-34 -14" />
            <path class="info-dust" d="M-34 -14 l-6 -2 l2 8 z" />
          </g>
        </g>
      </g>
    </Frame>
  );
}

/** Infografía del evento pendiente, o null si ese tipo no la tiene. */
export function EventInfographic({ event }: { event: PendingEvent }) {
  const payload = event.payload ?? {};
  switch (event.kind) {
    case 'storm': {
      const level = typeof payload.level === 'string' ? Number(payload.level.slice(1)) : 1;
      return (
        <div class="info">
          <StormDiagram level={level} />
          <Lines keys={['info.storm.1', 'info.storm.2', 'info.storm.3']} />
        </div>
      );
    }
    case 'night_warning':
      return (
        <div class="info">
          <NightDiagram />
          <Lines keys={['info.night.1', 'info.night.2']} />
        </div>
      );
    case 'breakdown': {
      const module = (payload.module as ModuleId) ?? 'workshop';
      return (
        <div class="info">
          <BreakdownDiagram module={module} />
          <Lines
            keys={['info.breakdown.1', 'info.breakdown.2']}
            vars={{ modulo: t(`module.${module}`), min: defaultConfig.balance.effects.workshopMinEnergy }}
          />
        </div>
      );
    }
    case 'ice':
      return (
        <div class="info">
          <IceDiagram />
          <Lines keys={['info.ice.1', 'info.ice.2']} />
        </div>
      );
    case 'dust':
      return (
        <div class="info">
          <DustDiagram />
          <Lines keys={['info.dust.1', 'info.dust.2']} />
        </div>
      );
    default:
      return null;
  }
}
