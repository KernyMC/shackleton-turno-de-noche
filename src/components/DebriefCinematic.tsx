// Cinemática del final de partida: escenario SVG dibujado a mano con la tripulación de cuerpo entero.
// Se lee sin texto: aire que se acaba, despensa vacía, radiación o nave de relevo. NADA de muerte:
// si pierden, la cápsula de emergencia aterriza, suben en fila y regresan a salvo a la Tierra.
// Las animaciones viven en src/styles/cinematic.css (transform/opacity con curvas suaves).
// Con prefers-reduced-motion el CSS muestra directamente el fotograma final (estado base).
import { useState } from 'preact/hooks';
import { t } from '../i18n';
import type { LossCause } from '../sim/types';
import { CREW } from '../data/crew';
import { CrewPortrait } from './CrewPortrait';
import '../styles/cinematic.css';

export type CinematicKind = LossCause | 'win';

interface Props {
  kind: CinematicKind;
}

// Estrellas a mano (x, y, radio): fijas para que el cielo no cambie entre repeticiones.
const STARS: Array<[number, number, number]> = [
  [22, 18, 1], [48, 70, 0.8], [74, 34, 1.2], [112, 88, 0.8], [140, 22, 1], [166, 60, 0.9], [198, 104, 0.8],
  [226, 30, 1.3], [258, 74, 0.8], [292, 16, 1], [318, 52, 0.9], [346, 96, 1.1], [372, 28, 0.8], [404, 68, 1],
  [436, 14, 1.2], [462, 92, 0.8], [488, 40, 1], [514, 110, 0.9], [532, 20, 0.8], [560, 84, 1], [618, 30, 1.1],
  [624, 96, 0.8], [96, 124, 0.7], [250, 126, 0.8], [420, 120, 0.7], [600, 140, 0.8], [30, 110, 0.9], [330, 12, 0.8],
];

const CRATERS: Array<[number, number, number, number]> = [
  [80, 232, 34, 7], [210, 244, 46, 8], [330, 226, 22, 5], [450, 240, 40, 8], [570, 230, 30, 6], [620, 248, 24, 6],
];

const CONFETTI: Array<[number, string, number]> = [
  [300, '#ffb347', 0], [330, '#4fd1e0', 0.3], [360, '#7ccf6a', 0.6], [390, '#ff7a3d', 0.2], [420, '#d9d4c7', 0.8],
  [450, '#ffb347', 0.5], [480, '#4fd1e0', 0.1], [510, '#7ccf6a', 0.9], [540, '#ff7a3d', 0.4], [570, '#d9d4c7', 0.7],
  [270, '#7ccf6a', 0.55], [600, '#ffb347', 0.25],
];

// Posiciones en el suelo: de dónde parten y dónde terminan (fila junto a la nave).
const START_X = [150, 190, 230, 270];
const LOSS_X = [396, 432, 468, 504];
const WIN_X = [300, 345, 390, 435];

