// «Proyección» de cómo se juega: mini animación en bucle (SVG + CSS, 6 s) de cada reto + 3 pasos con pictograma.
// Estilos y fotogramas en src/styles/challenge-demo.css (prefijo chd-). Sin números de balance: son dibujos, no el juego.
// Con prefers-reduced-motion no hay animación y el dibujo base ya es el fotograma final.
// A medida: brazo robótico, rover al hielo, radar solar, sellos del casco y cables. El resto usa la demo genérica
// (manita + tres fichas con el pictograma de cada paso).
import type { JSX } from 'preact';
import { t } from '../../i18n';
import type { ChallengeId } from '../../sim/types';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import '../../styles/challenge-demo.css';

type Key = 'rover' | 'radar' | 'seals' | 'cables' | 'arm' | 'biomed' | 'trench' | 'micro' | 'storm' | 'relay';

const KEY: Record<ChallengeId, Key> = {
  day02_rover_ice: 'rover',
  day04_solar_radar: 'radar',
  day06_hull_seals: 'seals',
  day08_comm_cables: 'cables',
  day12_robotic_arm: 'arm',
  day14_biomed_check: 'biomed',
  day16_regolith_trench: 'trench',
  day18_micrometeorites: 'micro',
  day24_super_storm: 'storm',
  day30_relay_docking: 'relay',
};

/** Pictograma de cada uno de los tres pasos. */
const ICONS: Record<Key, [IconName, IconName, IconName]> = {
  rover: ['arrow', 'sun', 'check'],
  radar: ['arrow', 'target', 'ff'],
  seals: ['target', 'alert', 'check'],
  cables: ['bolt', 'arrow', 'check'],
  arm: ['workshop', 'workshop', 'check'],
  biomed: ['crew', 'lungs', 'check'],
  trench: ['arrow', 'alert', 'data'],
  micro: ['target', 'shield', 'check'],
  storm: ['bolt', 'shield', 'check'],
  relay: ['ff', 'lock', 'check'],
};

const CUSTOM: Partial<Record<Key, () => JSX.Element>> = {};

/** Manita: la yema del dedo está en (0,0). */
function Hand({ cls }: { cls: string }) {
  return (
    <g class={`chd-hand ${cls}`}>
      <path
        class="chd-hand__p"
        d="M-4 4A4 4 0 0 1 4 4V15H10A7 7 0 0 1 17 22V30A7 7 0 0 1 10 37H-4A7 7 0 0 1 -11 30V22A7 7 0 0 1 -4 15Z"
      />
    </g>
  );
}

function Check({ x, y, cls }: { x: number; y: number; cls: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g class={`chd-pop ${cls}`}>
        <circle r="11" class="chd-ok" />
        <path d="M-5 0l4 4 7-8" class="chd-tick" />
      </g>
    </g>
  );
}

/** Botón físico dibujado: rectángulo con triángulo. dir: -1 ◄, 1 ►. */
function Btn({ x, y, dir, cls = '' }: { x: number; y: number; dir: -1 | 1; cls?: string }) {
  return (
    <g>
      <rect x={x} y={y} width="30" height="30" rx="4" class={`chd-btn ${cls}`} />
      <path
        d={dir === -1 ? `M${x + 19} ${y + 8}l-9 7 9 7Z` : `M${x + 11} ${y + 8}l9 7-9 7Z`}
        class="chd-tri"
      />
    </g>
  );
}

