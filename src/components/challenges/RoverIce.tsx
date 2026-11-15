// Reto del día 2, «Rover al hielo»: cuadrícula por turnos. Sol = batería pero radiación; sombra = protege pero gasta.
// Params (challenges.json): cols, rows, battery, sunCharge, shadeCost, sunDose, doseMax, maxMoves.
// Puntuación (forma del reto, no balance): vuelve con hielo y poca radiación → perfecto; con más radiación, o con hielo sin volver → parcial; sin hielo → fallo.
// Los valores salen de challenges.json (scores). Los cortes perfecto/parcial viven en challenges.json.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { defaultConfig } from '../../sim/config';
import { playRoverStep } from '../../audio/sfx';
import { Icon } from '../icons';
import type { ChallengeGameProps } from './registry';
import { numParam } from './shared';

type Kind = 'base' | 'ice' | 'sun' | 'shade';

/** Mapa fijo y determinista a partir de cols/rows (sin azar). La base va arriba a la izquierda, el hielo abajo a la derecha. */
function kindAt(x: number, y: number, cols: number, rows: number): Kind {
  if (x === 0 && y === 0) return 'base';
  if (x === cols - 1 && y === rows - 1) return 'ice';
  return (x * 2 + y * 3 + ((x * y) % 3)) % 5 < 2 ? 'sun' : 'shade';
}

interface Run {
  x: number;
  y: number;
  battery: number;
  dose: number;
  moves: number;
  ice: boolean;
  end: null | 'home' | 'battery' | 'moves' | 'dose';
}

const DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
};

