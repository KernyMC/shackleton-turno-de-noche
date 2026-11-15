// Reto del día 16, «Muro de regolito»: pista por turnos de 3 carriles. Sin reloj.
// Params (challenges.json): steps (filas), lives, assistLives, rocks[] y piles[] (una máscara de bits por fila,
// de abajo hacia arriba; bit 0 = carril izquierdo, bit 1 = centro, bit 2 = derecho). Si faltan, se usa una fórmula fija.
// Puntuación (forma del reto, no balance): fracción de montones recogidos; con tope «parcial» si hubo algún choque
// y «fallo» si el robot se quedó sin reparaciones. Los cortes perfecto/parcial viven en challenges.json.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { defaultConfig } from '../../sim/config';
import { playCarePlace, playRoverStep } from '../../audio/sfx';
import { Icon } from '../icons';
import type { ChallengeGameProps } from './registry';
import { numParam } from './shared';

const LANES = 3;
const MID = 1;

function maskParam(v: unknown, steps: number, fallback: (row: number) => number): number[] {
  const arr = Array.isArray(v) ? (v as unknown[]) : [];
  const out: number[] = [];
  for (let r = 0; r < steps; r++) {
    const n = arr[r];
    out.push(typeof n === 'number' && Number.isFinite(n) ? n & 7 : fallback(r));
  }
  return out;
}

/** Respaldo determinista: un camino en zigzag siempre libre; rocas en los otros carriles; montones sobre el camino. */
const fbPath = (r: number): number => [1, 0, 0, 1, 2, 2, 1, 1][r % 8];
const fbRocks = (r: number): number => (r % 4 === 0 ? 0 : 7 & ~(1 << fbPath(r)) & (r % 2 ? 1 : 5));
const fbPiles = (r: number): number => (r % 2 === 1 ? 1 << fbPath(r) : 0);

interface Run {
  lane: number;
  row: number; // -1 = salida
  lives: number;
  bumps: number;
  piles: number;
  end: null | 'done' | 'broken';
}

const bit = (mask: number, lane: number): boolean => (mask & (1 << lane)) !== 0;

