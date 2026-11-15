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
  trench: ['arrow', 'alert', 'shield'],
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

/* ---------------- Muro de regolito ---------------- */
const TRENCH_CELLS: [number, number, 'rock' | 'pile' | 'free'][] = [
  [0, 3, 'free'], [1, 3, 'rock'], [2, 3, 'pile'],
  [0, 2, 'rock'], [1, 2, 'free'], [2, 2, 'free'],
  [0, 1, 'pile'], [1, 1, 'free'], [2, 1, 'rock'],
  [0, 0, 'free'], [1, 0, 'free'], [2, 0, 'free'],
];
function TrenchScene() {
  return (
    <>
      {TRENCH_CELLS.map(([lane, row, kind], i) => {
        const x = 40 + 40 * lane;
        const y = 100 - 30 * row;
        return (
          <g key={i}>
            <rect x={x + 1} y={y + 1} width="38" height="28" rx="2" class={`chd-tr-cell chd-tr-cell--${kind}`} />
            {kind === 'rock' && <path d={`M${x + 7} ${y + 24}l4-12 8-6 10 3 5 8-1 7Z`} class="chd-tr-rock" />}
            {kind === 'pile' && (
              <path d={`M${x + 5} ${y + 24}c4-1 5-14 15-14s11 13 15 14Z`} class={`chd-tr-pile chd-tr-pile--${row === 1 ? 'a' : 'b'}`} />
            )}
          </g>
        );
      })}
      {/* Muro que se arma */}
      <path d="M208 122a40 40 0 0 1 80 0Z" class="chd-tr-dome" />
      <line x1="196" y1="123" x2="300" y2="123" class="chd-ground" />
      <rect x="210" y="104" width="34" height="16" rx="2" class="chd-tr-slot" />
      <rect x="250" y="104" width="34" height="16" rx="2" class="chd-tr-slot" />
      <g class="chd-tr-brick chd-tr-brick--a">
        <rect x="210" y="104" width="34" height="16" rx="2" />
        <circle cx="220" cy="106" r="3.2" /><circle cx="234" cy="106" r="3.2" />
      </g>
      <g class="chd-tr-brick chd-tr-brick--b">
        <rect x="250" y="104" width="34" height="16" rx="2" />
        <circle cx="260" cy="106" r="3.2" /><circle cx="274" cy="106" r="3.2" />
      </g>
      <g transform="translate(248 74)">
        <g class="chd-tr-ok">
          <circle r="11" class="chd-ok" />
          <path d="M-5 0l4 4 7-8" class="chd-tick" />
        </g>
      </g>
      {/* Robot */}
      <g class="chd-tr-bot">
        <path d="M-11 -11h22l3 5h-28Z" class="chd-tr-scoop" />
        <rect x="-8" y="-6" width="16" height="15" rx="3" class="chd-rover__b" />
        <rect x="-14" y="-5" width="5" height="15" rx="2" class="chd-tr-track" />
        <rect x="9" y="-5" width="5" height="15" rx="2" class="chd-tr-track" />
      </g>
      {/* Mandos: ↖ ↑ ↗ */}
      <rect x="45" y="136" width="30" height="28" rx="4" class="chd-btn chd-tr-flash chd-tr-flash--l" />
      <path d="M67 157l-13-13M54 153v-9h9" class="chd-tr-arrow" />
      <rect x="85" y="136" width="30" height="28" rx="4" class="chd-btn" />
      <path d="M100 159v-17M93 148l7-7 7 7" class="chd-tr-arrow" />
      <rect x="125" y="136" width="30" height="28" rx="4" class="chd-btn chd-tr-flash chd-tr-flash--r" />
      <path d="M133 157l13-13M137 144h9v9" class="chd-tr-arrow" />
      <Hand cls="chd-hand--trench" />
    </>
  );
}
CUSTOM.trench = TrenchScene;