export function RoverIce({ params, onDone }: ChallengeGameProps) {
  const cols = Math.max(3, numParam(params, 'cols', 7));
  const rows = Math.max(3, numParam(params, 'rows', 7));
  const battery0 = numParam(params, 'battery', 20);
  const sunCharge = numParam(params, 'sunCharge', 3);
  const shadeCost = numParam(params, 'shadeCost', 1);
  const sunDose = numParam(params, 'sunDose', 1);
  const doseMax = numParam(params, 'doseMax', 5);
  const maxMoves = numParam(params, 'maxMoves', 36);

  const [run, setRun] = useState<Run>({ x: 0, y: 0, battery: battery0, dose: 0, moves: maxMoves, ice: false, end: null });
  const [msg, setMsg] = useState('');
  // Solo presentación: huellas del rover y el último cambio de batería (número que flota).
  const [trail, setTrail] = useState<string[]>(['0,0']);
  const [pop, setPop] = useState<{ key: number; text: string; good: boolean } | null>(null);
  const popKey = useRef(0);
  const doneRef = useRef(false);
  const runRef = useRef(run);
  runRef.current = run;

  const step = (dx: number, dy: number): void => {
    const r = runRef.current;
    if (r.end) return;
    const x = r.x + dx;
    const y = r.y + dy;
    if (x < 0 || y < 0 || x >= cols || y >= rows || Math.abs(dx) + Math.abs(dy) !== 1) return;
    const kind = kindAt(x, y, cols, rows);
    playRoverStep();
    let battery = r.battery;
    let dose = r.dose;
    if (kind === 'sun') {
      battery = Math.min(battery0, battery + sunCharge);
      dose += sunDose;
    } else if (kind === 'shade') {
      battery -= shadeCost;
    }
    const ice = r.ice || kind === 'ice';
    const moves = r.moves - 1;
    let end: Run['end'] = null;
    if (kind === 'base' && ice) end = 'home';
    else if (dose > doseMax) end = 'dose';
    else if (battery <= 0) end = 'battery';
    else if (moves <= 0) end = 'moves';
    if (kind === 'ice' && !r.ice) setMsg(t('challenge.rover.got_ice'));
    else if (kind === 'sun') setMsg(t('challenge.rover.on_sun'));
    else if (kind === 'shade') setMsg(t('challenge.rover.on_shade'));
    else setMsg('');
    const next = { x, y, battery, dose, moves, ice, end };
    runRef.current = next;
    setRun(next);
    setTrail((list) => (list.includes(`${x},${y}`) ? list : [...list, `${x},${y}`]));
    const gain = battery - r.battery;
    setPop(gain === 0 ? null : { key: ++popKey.current, text: `${gain > 0 ? '+' : '−'}${Math.abs(gain)}`, good: gain > 0 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const d = DIRS[e.key];
      if (!d || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      step(d[0], d[1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!run.end || doneRef.current) return;
    doneRef.current = true;
    // Volver con hielo y poca radiación = perfecto; volver con más radiación o no volver = parcial.
    const perfectDose = numParam(params, 'perfectDose', Math.floor(doseMax / 2));
    const sc = defaultConfig.challenges.scores;
    const score = run.end === 'home' ? (run.dose <= perfectDose ? sc.perfect : sc.partial) : run.ice ? sc.partial : sc.failed;
    const id = window.setTimeout(() => onDone(Math.max(0, Math.min(1, score))), 900);
    return () => window.clearTimeout(id);
  }, [run.end]);

  const ARROW: Record<string, string> = { '0,-1': 'M12 5l6 8H6Z', '0,1': 'M12 19l6-8H6Z', '-1,0': 'M5 12l8-6v12Z', '1,0': 'M19 12l-8-6v12Z' };
  const goalIce = !run.ice;
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const kind = kindAt(x, y, cols, rows);
      const here = run.x === x && run.y === y;
      const near = Math.abs(run.x - x) + Math.abs(run.y - y) === 1 && !run.end;
      const kindLabel = t(`challenge.rover.kind.${kind}`);
      const goal = !run.end && !here && ((kind === 'ice' && goalIce) || (kind === 'base' && !goalIce));
      const stepped = !here && trail.includes(`${x},${y}`);
      cells.push(
        <button
          key={`${x},${y}`}
          type="button"
          class={`chl-cell chl-cell--${kind}${here ? ' chl-cell--here' : ''}${near ? ' chl-cell--near' : ''}${goal ? ' chl-cell--goal' : ''}`}
          tabIndex={near ? 0 : -1}
          disabled={!near}
          aria-label={t('challenge.rover.cell', { col: x + 1, row: y + 1, kind: kindLabel }) + (here ? ` ${t('challenge.rover.here')}` : '')}
          onClick={() => step(x - run.x, y - run.y)}
        >
          {here ? (
            <>
              <svg class="chl-rov-car" viewBox="0 0 28 28" width="86%" height="86%" aria-hidden="true">
                {run.ice && <path d="M14 2.5l4.5 2.6v5.2L14 12.9l-4.5-2.6V5.1Z" class="chl-rov-cargo" />}
                <rect x="4" y="12" width="20" height="8" rx="2" class="chl-rov-body" />
                <rect x="15" y="9" width="6" height="4" rx="1" class="chl-rov-cab" />
                <path d="M7 12V8M5 8h4" class="chl-rov-mast" />
                <circle cx="8" cy="21.5" r="3.2" class="chl-rov-wheel" />
                <circle cx="20" cy="21.5" r="3.2" class="chl-rov-wheel" />
              </svg>
              {pop && (
                <span key={pop.key} class={`chl-rov-pop${pop.good ? ' chl-rov-pop--good' : ''}`} aria-hidden="true">
                  <Icon name="battery" size={14} /> {pop.text}
                </span>
              )}
            </>
          ) : kind === 'ice' ? (
            <svg class="chl-rov-ice" viewBox="0 0 24 24" width="78%" height="78%" aria-hidden="true">
              <path d="M12 2.5 20 7.5v9L12 21.5 4 16.5v-9Z" class="chl-rov-ice__body" />
              <path d="M12 2.5v19M4 7.5l16 9M20 7.5l-16 9" class="chl-rov-ice__lines" />
            </svg>
          ) : kind === 'base' ? (
            <svg viewBox="0 0 24 24" width="78%" height="78%" aria-hidden="true">
              <path d="M4 20v-8l8-7 8 7v8Z" class="chl-rov-home" />
              <path d="M10 20v-5h4v5" class="chl-rov-door" />
            </svg>
          ) : near ? (
            <svg class="chl-rov-arrow" viewBox="0 0 24 24" width="62%" height="62%" aria-hidden="true">
              <path d={ARROW[`${x - run.x},${y - run.y}`]} />
            </svg>
          ) : kind === 'sun' ? (
            <Icon name="sun" size={18} />
          ) : null}
          {stepped && <i class="chl-rov-track" aria-hidden="true" />}
        </button>,
      );
    }
  }

  const endKey = run.end ? `challenge.rover.end.${run.end}` : '';
  const perfectDose = numParam(params, 'perfectDose', Math.floor(doseMax / 2));
  return (
    <div class="chl-game chl-rover">
      <p class="chl-howto">{t('challenge.day02_rover_ice.how')}</p>
      <div class="chl-rov-hud" role="status" aria-live="polite">
        <span class="chl-rov-gauge" title={t('challenge.rover.battery')}>
          <Icon name="battery" size={22} />
          <span class="chl-rov-bar"><i style={{ width: `${Math.max(0, Math.min(100, (run.battery / battery0) * 100))}%` }} /></span>
          <b>{run.battery}</b>
          <span class="sr-only">{t('challenge.rover.battery')}</span>
        </span>
        <span class="chl-rov-gauge" title={t('challenge.rover.dose')}>
          <Icon name="dose" size={22} />
          <span class="chl-rov-pips">
            {Array.from({ length: doseMax }, (_, i) => (
              <i key={i} class={i < run.dose ? (i < perfectDose ? 'chl-rov-pip--on' : 'chl-rov-pip--hot') : ''} />
            ))}
          </span>
          <span class="sr-only">{t('challenge.rover.dose')} {run.dose}/{doseMax}</span>
        </span>
        <span class="chl-rov-gauge" title={t('challenge.rover.moves')}>
          <Icon name="arrow" size={20} /> <b>{run.moves}</b>
          <span class="sr-only">{t('challenge.rover.moves')}</span>
        </span>
        <span class="chl-rov-goal" aria-label={t(run.ice ? 'challenge.rover.has_ice' : 'challenge.rover.no_ice')}>
          <span class={`chl-rov-step${goalIce ? ' chl-rov-step--now' : ' chl-rov-step--done'}`}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2.5 20 7.5v9L12 21.5 4 16.5v-9Z" class="chl-rov-ice__body" /></svg>
            {!goalIce && <Icon name="check" size={14} />}
          </span>
          <Icon name="arrow" size={16} />
          <span class={`chl-rov-step${!goalIce && !run.end ? ' chl-rov-step--now' : ''}${run.end === 'home' ? ' chl-rov-step--done' : ''}`}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 20v-8l8-7 8 7v8Z" class="chl-rov-home" /></svg>
          </span>
        </span>
      </div>
      <div
        class="chl-grid chl-rov-grid"
        role="group"
        aria-label={t('challenge.rover.map')}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, ['--chl-cols' as string]: cols, ['--chl-rows' as string]: rows }}
      >
        {cells}
      </div>
      <div class="chl-rov-legend" aria-hidden="true">
        <span class="chl-rov-key">
          <i class="chl-rov-swatch chl-rov-swatch--sun"><Icon name="sun" size={16} /></i>
          <span class="chl-rov-plus"><Icon name="battery" size={16} /> +{sunCharge}</span>
          <span class="chl-rov-minus"><Icon name="dose" size={16} /> +{sunDose}</span>
        </span>
        <span class="chl-rov-key">
          <i class="chl-rov-swatch chl-rov-swatch--shade" />
          <span class="chl-rov-minus"><Icon name="battery" size={16} /> −{shadeCost}</span>
        </span>
      </div>
      <p class="chl-msg" role="status" aria-live="polite">{endKey ? t(endKey) : msg || t(run.ice ? 'challenge.rover.got_ice' : 'challenge.rover.hint')}</p>
    </div>
  );
}
