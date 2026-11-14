// Reto del día 16, «Muro de regolito»: pista por turnos de 3 carriles. Sin reloj.
// Params (challenges.json): steps (filas), lives, assistLives, rocks[] y piles[] (una máscara de bits por fila,
// de abajo hacia arriba; bit 0 = carril izquierdo, bit 1 = centro, bit 2 = derecho). Si faltan, se usa una fórmula fija.
// Puntuación (forma del reto, no balance): fracción de montones recogidos; con tope «parcial» si hubo algún choque
// y «fallo» si el robot se quedó sin reparaciones. Los cortes perfecto/parcial viven en challenges.json.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { defaultConfig } from '../../sim/config';
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

function Arrow({ dir }: { dir: 'left' | 'up' | 'right' }) {
  const rot = dir === 'left' ? -90 : dir === 'right' ? 90 : 0;
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
    } else {
      const got = bit(piles[row], lane);
      next = { ...r, lane, row, piles: r.piles + (got ? 1 : 0), end: row >= steps - 1 ? 'done' : null };
      setMsg(got ? t('challenge.trench.got') : '');
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
      cells.push(
        <button
          key={`${lane},${row}`}
          type="button"
          class={`chl-trench-cell chl-trench-cell--${kind}${here ? ' chl-trench-cell--here' : ''}${reachable ? ' chl-trench-cell--near' : ''}`}
          disabled={!reachable}
          tabIndex={reachable ? 0 : -1}
          aria-label={t('challenge.trench.cell', { lane: lane + 1, row: row + 2, kind: t(`challenge.trench.kind.${kind}`) }) + (here ? ` ${t('challenge.trench.here')}` : '')}
          onClick={() => move(lane - run.lane)}
        >
          {here ? (
            <svg viewBox="0 0 24 24" width="62%" height="82%" aria-hidden="true">
              <rect x="5" y="4" width="14" height="16" rx="2" class="chl-trench-rover" />
              <rect x="2" y="3" width="3" height="18" rx="1" class="chl-trench-track" />
              <rect x="19" y="3" width="3" height="18" rx="1" class="chl-trench-track" />
            </svg>
          ) : kind === 'rock' ? (
            <svg viewBox="0 0 24 24" width="70%" height="85%" aria-hidden="true">
              <path d="M3 19 8 8l6-3 6 6 1 8Z" class="chl-trench-rock" />
            </svg>
          ) : kind === 'pile' ? (
            <svg viewBox="0 0 24 24" width="70%" height="85%" aria-hidden="true">
              <path d="M2 19c3-1 4-10 10-10s7 9 10 10Z" class="chl-trench-pile" />
            </svg>
          ) : kind === 'got' ? (
            <Icon name="check" size={16} />
          ) : null}
          {kind !== 'empty' && !here && <span class="chl-trench-cell__tag">{t(`challenge.trench.tag.${kind}`)}</span>}
        </button>,
      );
    }
  }

  const endKey = run.end ? `challenge.trench.end.${run.end}` : '';
  const canL = !run.end && run.lane > 0;
  const canR = !run.end && run.lane < LANES - 1;
  return (
    <div class="chl-game chl-trench">
      <p class="chl-howto">{t('challenge.day16_regolith_trench.how')}</p>
      <div class="chl-stats" role="status" aria-live="polite">
        <span class="chl-stat">
          <Icon name="target" size={18} /> {t('challenge.trench.hopper')} <b>{run.piles}/{totalPiles}</b>
        </span>
        <span class="chl-stat">
          <Icon name="alert" size={18} /> {t('challenge.trench.repairs')} <b>{run.lives}</b>
        </span>
        <span class="chl-stat">
          <Icon name="arrow" size={18} /> {t('challenge.trench.step')} <b>{Math.max(0, run.row + 1)}/{steps}</b>
        </span>
      </div>
      <div class="chl-trench-wrap">
        <p class="chl-trench-module"><Icon name="shield" size={18} /> {t('challenge.trench.module')}</p>
        <div
          class="chl-trench-grid"
          role="group"
          aria-label={t('challenge.trench.field')}
          style={{ ['--chl-trench-rows' as string]: steps + 1 }}
        >
          {cells}
        </div>
      </div>
      <div class="chl-trench-pad" role="group" aria-label={t('challenge.trench.controls')}>
        <button type="button" class="btn chl-trench-btn" disabled={!canL} onClick={() => move(-1)}>
          <Arrow dir="left" /> {t('challenge.trench.left')}
        </button>
        <button type="button" class="btn chl-trench-btn" disabled={!!run.end} onClick={() => move(0)}>
          <Arrow dir="up" /> {t('challenge.trench.forward')}
        </button>
        <button type="button" class="btn chl-trench-btn" disabled={!canR} onClick={() => move(1)}>
          {t('challenge.trench.right')} <Arrow dir="right" />
        </button>
      </div>
      <p class="chl-msg" role="status" aria-live="polite">{endKey ? t(endKey) : msg || t('challenge.trench.hint')}</p>
    </div>
  );
}