/* ---------------- Chequeo de la tripulación ---------------- */
function FaceDot({ x, y, color, cls = '' }: { x: number; y: number; color: string; cls?: string }) {
  return (
    <g transform={`translate(${x} ${y})`} class={cls}>
      <path d="M-15 22a15 12 0 0 1 30 0Z" fill={color} class="chd-bio-suit" />
      <circle r="14" class="chd-bio-helmet" />
      <circle r="10" class="chd-bio-visor" />
    </g>
  );
}
function BiomedScene() {
  const cards: [number, string][] = [[60, '#4fd1e0'], [160, '#7ccf6a'], [260, '#ffb347']];
  return (
    <>
      {/* Fichas de cuidado */}
      <circle cx="110" cy="24" r="15" class="chd-bio-tok chd-bio-tok--rest chd-bio-flash" />
      <path d="M115 30a9 9 0 1 1-8-14 7 7 0 0 0 8 14Z" class="chd-bio-ico" />
      <circle cx="160" cy="24" r="15" class="chd-bio-tok chd-bio-tok--water" />
      <path d="M160 14c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11Z" class="chd-bio-ico" />
      <circle cx="210" cy="24" r="15" class="chd-bio-tok chd-bio-tok--rad" />
      <path d="M210 16v16M202 24h16" class="chd-bio-ico chd-bio-ico--line" />
      {/* Tripulantes */}
      {cards.map(([x, color], i) => (
        <g key={i}>
          <rect x={x - 42} y="50" width="84" height="104" rx="4" class={`chd-bio-card${i === 1 ? ' chd-bio-card--need' : ''}`} />
          <FaceDot x={x} y={76} color={color} />
          {i === 1 ? (
            <>
              <path d={`M${x - 6} 78q6 -5 12 0`} class="chd-bio-mouth chd-bio-mouth--sad" />
              <path d={`M${x - 6} 77q6 6 12 0`} class="chd-bio-mouth chd-bio-mouth--glad" />
            </>
          ) : (
            <path d={`M${x - 6} 77q6 6 12 0`} class="chd-bio-mouth" />
          )}
          <circle cx={x - 5} cy="72" r="1.8" class="chd-bio-eye" />
          <circle cx={x + 5} cy="72" r="1.8" class="chd-bio-eye" />
          {[0, 1, 2].map((m) => (
            <g key={m}>
              {[0, 1, 2, 3].map((p) => (
                <rect
                  key={p}
                  x={x - 30 + 15 * p}
                  y={110 + 13 * m}
                  width="12"
                  height="8"
                  rx="1.5"
                  class={`chd-bio-pip${i === 1 && m === 1 ? ' chd-bio-pip--bad' : p < 2 ? ' chd-bio-pip--on' : ''}`}
                />
              ))}
            </g>
          ))}
        </g>
      ))}
      <path d="M197 118l7 12h-14Z" class="chd-bio-alert" />
      {/* La ficha se pega al tripulante que la necesita */}
      <g class="chd-bio-chip">
        <circle cx="190" cy="62" r="11" class="chd-bio-tok chd-bio-tok--rest" />
        <path d="M194 67a7 7 0 1 1-6-11 5.5 5.5 0 0 0 6 11Z" class="chd-bio-ico" />
      </g>
      <Check x={160} y={40} cls="chd-bio-ok" />
      <Hand cls="chd-hand--biomed" />
    </>
  );
}
CUSTOM.biomed = BiomedScene;

/* ---------------- Radar de sectores (micrometeoritos y tormenta) ---------------- */
function Radar({ kind, dx = 0 }: { kind: 'micro' | 'storm'; dx?: number }) {
  return (
    <g transform={`translate(${dx} 0)`}>
      <path d="M110 72L110 20A52 52 0 0 1 155 46Z" class="chd-sd-warn" />
      <circle cx="110" cy="72" r="52" class="chd-sd-ring" />
      <path d="M110 20V124M155 46L65 98M155 98L65 46" class="chd-sd-lines" />
      <circle cx="110" cy="72" r="14" class="chd-sd-core" />
      <g class={`chd-sd-shield chd-sd-shield--${kind}`}>
        <path d="M110 16A56 56 0 0 1 158.5 44" class="chd-sd-arc" />
      </g>
      <g class="chd-sd-rock">
        <path d="M134 26l5-9 8 1 3 7-6 6Z" class="chd-tr-rock" />
      </g>
      <g transform="translate(150 22)">
        <g class="chd-sd-ok">
          <circle r="11" class="chd-ok" />
          <path d="M-5 0l4 4 7-8" class="chd-tick" />
        </g>
      </g>
      <Btn x={70} y={134} dir={-1} />
      <Btn x={120} y={134} dir={1} cls={`chd-sd-flash chd-sd-flash--${kind}`} />
    </g>
  );
}
function MicroScene() {
  return (
    <>
      <Radar kind="micro" dx={50} />
      <Hand cls="chd-hand--micro" />
    </>
  );
}
CUSTOM.micro = MicroScene;

function StormScene() {
  return (
    <>
      <rect x="12" y="22" width="92" height="52" rx="4" class="chd-btn chd-st-opt chd-st-opt--pick" />
      <path d="M58 60V44M58 50c-9 0-13-5-13-11 8 0 13 4 13 11ZM58 46c0-7 5-11 12-11 0 7-4 11-12 11Z" class="chd-st-leaf" />
      <path d="M34 32l48 32" class="chd-st-off" />
      <rect x="12" y="84" width="92" height="52" rx="4" class="chd-btn chd-st-opt" />
      <rect x="40" y="100" width="32" height="20" rx="3" class="chd-st-bat" />
      <rect x="72" y="106" width="5" height="8" class="chd-st-bat" />
      <Radar kind="storm" dx={110} />
      <Hand cls="chd-hand--storm" />
    </>
  );
}
CUSTOM.storm = StormScene;

/* ---------------- Nave de relevo ---------------- */
function RelayScene() {
  const bars: [number, number, string][] = [[62, 56, 'a'], [122, 36, 'b'], [182, 76, 'c'], [242, 48, 'd']];
  return (
    <>
      {bars.map(([x, zy, k]) => (
        <g key={k}>
          <rect x={x - 13} y="12" width="26" height="104" rx="4" class={`chd-rl-track chd-rl-track--${k}`} />
          <rect x={x - 11} y={zy - 12} width="22" height="24" rx="2" class="chd-rl-zone" />
          <g transform={`translate(${x} ${zy})`}>
            <rect x="-15" y="-4" width="30" height="8" rx="3" class={`chd-rl-cur chd-rl-cur--${k}`} />
          </g>
          <rect x={x - 20} y="126" width="40" height="26" rx="4" class={`chd-btn chd-rl-btn chd-rl-btn--${k}`} />
          <path d={`M${x - 6} 141v-5a6 6 0 0 1 12 0v5M${x - 8} 141h16v8h-16Z`} class="chd-rl-lock" />
        </g>
      ))}
      <Check x={152} y={66} cls="chd-rl-ok" />
      <Hand cls="chd-hand--relay" />
    </>
  );
}
CUSTOM.relay = RelayScene;

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
