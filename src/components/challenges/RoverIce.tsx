// Reto del día 2, «Rover al hielo»: cuadrícula por turnos. Sol = batería pero radiación; sombra = protege pero gasta.
// Params (challenges.json): cols, rows, battery, sunCharge, shadeCost, sunDose, doseMax, maxMoves.
// Puntuación (forma del reto, no balance): vuelve con hielo y poca radiación → perfecto; con más radiación, o con hielo sin volver → parcial; sin hielo → fallo.
// Los valores salen de challenges.json (scores). Los cortes perfecto/parcial viven en challenges.json.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { defaultConfig } from '../../sim/config';
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

  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const kind = kindAt(x, y, cols, rows);
      const here = run.x === x && run.y === y;
      const near = Math.abs(run.x - x) + Math.abs(run.y - y) === 1 && !run.end;
      const kindLabel = t(`challenge.rover.kind.${kind}`);
      cells.push(
        <button
          key={`${x},${y}`}
          type="button"
          class={`chl-cell chl-cell--${kind}${here ? ' chl-cell--here' : ''}${near ? ' chl-cell--near' : ''}`}
          tabIndex={near ? 0 : -1}
          disabled={!near}
          aria-label={t('challenge.rover.cell', { col: x + 1, row: y + 1, kind: kindLabel }) + (here ? ` ${t('challenge.rover.here')}` : '')}
          onClick={() => step(x - run.x, y - run.y)}
        >
          {here ? (
            <svg viewBox="0 0 24 24" width="70%" height="70%" aria-hidden="true">
              <rect x="4" y="8" width="16" height="8" rx="1" class="chl-rover" />
              <circle cx="7" cy="18" r="2.4" class="chl-rover" />
              <circle cx="17" cy="18" r="2.4" class="chl-rover" />
              <path d="M12 8V4M9 4h6" class="chl-rover-line" />
            </svg>
          ) : kind === 'sun' ? (
            <Icon name="sun" size={20} />
          ) : kind === 'shade' ? (
            <Icon name="moon" size={18} />
          ) : kind === 'ice' ? (
            <svg viewBox="0 0 24 24" width="70%" height="70%" aria-hidden="true">
              <path d="M12 3 20 8v8l-8 5-8-5V8Z M12 3v18 M4 8l16 8 M20 8 4 16" class="chl-ice" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="70%" height="70%" aria-hidden="true">
              <path d="M3 20h18M5 20v-8l7-6 7 6v8M10 20v-5h4v5" class="chl-base" />
            </svg>
          )}
          <span class="chl-cell__tag">{t(`challenge.rover.tag.${kind}`)}</span>
        </button>,
      );
    }
  }

  const endKey = run.end ? `challenge.rover.end.${run.end}` : '';
  return (
    <div class="chl-game chl-rover">
      <p class="chl-howto">{t('challenge.day02_rover_ice.how')}</p>
      <div class="chl-stats" role="status" aria-live="polite">
        <span class="chl-stat">
          <Icon name="battery" size={18} /> {t('challenge.rover.battery')} <b>{run.battery}</b>
        </span>
        <span class="chl-stat">
          <Icon name="dose" size={18} /> {t('challenge.rover.dose')} <b>{run.dose}/{doseMax}</b>
        </span>
        <span class="chl-stat">
          <Icon name="arrow" size={18} /> {t('challenge.rover.moves')} <b>{run.moves}</b>
        </span>
        <span class={`chl-stat${run.ice ? ' chl-stat--on' : ''}`}>
          <Icon name={run.ice ? 'check' : 'target'} size={18} /> {t(run.ice ? 'challenge.rover.has_ice' : 'challenge.rover.no_ice')}
        </span>
      </div>
      <div
        class="chl-grid"
        role="group"
        aria-label={t('challenge.rover.map')}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, ['--chl-cols' as string]: cols, ['--chl-rows' as string]: rows }}
      >
        {cells}
      </div>
      <p class="chl-msg" role="status" aria-live="polite">{endKey ? t(endKey) : msg || t('challenge.rover.hint')}</p>
    </div>
  );
}
