// Reto del día 12, «Brazo robótico»: cinemática directa de 2 segmentos (hombro y codo) para agarrar una muestra sin rozar rocas.
// Params (challenges.json): seconds, assistSeconds, grabs, assistGrabs, tolerance (unidades del dibujo), perfectTries,
// len1, len2, armRadius, base [x,y], sample [x,y], rocks [[x,y,r],...], shoulderMin/Max, elbowMin/Max, startShoulder, startElbow.
// Puntuación: agarra en los primeros `perfectTries` intentos sin haber rozado una roca → perfecto; más tarde o tras rozar → parcial; no agarra → fallo (valores en challenges.json, scores).
// «Rozar» = intentar agarrar con un segmento tocando una roca (mover los deslizadores sin agarrar no penaliza).
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { defaultConfig } from '../../sim/config';
import { Icon } from '../icons';
import type { ChallengeGameProps } from './registry';
import { numParam, TimeBar, useCountdown } from './shared';

const VW = 300;
const VH = 200;

function pairParam(v: unknown, fallback: number[]): number[] {
  return Array.isArray(v) && v.every((n) => typeof n === 'number') ? (v as number[]) : fallback;
}

/** Distancia de un punto a un segmento. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

interface Run {
  sh: number;
  el: number;
  used: number;
  touched: boolean;
  okAt: number;
  end: boolean;
  msg: string;
}

export function RoboticArm({ params, assist, onDone }: ChallengeGameProps) {
  const seconds = numParam(params, 'seconds', 24) + assist * numParam(params, 'assistSeconds', 0);
  const grabsMax = Math.max(1, Math.round(numParam(params, 'grabs', 4) + assist * numParam(params, 'assistGrabs', 0)));
  const tol = numParam(params, 'tolerance', 12);
  const perfectTries = Math.max(1, Math.round(numParam(params, 'perfectTries', 2)));
  const l1 = numParam(params, 'len1', 90);
  const l2 = numParam(params, 'len2', 80);
  const armR = numParam(params, 'armRadius', 4);
  const [bx, by] = pairParam(params.base, [40, 170]) as [number, number];
  const [sx, sy] = pairParam(params.sample, [150, 90]) as [number, number];
  const rocks: number[][] = Array.isArray(params.rocks)
    ? (params.rocks as unknown[]).filter((r): r is number[] => Array.isArray(r) && r.length >= 3)
    : [[95, 130, 12]];
  const shMin = numParam(params, 'shoulderMin', 0);
  const shMax = numParam(params, 'shoulderMax', 180);
  const elMin = numParam(params, 'elbowMin', -150);
  const elMax = numParam(params, 'elbowMax', 150);

  // Paso de teclado: ~45 pulsaciones por recorrido (hay solución dentro de la tolerancia en las dos dificultades).
  const shStep = Math.max(1, Math.round((shMax - shMin) / 45));
  const elStep = Math.max(1, Math.round((elMax - elMin) / 45));

  const [run, setRun] = useState<Run>({
    sh: numParam(params, 'startShoulder', 45),
    el: numParam(params, 'startElbow', -20),
    used: 0,
    touched: false,
    okAt: 0,
    end: false,
    msg: '',
  });
  const runRef = useRef(run);
  runRef.current = run;
  const doneRef = useRef(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const rad = Math.PI / 180;
  const jx = bx + l1 * Math.cos(run.sh * rad);
  const jy = by - l1 * Math.sin(run.sh * rad);
  const tx = jx + l2 * Math.cos((run.sh + run.el) * rad);
  const ty = jy - l2 * Math.sin((run.sh + run.el) * rad);
  const dist = Math.hypot(tx - sx, ty - sy);
  const hit = rocks.some(
    (r) => Math.min(segDist(r[0]!, r[1]!, bx, by, jx, jy), segDist(r[0]!, r[1]!, jx, jy, tx, ty)) < r[2]! + armR,
  );
  const word = dist <= tol ? 'exact' : dist <= tol * 3 ? 'near' : 'far';

  const sc = defaultConfig.challenges.scores;
  const scoreOf = (r: Run): number => (r.okAt > 0 ? (r.okAt <= perfectTries && !r.touched ? sc.perfect : sc.partial) : sc.failed);
  const finish = (r: Run, delay: number): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    timer.current = window.setTimeout(() => onDone(scoreOf(r)), delay);
  };
  const left = useCountdown(
    seconds,
    () => {
      const r = runRef.current;
      if (r.end) return;
      const next = { ...r, end: true, msg: t('challenge.arm.end.time') };
      runRef.current = next;
      setRun(next);
      finish(next, 900);
    },
    !run.end,
  );

  const move = (key: 'sh' | 'el', v: number): void => {
    if (runRef.current.end) return;
    setRun({ ...runRef.current, [key]: v, msg: '' });
  };

  const grab = (): void => {
    const r = runRef.current;
    if (r.end) return;
    const used = r.used + 1;
    let next: Run = { ...r, used };
    if (hit) next = { ...next, touched: true, msg: t('challenge.arm.msg.blocked') };
    else if (dist <= tol) next = { ...next, okAt: used, end: true, msg: t('challenge.arm.msg.ok') };
    else next = { ...next, msg: t('challenge.arm.msg.miss') };
    if (!next.end && used >= grabsMax) next = { ...next, end: true, msg: t('challenge.arm.end.grabs') };
    runRef.current = next;
    setRun(next);
    if (next.end) finish(next, 1000);
  };

  return (
    <div class="chl-game chl-arm">
      <p class="chl-howto">{t('challenge.day12_robotic_arm.how')}</p>
      <TimeBar left={left} total={seconds} />
      <svg class="chl-arm-svg" viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={t('challenge.arm.alt')}>
        <line x1="0" y1={by} x2={VW} y2={by} class="chl-arm-ground" />
        <rect x={bx - 16} y={by - 10} width="32" height="10" class="chl-arm-base" />
        {rocks.map((r, i) => (
          <g key={i}>
            <circle cx={r[0]} cy={r[1]} r={r[2]} class="chl-arm-rock" />
            <text x={r[0]} y={r[1]! + r[2]! + 12} class="chl-arm-label" text-anchor="middle">{t('challenge.arm.rock')}</text>
          </g>
        ))}
        <circle cx={sx} cy={sy} r={tol} class="chl-arm-zone" />
        <circle cx={sx} cy={sy} r="5" class="chl-arm-sample" />
        <text x={sx} y={sy - tol - 5} class="chl-arm-label" text-anchor="middle">{t('challenge.arm.sample')}</text>
        <line x1={bx} y1={by - 5} x2={jx} y2={jy} class={`chl-arm-seg${hit ? ' chl-arm-seg--hit' : ''}`} />
        <line x1={jx} y1={jy} x2={tx} y2={ty} class={`chl-arm-seg${hit ? ' chl-arm-seg--hit' : ''}`} />
        <circle cx={bx} cy={by - 5} r="6" class="chl-arm-joint" />
        <circle cx={jx} cy={jy} r="6" class="chl-arm-joint" />
        <circle cx={tx} cy={ty} r="5" class="chl-arm-tip" />
      </svg>
      <div class="chl-stats" role="status" aria-live="polite">
        <span class="chl-stat">
          <Icon name={word === 'far' ? 'arrow' : word === 'near' ? 'target' : 'check'} size={18} />
          {t('challenge.arm.dist')} <b>{t(`challenge.arm.dist.${word}`)}</b>
        </span>
        <span class="chl-stat">
          <Icon name="ff" size={18} /> {t('challenge.arm.grabs', { n: Math.max(0, grabsMax - run.used) })}
        </span>
        <span class={`chl-stat${hit ? ' chl-arm-warn' : ''}`}>
          <Icon name={hit ? 'alert' : 'check'} size={18} /> {t(hit ? 'challenge.arm.rock_hit' : 'challenge.arm.rock_ok')}
        </span>
      </div>
      <div class="chl-arm-controls">
        <label class="chl-slider">
          <span class="chl-slider__label">
            {t('challenge.arm.shoulder')} <b>{t('challenge.arm.deg', { n: Math.round(run.sh) })}</b>
          </span>
          <input
            type="range"
            min={shMin}
            max={shMax}
            step={shStep}
            value={run.sh}
            disabled={run.end}
            aria-label={t('challenge.arm.shoulder')}
            onInput={(e) => move('sh', Number((e.currentTarget as HTMLInputElement).value))}
          />
        </label>
        <label class="chl-slider">
          <span class="chl-slider__label">
            {t('challenge.arm.elbow')} <b>{t('challenge.arm.deg', { n: Math.round(run.el) })}</b>
          </span>
          <input
            type="range"
            min={elMin}
            max={elMax}
            step={elStep}
            value={run.el}
            disabled={run.end}
            aria-label={t('challenge.arm.elbow')}
            onInput={(e) => move('el', Number((e.currentTarget as HTMLInputElement).value))}
          />
        </label>
        <button type="button" class="btn btn--primary chl-arm-grab" disabled={run.end} onClick={grab}>
          {t('challenge.arm.grab')}
        </button>
      </div>
      <p class="chl-msg" role="status" aria-live="polite">{run.msg || t('challenge.arm.hint')}</p>
    </div>
  );
}