function wavePath(phase: number): string {
  const pts: string[] = [];
  for (let x = -80; x <= 400; x += 5) {
    const y = 56 - 26 * Math.sin(((x + phase) / 80) * 2 * Math.PI);
    pts.push(`${pts.length === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

/* ---------------- Brazo robótico ---------------- */
function ArmScene() {
  return (
    <>
      <line x1="0" y1="112" x2="320" y2="112" class="chd-ground" />
      <rect x="34" y="102" width="32" height="10" class="chd-base" />
      <circle cx="112" cy="103" r="9" class="chd-rock" />
      <circle cx="138" cy="57" r="13" class="chd-zone" />
      <circle cx="138" cy="57" r="5" class="chd-sample" />
      <g class="chd-arm-sh">
        <line x1="50" y1="112" x2="114" y2="112" class="chd-seg-o" />
        <line x1="50" y1="112" x2="114" y2="112" class="chd-seg chd-seg--1" />
        <g class="chd-arm-el">
          <line x1="114" y1="112" x2="170" y2="112" class="chd-seg-o" />
          <line x1="114" y1="112" x2="170" y2="112" class="chd-seg chd-seg--2" />
          <circle cx="170" cy="112" r="6" class="chd-tip" />
        </g>
        <circle cx="114" cy="112" r="10" class="chd-joint chd-joint--2" />
        <text x="114" y="116.5" class="chd-num chd-arm-num2" text-anchor="middle">2</text>
      </g>
      <circle cx="50" cy="112" r="10" class="chd-joint chd-joint--1" />
      <text x="50" y="116.5" class="chd-num" text-anchor="middle">1</text>
      <Check x={138} y={30} cls="chd-pop--arm" />
      {/* Mandos */}
      <circle cx="30" cy="143" r="11" class="chd-joint chd-joint--1" />
      <text x="30" y="148" class="chd-num" text-anchor="middle">1</text>
      <Btn x={46} y={128} dir={-1} />
      <Btn x={80} y={128} dir={1} cls="chd-flash chd-flash--a" />
      <circle cx="138" cy="143" r="11" class="chd-joint chd-joint--2" />
      <text x="138" y="148" class="chd-num" text-anchor="middle">2</text>
      <Btn x={154} y={128} dir={-1} />
      <Btn x={188} y={128} dir={1} cls="chd-flash chd-flash--b" />
      <rect x="232" y="128" width="74" height="30" rx="4" class="chd-btn chd-btn--grab chd-flash chd-flash--c" />
      <path d="M258 143l6 6 12-13" class="chd-tick chd-tick--dark" />
      <Hand cls="chd-hand--arm" />
    </>
  );
}

/* ---------------- Rover al hielo ---------------- */
const ROVER_KINDS = ['base', 'shade', 'sun', 'shade', 'sun', 'shade', 'shade', 'sun', 'shade', 'sun', 'sun', 'ice'] as const;
function RoverScene() {
  const cells: JSX.Element[] = [];
  ROVER_KINDS.forEach((k, i) => {
    const c = i % 4;
    const r = Math.floor(i / 4);
    const x = 48 + 56 * c;
    const y = 14 + 38 * r;
    const cx = x + 28;
    const cy = y + 19;
    cells.push(
      <g key={i}>
        <rect x={x + 1} y={y + 1} width="54" height="36" class={`chd-cell chd-cell--${k}`} />
        {k === 'sun' && <circle cx={cx} cy={cy} r="7" class="chd-sunc" />}
        {k === 'shade' && (
          <>
            <circle cx={cx} cy={cy} r="7" class="chd-moon" />
            <circle cx={cx + 3.5} cy={cy - 2} r="6" class="chd-moon-cut" />
          </>
        )}
        {k === 'ice' && <path d={`M${cx} ${cy - 11}l10 6v10l-10 6-10-6v-10Z`} class="chd-icep" />}
        {k === 'base' && <path d={`M${cx - 12} ${cy + 9}v-12l12-9 12 9v12ZM${cx - 4} ${cy + 9}v-7h8v7`} class="chd-house" />}
      </g>,
    );
  });
  return (
    <>
      {cells}
      <Check x={262} y={98} cls="chd-pop--rover" />
      <g class="chd-rover">
        <rect x="-10" y="-7" width="20" height="10" rx="2" class="chd-rover__b" />
        <circle cx="-6" cy="5" r="3.5" class="chd-rover__w" />
        <circle cx="6" cy="5" r="3.5" class="chd-rover__w" />
        <path d="M0 -7V-12M-4 -12h8" class="chd-rover__a" />
      </g>
      <Hand cls="chd-hand--rover" />
    </>
  );
}

/* ---------------- Radar solar ---------------- */
function RadarScene() {
  return (
    <>
      <defs>
        <clipPath id="chd-wave-clip">
          <rect x="16" y="12" width="288" height="90" />
        </clipPath>
      </defs>
      <rect x="16" y="12" width="288" height="90" class="chd-screen" />
      <g clip-path="url(#chd-wave-clip)">
        <path d={wavePath(0)} class="chd-wave chd-wave--ref" />
        <g class="chd-wave-mine">
          <path d={wavePath(0)} class="chd-wave chd-wave--mine" />
        </g>
      </g>
      <rect x="40" y="138" width="240" height="10" rx="3" class="chd-track" />
      <g class="chd-knob-g">
        <rect x="-14" y="-17" width="28" height="34" rx="4" class="chd-knob" />
        <path d="M-5 -8v16M0 -8v16M5 -8v16" class="chd-grip" />
      </g>
      <Check x={160} y={30} cls="chd-pop--radar" />
      <Hand cls="chd-hand--radar" />
    </>
  );
}

/* ---------------- Sellos del casco ---------------- */
function SealsScene() {
  const cells: JSX.Element[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      cells.push(<rect key={`${c}${r}`} x={36 + 62 * c + 2} y={14 + 38 * r + 2} width="58" height="34" rx="3" class="chd-zone-cell" />);
    }
  }
  const mark = (c: number, r: number): [number, number] => [67 + 62 * c, 33 + 38 * r];
  const [ax, ay] = mark(0, 0);
  const [bx, by] = mark(1, 2);
  const [cx, cy] = mark(2, 2);
  return (
    <>
      {cells}
      <g class="chd-seal chd-seal--a">
        <rect x={ax - 29} y={ay - 17} width="58" height="34" rx="3" class="chd-zone-far" />
        <circle cx={ax} cy={ay} r="7" class="chd-moon" />
        <circle cx={ax + 3.5} cy={ay - 2} r="6" class="chd-moon-cut chd-moon-cut--far" />
      </g>
      <g class="chd-seal chd-seal--b">
        <rect x={bx - 29} y={by - 17} width="58" height="34" rx="3" class="chd-zone-near" />
        <path d={`M${bx} ${by - 9}v10M${bx} ${by + 6}v1`} class="chd-bang" />
      </g>
      <g class="chd-seal chd-seal--c">
        <rect x={cx - 29} y={cy - 17} width="58" height="34" rx="3" class="chd-zone-ok" />
        <path d={`M${cx - 7} ${cy}l5 5 10-11`} class="chd-tick chd-tick--dark" />
      </g>
      <Hand cls="chd-hand--seals" />
    </>
  );
}

/* ---------------- Cables ---------------- */
function CablesScene() {
  const dots: JSX.Element[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      dots.push(<rect key={`${c}${r}`} x={91 + 28 * c} y={16 + 28 * r} width="26" height="26" rx="3" class="chd-zone-cell" />);
    }
  }
  return (
    <>
      {dots}
      <path d="M104 113H216" class="chd-cable chd-cable--cy" />
      <circle cx="104" cy="113" r="9" class="chd-node chd-node--cy" />
      <circle cx="216" cy="113" r="9" class="chd-node chd-node--cy" />
      <path d="M104 57H160V85H188V57H216" class="chd-cable chd-cable--am chd-cable--grow" pathLength="168" />
      <circle cx="104" cy="57" r="9" class="chd-node chd-node--am" />
      <circle cx="216" cy="57" r="9" class="chd-node chd-node--am" />
      <Check x={216} y={30} cls="chd-pop--cables" />
      <Hand cls="chd-hand--cables" />
    </>
  );
}

CUSTOM.arm = ArmScene;
CUSTOM.rover = RoverScene;
CUSTOM.radar = RadarScene;
CUSTOM.seals = SealsScene;
CUSTOM.cables = CablesScene;

/* ---------------- Genérica ---------------- */
function GenericStage({ icons }: { icons: [IconName, IconName, IconName] }) {
  return (
    <div class="chd-gen" aria-hidden="true">
      {icons.map((n, i) => (
        <div key={i} class={`chd-tile chd-tile--${i + 1}`}>
          <span class="chd-tile__n">{i + 1}</span>
          <Icon name={n} size={44} />
        </div>
      ))}
      <svg class="chd-gen__hand" viewBox="-14 -2 34 42" width="34" height="42">
        <path
          class="chd-hand__p"
          d="M-4 4A4 4 0 0 1 4 4V15H10A7 7 0 0 1 17 22V30A7 7 0 0 1 10 37H-4A7 7 0 0 1 -11 30V22A7 7 0 0 1 -4 15Z"
        />
      </svg>
    </div>
  );
}

export function ChallengeDemo({ id }: { id: ChallengeId }) {
  const key = KEY[id];
  const Scene = CUSTOM[key];
  const icons = ICONS[key];
  return (
    <div class="chd">
      {Scene ? (
        <svg class="chd-stage" viewBox="0 0 320 170" role="img" aria-label={t('challenge.demo.alt')}>
          <Scene />
        </svg>
      ) : (
        <GenericStage icons={icons} />
      )}
      <ol class="chd-steps">
        {icons.map((n, i) => (
          <li key={i} class="chd-step">
            <span class="chd-step__n">{i + 1}</span>
            <Icon name={n} size={26} />
            <span class="chd-step__t">{t(`challenge.demo.${key}.s${i + 1}`)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