/** Flecha de avance: recto, o en diagonal al cambiar de carril (siempre se avanza una fila). */
function Arrow({ dir }: { dir: 'left' | 'up' | 'right' }) {
  const rot = dir === 'left' ? -42 : dir === 'right' ? 42 : 0;
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M12 20V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function RegolithTrench({ params, assist, onDone }: ChallengeGameProps) {
  const steps = Math.max(3, Math.round(numParam(params, 'steps', 8)));
  const lives0 = Math.max(1, Math.round(numParam(params, 'lives', 3) + assist * numParam(params, 'assistLives', 0)));
  const rocks = maskParam(params.rocks, steps, fbRocks);
  const piles = maskParam(params.piles, steps, fbPiles);
  const totalPiles = piles.reduce((n, m) => n + [0, 1, 2].filter((l) => bit(m, l)).length, 0);

  const [run, setRun] = useState<Run>({ lane: MID, row: -1, lives: lives0, bumps: 0, piles: 0, end: null });
  const [msg, setMsg] = useState('');
  // Solo presentación: cuenta de choques para sacudir el robot.
  const [shake, setShake] = useState(0);
  const runRef = useRef(run);
  runRef.current = run;
  const doneRef = useRef(false);

  const move = (dl: number): void => {
    const r = runRef.current;
    if (r.end) return;
    const lane = r.lane + dl;
    if (lane < 0 || lane >= LANES) return;
    const row = r.row + 1;
    let next: Run;
    if (bit(rocks[row], lane)) {
      const lives = r.lives - 1;
      next = { ...r, lives, bumps: r.bumps + 1, end: lives <= 0 ? 'broken' : null };
      setMsg(t('challenge.trench.bump'));
      setShake((n) => n + 1);
    } else {
      const got = bit(piles[row], lane);
      next = { ...r, lane, row, piles: r.piles + (got ? 1 : 0), end: row >= steps - 1 ? 'done' : null };
      setMsg(got ? t('challenge.trench.got') : '');
      if (got) playCarePlace();
      else playRoverStep();
    }
    runRef.current = next;
    setRun(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const d = e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' ? -1
        : e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' ? 1
        : e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' ? 0 : null;
      if (d === null) return;
      e.preventDefault();
      move(d);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!run.end || doneRef.current) return;
    doneRef.current = true;
    const frac = totalPiles > 0 ? run.piles / totalPiles : 1;
    const sc = defaultConfig.challenges.scores;
    const score = run.end === 'broken' ? Math.min(frac, sc.failed) : run.bumps > 0 ? Math.min(frac, sc.partial) : frac;
    const id = window.setTimeout(() => onDone(Math.max(0, Math.min(1, score))), 900);
    return () => window.clearTimeout(id);
  }, [run.end]);

  const cells = [];
  for (let row = steps - 1; row >= -1; row--) {
    for (let lane = 0; lane < LANES; lane++) {
      const here = run.row === row && run.lane === lane;
      const next = !run.end && row === run.row + 1;
      const reachable = next && Math.abs(lane - run.lane) <= 1;
      let kind: 'start' | 'rock' | 'pile' | 'got' | 'empty' = 'empty';
      if (row === -1) kind = 'start';
      else if (bit(rocks[row], lane)) kind = 'rock';
      else if (bit(piles[row], lane)) kind = row <= run.row ? 'got' : 'pile';
      if (row === -1 && lane !== MID) kind = 'empty';
      // Huella: casillas por las que ya pasó el robot (solo dibujo).
      const behind = row < run.row && row >= 0 && kind !== 'rock';
      cells.push(
        <button
          key={`${lane},${row}`}
          type="button"
          class={`chl-trench-cell chl-trench-cell--${kind}${here ? ' chl-trench-cell--here' : ''}${reachable ? ' chl-trench-cell--near' : ''}${behind ? ' chl-trench-cell--past' : ''}`}
          disabled={!reachable}
          tabIndex={reachable ? 0 : -1}
          aria-label={t('challenge.trench.cell', { lane: lane + 1, row: row + 2, kind: t(`challenge.trench.kind.${kind}`) }) + (here ? ` ${t('challenge.trench.here')}` : '')}
          onClick={() => move(lane - run.lane)}
        >
          {kind === 'rock' && (
            <svg class="chl-trench-art" viewBox="0 0 40 32" aria-hidden="true">
              <path d="M4 27 9 12l9-7 12 3 6 10-1 9Z" class="chl-trench-rock" />
              <path d="M18 5l-2 9 8 4M9 12l7 2" class="chl-trench-rock__line" />
            </svg>
          )}
          {kind === 'pile' && (
            <svg class="chl-trench-art chl-trench-art--pile" viewBox="0 0 40 32" aria-hidden="true">
              <path d="M3 27c5-1 6-17 17-17s12 16 17 17Z" class="chl-trench-pile" />
              <circle cx="15" cy="20" r="1.6" class="chl-trench-pile__dot" />
              <circle cx="23" cy="16" r="1.6" class="chl-trench-pile__dot" />
              <circle cx="26" cy="23" r="1.6" class="chl-trench-pile__dot" />
            </svg>
          )}
          {here && (
            <svg key={shake} class={`chl-trench-art chl-trench-bot${shake > 0 ? ' chl-trench-bot--bump' : ''}`} viewBox="0 0 40 32" aria-hidden="true">
              <path d="M8 6h24l3 5H5Z" class="chl-trench-scoop" />
              <rect x="11" y="11" width="18" height="16" rx="3" class="chl-trench-rover" />
              <rect x="15" y="15" width="10" height="6" rx="1.5" class="chl-trench-cab" />
              <rect x="5" y="12" width="5" height="16" rx="2" class="chl-trench-track" />
              <rect x="30" y="12" width="5" height="16" rx="2" class="chl-trench-track" />
            </svg>
          )}
          {!here && reachable && kind !== 'rock' && kind !== 'pile' && (
            <span class="chl-trench-go" aria-hidden="true"><Arrow dir={lane < run.lane ? 'left' : lane > run.lane ? 'right' : 'up'} /></span>
          )}
        </button>,
      );
    }
  }

  // El muro: un ladrillo por montón. Los que faltan se ven como huecos.
  const bricks = [];
  for (let i = 0; i < totalPiles; i++) {
    const rowN = Math.floor(i / 3);
    const x = 8 + 36 * (i % 3) + (rowN % 2 ? 18 : 0);
    const y = 96 - 18 * rowN;
    bricks.push(
      <g key={i} class={`chl-trench-brick${i < run.piles ? ' chl-trench-brick--on' : ''}`}>
        <rect x={x} y={y} width="34" height="16" rx="2" />
        {i < run.piles && (
          <>
            <circle cx={x + 10} cy={y + 2} r="3.2" />
            <circle cx={x + 24} cy={y + 2} r="3.2" />
          </>
        )}
      </g>,
    );
  }

  const endKey = run.end ? `challenge.trench.end.${run.end}` : '';
  const canL = !run.end && run.lane > 0;
  const canR = !run.end && run.lane < LANES - 1;
  return (
    <div class="chl-game chl-trench">
      <p class="chl-howto">{t('challenge.day16_regolith_trench.how')}</p>
      <div class="chl-trench-board">
        <div class="chl-trench-wrap">
          <div
            class="chl-trench-grid"
            role="group"
            aria-label={t('challenge.trench.field')}
            style={{ ['--chl-trench-rows' as string]: steps + 1 }}
          >
            {cells}
          </div>
          <div class="chl-trench-pad" role="group" aria-label={t('challenge.trench.controls')}>
            <button type="button" class="btn chl-trench-btn" disabled={!canL} aria-label={t('challenge.trench.left')} onClick={() => move(-1)}>
              <Arrow dir="left" />
            </button>
            <button type="button" class="btn chl-trench-btn" disabled={!!run.end} aria-label={t('challenge.trench.forward')} onClick={() => move(0)}>
              <Arrow dir="up" />
            </button>
            <button type="button" class="btn chl-trench-btn" disabled={!canR} aria-label={t('challenge.trench.right')} onClick={() => move(1)}>
              <Arrow dir="right" />
            </button>
          </div>
        </div>
        <div class="chl-trench-side" role="status" aria-live="polite">
          <svg class="chl-trench-wall" viewBox="0 0 140 130" role="img" aria-label={`${t('challenge.trench.hopper')}: ${run.piles}/${totalPiles}`}>
            <path d="M22 112a48 48 0 0 1 96 0Z" class="chl-trench-dome" />
            <path d="M52 112V92a18 18 0 0 1 36 0v20" class="chl-trench-dome__door" />
            <line x1="2" y1="113" x2="138" y2="113" class="chl-trench-floor" />
            {bricks}
          </svg>
          <p class="chl-trench-count">
            <b>{run.piles}</b> / {totalPiles}
          </p>
          <p class="chl-trench-lives" aria-label={`${t('challenge.trench.repairs')}: ${run.lives}`}>
            {Array.from({ length: lives0 }, (_, i) => (
              <span key={i} class={i < run.lives ? 'chl-trench-life chl-trench-life--on' : 'chl-trench-life'}>
                <Icon name="workshop" size={20} />
              </span>
            ))}
          </p>
        </div>
      </div>
      <p class="chl-msg" role="status" aria-live="polite">{endKey ? t(endKey) : msg || t('challenge.trench.hint')}</p>
    </div>
  );
}