function Astronaut({ index, color, kind }: { index: number; color: string; kind: CinematicKind }) {
  const win = kind === 'win';
  const endX = win ? WIN_X[index]! : LOSS_X[index]!;
  const startX = win ? endX : START_X[index]!;
  const mouth = win ? 'M-5 -48 Q0 -43 5 -48' : 'M-5 -45 Q0 -50 5 -45';
  return (
    <g transform={`translate(${endX} 206)`}>
      <g class={kind === 'food' && index === 1 ? 'astro astro--belly' : 'astro'} style={`--i:${index};--dx:${startX - endX}px`}>
        <g class="astro__walk">
          <g class="astro__bob">
            {kind === 'radiation' && <ellipse class="astro__glow" cx="0" cy="-30" rx="22" ry="36" />}
            {/* Piernas */}
            <rect class="leg leg--l" x="-8" y="-22" width="7" height="22" rx="3" fill="#cfcabd" />
            <rect class="leg leg--r" x="1" y="-22" width="7" height="22" rx="3" fill="#cfcabd" />
            <rect x="-9" y="-5" width="9" height="5" rx="2" fill={color} />
            <rect x="0" y="-5" width="9" height="5" rx="2" fill={color} />
            <g class="astro__up">
              {/* Mochila */}
              <rect x="-15" y="-41" width="7" height="18" rx="2.5" fill="#aaa598" />
              {/* Torso con franja del color de cada uno */}
              <rect x="-11" y="-43" width="22" height="24" rx="7" fill="#e9e6de" />
              <rect x="-11" y="-30" width="22" height="4.5" fill={color} />
              <rect x="-3" y="-39" width="6" height="5" rx="1.5" fill="#2a2b2e" />
              {/* Brazos: giran desde el hombro */}
              <g class="arm arm--l">
                <rect x="-16" y="-41" width="6" height="19" rx="3" fill="#e9e6de" />
                <rect x="-16" y="-27" width="6" height="4" fill={color} />
              </g>
              <g class="arm arm--r">
                <rect x="10" y="-41" width="6" height="19" rx="3" fill="#e9e6de" />
                <rect x="10" y="-27" width="6" height="4" fill={color} />
              </g>
              {/* Casco con visor ámbar */}
              <circle cx="0" cy="-53" r="12" fill="#e9e6de" />
              <ellipse cx="0" cy="-52" rx="8.6" ry="7.2" fill="#241b10" />
              <path d="M-6 -56 Q-3 -59 2 -59" stroke="#f3d39a" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.85" />
              <circle cx="-3.2" cy="-52.5" r="1" fill="#f3d39a" />
              <circle cx="3.2" cy="-52.5" r="1" fill="#f3d39a" />
              <path d={mouth} stroke="#f3d39a" stroke-width="1.1" fill="none" stroke-linecap="round" />
              {kind === 'food' && index === 1 && (
                <g class="grumble" stroke="#f3d39a" stroke-width="1.4" stroke-linecap="round" fill="none">
                  <path d="M14 -22 q4 -2 8 0" />
                  <path d="M15 -17 q5 -2 9 0" />
                  <path d="M-14 -22 q-4 -2 -8 0" />
                  <path d="M-15 -17 q-5 -2 -9 0" />
                </g>
              )}
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

function Capsule() {
  return (
    <g transform="translate(540 206)">
      <path class="trail" d="M0 -8 L34 -280" />
      <ellipse class="puff puff--a" cx="0" cy="0" rx="48" ry="6" />
      <g class="vehicle">
        <g class="vehicle__flame">
          <g class="flame">
            <path d="M-12 0 Q0 52 12 0Z" fill="#ffb347" />
            <path d="M-6 0 Q0 30 6 0Z" fill="#fff4e0" />
          </g>
        </g>
        {/* Patas */}
        <path d="M-24 -6 L-34 0 L-20 0Z M24 -6 L34 0 L20 0Z" fill="#6f6c64" />
        {/* Casco de la cápsula */}
        <path d="M-26 -4 L-22 -42 Q0 -92 22 -42 L26 -4 Z" fill="#d9d4c7" />
        <path d="M-26 -4 L-23 -30 L23 -30 L26 -4 Z" fill="#b9b4a6" />
        <rect x="-26" y="-20" width="52" height="5" fill="#ff7a3d" />
        <circle cx="0" cy="-48" r="8" fill="#241b10" />
        <circle cx="0" cy="-48" r="6" fill="none" stroke="#ffb347" stroke-width="1.5" />
        <circle cx="-2" cy="-50" r="1.6" fill="#ffb347" opacity="0.8" />
        {/* Escotilla */}
        <rect x="-9" y="-16" width="18" height="12" rx="2" fill="#241b10" stroke="#ffb347" stroke-width="1" />
      </g>
    </g>
  );
}

function ReliefShip() {
  return (
    <g transform="translate(540 206)">
      <ellipse class="puff puff--a" cx="0" cy="0" rx="56" ry="7" />
      <g class="vehicle">
        <g class="vehicle__flame">
          <g class="flame">
            <path d="M-14 0 Q0 58 14 0Z" fill="#ffb347" />
            <path d="M-7 0 Q0 34 7 0Z" fill="#fff4e0" />
          </g>
        </g>
        <path d="M-34 -4 L-48 0 L-26 0Z M34 -4 L48 0 L26 0Z M-4 -4 L-6 0 L6 0 L4 -4Z" fill="#6f6c64" />
        <path d="M-32 -4 L-30 -54 Q0 -122 30 -54 L32 -4 Z" fill="#d9d4c7" />
        <path d="M-32 -4 L-31 -26 L31 -26 L32 -4 Z" fill="#b9b4a6" />
        <path d="M-30 -54 L-46 -28 L-32 -26Z M30 -54 L46 -28 L32 -26Z" fill="#c9731e" />
        <rect x="-31" y="-38" width="62" height="5" fill="#ffb347" />
        <circle cx="0" cy="-70" r="9" fill="#241b10" />
        <circle cx="0" cy="-70" r="7" fill="none" stroke="#ffb347" stroke-width="1.6" />
        <circle cx="-14" cy="-20" r="2.2" fill="#ffb347" class="ship__light" />
        <circle cx="14" cy="-20" r="2.2" fill="#ffb347" class="ship__light" />
        <rect x="-8" y="-24" width="16" height="20" rx="2" fill="#241b10" stroke="#ffb347" stroke-width="1" />
      </g>
    </g>
  );
}

function Pantry() {
  // Caja de comida abierta y vacía, con migas.
  return (
    <g transform="translate(322 206)">
      <path d="M-22 0 L-24 -20 L24 -20 L22 0Z" fill="#6b5a3e" />
      <path d="M-22 -2 L-23 -19 L23 -19 L22 -2Z" fill="#3b2f1f" />
      <path d="M-24 -20 L-30 -34 L-12 -34 L-8 -20Z" fill="#8a7550" />
      <rect x="-24" y="-20" width="48" height="4" fill="#8a7550" />
      <circle cx="-8" cy="-4" r="1.4" fill="#d8c08a" />
      <circle cx="-2" cy="-2.5" r="1" fill="#d8c08a" />
      <circle cx="9" cy="-3.5" r="1.2" fill="#d8c08a" />
      <circle cx="30" cy="-1.5" r="1" fill="#d8c08a" />
      <circle cx="35" cy="-1" r="1.2" fill="#d8c08a" />
      <circle cx="26" cy="-1" r="0.9" fill="#d8c08a" />
    </g>
  );
}

function Hud({ kind }: { kind: CinematicKind }) {
  if (kind === 'life_support') {
    return (
      <g class="cn-hud">
        <rect class="cn-hud__panel" x="14" y="12" width="112" height="38" rx="7" />
        {/* Burbujas de aire: el icono dice "aire" sin palabras */}
        <circle cx="30" cy="34" r="6" fill="none" stroke="#9fd8e6" stroke-width="1.6" />
        <circle cx="39" cy="26" r="3.4" fill="none" stroke="#9fd8e6" stroke-width="1.4" />
        <circle cx="31" cy="22" r="2.2" fill="none" stroke="#9fd8e6" stroke-width="1.2" />
        <rect x="52" y="25" width="62" height="12" rx="4" fill="#0b0c0e" />
        <rect class="o2bar" x="52" y="25" width="62" height="12" rx="4" />
      </g>
    );
  }
  if (kind === 'radiation') {
    return (
      <g class="cn-hud">
        <rect class="cn-hud__panel" x="14" y="12" width="112" height="46" rx="7" />
        <path d="M32 46 A28 28 0 0 1 108 46" fill="none" stroke="#5c5870" stroke-width="2" stroke-linecap="round" />
        <path d="M92 28 A28 28 0 0 1 108 46" fill="none" stroke="#ff5a4d" stroke-width="3" stroke-linecap="round" />
        <line class="needle" x1="70" y1="48" x2="70" y2="24" />
        <circle cx="70" cy="48" r="3.5" fill="#ece8df" />
        <g class="spark" stroke="#b48cff" stroke-width="1.6" stroke-linecap="round">
          <path d="M120 10 l5 -5 M126 18 l7 -2 M116 6 l1 -6" />
        </g>
        <g class="spark spark--b" stroke="#fff4e0" stroke-width="1.4" stroke-linecap="round">
          <path d="M20 8 l-4 -5 M12 16 l-6 -1" />
        </g>
      </g>
    );
  }
  return null;
}

function Bubbles() {
  // Aire que se escapa de los cascos y se apaga.
  return (
    <g class="bubbles" fill="none" stroke="#9fd8e6" stroke-width="1.3">
      {START_X.map((x, i) => (
        <g key={i} style={`--i:${i}`} class="bubble">
          <circle cx={x + 10} cy={150} r="3.4" />
          <circle cx={x + 17} cy={140} r="2.2" />
          <circle cx={x + 8} cy={134} r="1.6" />
        </g>
      ))}
    </g>
  );
}

function Stage({ kind }: { kind: CinematicKind }) {
  const win = kind === 'win';
  return (
    <>
      <defs>
        <linearGradient id="cine-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8c8a85" />
          <stop offset="1" stop-color="#3b3a38" />
        </linearGradient>
        <radialGradient id="cine-earthshine" cx="0.9" cy="0.15" r="0.9">
          <stop offset="0" stop-color="#16243a" />
          <stop offset="1" stop-color="#05060a" />
        </radialGradient>
        <clipPath id="cine-earth-clip"><circle cx="590" cy="50" r="19" /></clipPath>
      </defs>
      <rect width="640" height="260" fill="url(#cine-earthshine)" />
      {STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#f4efe4" opacity="0.8" />)}

      {kind === 'radiation' && (
        <g class="cn-sun">
          <circle class="cn-sun__halo" cx="74" cy="86" r="46" />
          <g class="cn-sun__rays" stroke="#b48cff" stroke-width="3" stroke-linecap="round">
            <path d="M74 20 v-14 M74 152 v14 M8 86 h-14 M140 86 h14 M28 40 l-10 -10 M120 132 l10 10 M120 40 l10 -10 M28 132 l-10 10" />
          </g>
          <circle cx="74" cy="86" r="24" fill="#fff4e0" />
        </g>
      )}

      {/* La Tierra, pequeña: en la victoria brilla */}
      <circle class="earth__halo" cx="590" cy="50" r="32" />
      <circle cx="590" cy="50" r="19" fill="#2f6fb4" />
      <g clip-path="url(#cine-earth-clip)">
        <ellipse cx="584" cy="44" rx="9" ry="6" fill="#4f9a5b" />
        <ellipse cx="596" cy="58" rx="6" ry="8" fill="#4f9a5b" />
        <circle cx="600" cy="56" r="22" fill="#05060a" opacity="0.35" />
      </g>

      {/* Suelo lunar con cráteres */}
      <rect y="206" width="640" height="54" fill="url(#cine-ground)" />
      <path d="M0 206 Q120 200 240 205 T480 204 T640 206 L640 210 L0 210Z" fill="#a09d97" opacity="0.5" />
      {CRATERS.map(([cx, cy, rx, ry], i) => (
        <g key={i}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#2f2e2c" opacity="0.55" />
          <path d={`M${cx - rx} ${cy} Q${cx} ${cy - ry * 1.5} ${cx + rx} ${cy}`} fill="none" stroke="#a9a69f" stroke-width="1.2" opacity="0.6" />
        </g>
      ))}

      {/* Silueta de la base */}
      <g class="base">
        <path d="M6 206 L6 176 Q6 150 56 150 Q106 150 106 176 L106 206Z" fill="#26272a" />
        <path d="M6 176 Q6 150 56 150 Q106 150 106 176" fill="none" stroke="#5a5955" stroke-width="1.5" />
        <rect x="104" y="184" width="30" height="22" rx="3" fill="#2d2e32" />
        <rect x="112" y="188" width="14" height="8" rx="1.5" fill="#ffb347" opacity="0.85" />
        <rect x="22" y="170" width="12" height="9" rx="2" fill="#ffb347" opacity="0.85" />
        <rect x="46" y="170" width="12" height="9" rx="2" fill="#ffb347" opacity="0.6" />
        <rect x="70" y="170" width="12" height="9" rx="2" fill="#ffb347" opacity="0.85" />
        <path d="M56 150 V124 M50 130 H62" stroke="#5a5955" stroke-width="1.5" />
        <circle class="beacon" cx="56" cy="122" r="4" />
      </g>

      {kind === 'food' && <Pantry />}
      {win ? <ReliefShip /> : <Capsule />}
      <Hud kind={kind} />
      {kind === 'life_support' && <Bubbles />}

      {CREW.map((c, i) => <Astronaut key={c.id} index={i} color={c.css} kind={kind} />)}

      <rect class="wash" width="640" height="260" />

      {win && (
        <g class="confetti">
          {CONFETTI.map(([x, fill, delay], i) => (
            <rect key={i} class="confetti__bit" x={x} y="-8" width="6" height="9" rx="1" fill={fill} style={`--d:${delay}s`} />
          ))}
        </g>
      )}
    </>
  );
}

export function DebriefCinematic({ kind }: Props) {
  // Cada repetición remonta el escenario: así las animaciones CSS vuelven a empezar.
  const [run, setRun] = useState(0);
  const label = kind === 'win' ? t('debrief.win') : `${t('debrief.abort')} ${t(`debrief.cause.${kind}`)}`;
  const caption = kind === 'win' ? t('debrief.win') : t('debrief.abort');
  return (
    <figure class={`cine cine--${kind}`}>
      <div class="cine__stage">
        <svg key={run} viewBox="0 0 640 260" role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
          <Stage kind={kind} />
        </svg>
        <button
          type="button"
          class="btn btn--ghost btn--icon cine__replay"
          aria-label={t('debrief.cinematic.replay')}
          title={t('debrief.cinematic.replay')}
          onClick={() => setRun(run + 1)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M16 10a6 6 0 1 1-2-4.5" />
            <path d="M15.5 2.5v3.5H12" />
          </svg>
        </button>
      </div>
      <figcaption>
        <span class="cine__crew" aria-hidden="true">
          {CREW.map((c) => <CrewPortrait key={c.id} color={c.css} mood={kind === 'win' ? 'happy' : 'neutral'} size={34} />)}
        </span>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}
