// Reto del día 12, «Brazo robótico»: cinemática directa de 2 segmentos (hombro y codo) para agarrar una muestra sin rozar rocas.
// Params (challenges.json): seconds, assistSeconds, grabs, assistGrabs, tolerance (unidades del dibujo), perfectTries,
// len1, len2, armRadius, base [x,y], sample [x,y], rocks [[x,y,r],...], shoulderMin/Max, elbowMin/Max, startShoulder, startElbow.
// Puntuación: agarra en los primeros `perfectTries` intentos sin haber rozado una roca → perfecto; más tarde o tras rozar → parcial; no agarra → fallo (valores en challenges.json, scores).
// «Rozar» = intentar agarrar con un segmento tocando una roca (girar los ejes sin agarrar no penaliza).
// Controles «por ejes»: dos filas de botones (1 hombro, 2 codo; mantener pulsado repite), arrastre en el dibujo
// (el codo gira el hombro, la punta gira el codo) y teclado (←/→ hombro, ↑/↓ codo, Espacio/Enter agarra).
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { defaultConfig } from '../../sim/config';
import { playArmGrab, playDial, playGood, playHit, playMiss } from '../../audio/sfx';
import { Icon } from '../icons';
import type { ChallengeGameProps } from './registry';
import { numParam, TimeBar, useCountdown } from './shared';

const VW = 300;
const VH = 200;
/** Constantes de manejo (no son balance): repetición al mantener pulsado y radio de toque de las articulaciones. */
const REPEAT_DELAY_MS = 320;
const REPEAT_MS = 85;
const HIT_R = 26;

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

/** Envuelve el ángulo al lado más cercano del rango y lo limita. */
function clampAngle(a: number, min: number, max: number): number {
  const mid = (min + max) / 2;
  let v = a;
  while (v - mid > 180) v -= 360;
  while (v - mid < -180) v += 360;
  return Math.max(min, Math.min(max, v));
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

  // Paso de los botones y del teclado: ~45 pulsaciones por recorrido (hay solución dentro de la tolerancia en las dos dificultades).
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
    const [lo, hi] = key === 'sh' ? [shMin, shMax] : [elMin, elMax];
    const nv = clampAngle(v, lo, hi);
    if (nv === runRef.current[key]) return;
    playDial((nv - lo) / Math.max(1, hi - lo));
    const next = { ...runRef.current, [key]: nv, msg: '' };
    runRef.current = next;
    setRun(next);
  };
  /** dir +1 = contra el reloj (◄ / ← / ↑), -1 = a favor del reloj (► / → / ↓). */
  const nudge = (key: 'sh' | 'el', dir: 1 | -1): void =>
    move(key, runRef.current[key] + dir * (key === 'sh' ? shStep : elStep));

  const grab = (): void => {
    const r = runRef.current;
    if (r.end) return;
    playArmGrab();
    const used = r.used + 1;
    let next: Run = { ...r, used };
    if (hit) {
      playHit();
      next = { ...next, touched: true, msg: t('challenge.arm.msg.blocked') };
    } else if (dist <= tol) {
      playGood();
      next = { ...next, okAt: used, end: true, msg: t('challenge.arm.msg.ok') };
    } else {
      playMiss();
      next = { ...next, msg: t('challenge.arm.msg.miss') };
    }
    if (!next.end && used >= grabsMax) next = { ...next, end: true, msg: t('challenge.arm.end.grabs') };
    runRef.current = next;
    setRun(next);
    if (next.end) finish(next, 1000);
  };
  // `grab` depende del dibujo actual (hit, dist): el teclado usa siempre la última versión.
  const grabRef = useRef(grab);
  grabRef.current = grab;

  // Mantener pulsado repite el giro; se detiene al soltar, salir, cancelar y al desmontar.
  const hold = useRef({ delay: 0, rep: 0 });
  const stopHold = (): void => {
    window.clearTimeout(hold.current.delay);
    window.clearInterval(hold.current.rep);
  };
  const startHold = (key: 'sh' | 'el', dir: 1 | -1): void => {
    stopHold();
    nudge(key, dir);
    hold.current.delay = window.setTimeout(() => {
      hold.current.rep = window.setInterval(() => nudge(key, dir), REPEAT_MS);
    }, REPEAT_DELAY_MS);
  };
  useEffect(() => stopHold, []);
  useEffect(() => {
    if (run.end) stopHold();
  }, [run.end]);

  // Arrastrar en el dibujo: el codo gira el hombro, la punta gira el codo.
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<null | 'sh' | 'el'>(null);
  const toSvg = (e: PointerEvent): [number, number] => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };
  const dragTo = (px: number, py: number): void => {
    const r = runRef.current;
    if (dragging.current === 'sh') {
      move('sh', Math.atan2(by - py, px - bx) / rad);
    } else if (dragging.current === 'el') {
      const jxr = bx + l1 * Math.cos(r.sh * rad);
      const jyr = by - l1 * Math.sin(r.sh * rad);
      move('el', Math.atan2(jyr - py, px - jxr) / rad - r.sh);
    }
  };
  const onDown = (e: PointerEvent): void => {
    if (runRef.current.end) return;
    const [px, py] = toSvg(e);
    const dTip = Math.hypot(px - tx, py - ty);
    const dJoint = Math.hypot(px - jx, py - jy);
    const pick: 'sh' | 'el' = dTip <= dJoint ? 'el' : 'sh';
    if (Math.min(dTip, dJoint) > HIT_R) return;
    dragging.current = pick;
    svgRef.current?.setPointerCapture(e.pointerId);
    e.preventDefault();
    dragTo(px, py);
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging.current) return;
    const [px, py] = toSvg(e);
    dragTo(px, py);
  };
  const onUp = (): void => {
    dragging.current = null;
  };

  // Teclado: ←/→ hombro, ↑/↓ codo, Espacio/Enter agarra (si no hay un botón enfocado).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const dirs: Record<string, ['sh' | 'el', 1 | -1]> = {
        ArrowLeft: ['sh', 1],
        ArrowRight: ['sh', -1],
        ArrowUp: ['el', 1],
        ArrowDown: ['el', -1],
      };
      const d = dirs[e.key];
      if (d) {
        e.preventDefault();
        nudge(d[0], d[1]);
        return;
      }
      if ((e.key === ' ' || e.key === 'Enter') && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) {
        e.preventDefault();
        grabRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const arc = (cx: number, cy: number, r: number, a1: number, a2: number): string => {
    const p = (a: number): string => `${(cx + r * Math.cos(a * rad)).toFixed(1)} ${(cy - r * Math.sin(a * rad)).toFixed(1)}`;
    return `M${p(a1)} A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 0 ${p(a2)}`;
  };
  const segCls = (c: string): string => `chl-arm-seg chl-arm-seg--${c}${hit ? ' chl-arm-seg--hit' : ''}`;

  const axis = (key: 'sh' | 'el', n: 1 | 2) => {
    const name = t(key === 'sh' ? 'challenge.arm.shoulder' : 'challenge.arm.elbow');
    const btn = (dir: 1 | -1) => (
      <button
        type="button"
        class={`btn chl-arm-turn chl-arm-turn--${n}`}
        disabled={run.end}
        aria-label={t(dir === 1 ? 'challenge.arm.ccw' : 'challenge.arm.cw', { axis: name })}
        onPointerDown={(e) => {
          e.preventDefault();
          startHold(key, dir);
        }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          // El clic de puntero ya giró en pointerdown; solo el teclado (detail 0) gira aquí.
          if (e.detail === 0) nudge(key, dir);
        }}
      >
        <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
          <path d={dir === 1 ? 'M14 3 5 10l9 7Z' : 'M6 3l9 7-9 7Z'} />
        </svg>
      </button>
    );
    return (
      <div class={`chl-arm-axis chl-arm-axis--${n}`} role="group" aria-label={name}>
        <span class="chl-arm-badge" aria-hidden="true">{n}</span>
        <span class="chl-arm-axis__name">
          {name} <b>{t('challenge.arm.deg', { n: Math.round(run[key]) })}</b>
        </span>
        {btn(1)}
        {btn(-1)}
      </div>
    );
  };

  return (
    <div class="chl-game chl-arm">
      <p class="chl-howto">{t('challenge.day12_robotic_arm.how')}</p>
      <TimeBar left={left} total={seconds} />
      <svg
        ref={svgRef}
        class="chl-arm-svg"
        viewBox={`0 0 ${VW} ${VH}`}
        role="img"
        aria-label={t('challenge.arm.alt')}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
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
        <path d={arc(bx, by, 26, shMin, shMax)} class="chl-arm-arc chl-arm-arc--1" />
        <path d={arc(jx, jy, 22, run.sh + elMin, run.sh + elMax)} class="chl-arm-arc chl-arm-arc--2" />
        <line x1={bx} y1={by} x2={jx} y2={jy} class={segCls('1')} />
        <line x1={jx} y1={jy} x2={tx} y2={ty} class={segCls('2')} />
        <circle cx={bx} cy={by} r="10" class="chl-arm-joint chl-arm-joint--1" />
        <text x={bx} y={by + 4} class="chl-arm-num" text-anchor="middle">1</text>
        <circle cx={jx} cy={jy} r="10" class="chl-arm-joint chl-arm-joint--2" />
        <text x={jx} y={jy + 4} class="chl-arm-num" text-anchor="middle">2</text>
        <circle cx={tx} cy={ty} r="6" class="chl-arm-tip" />
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
        {axis('sh', 1)}
        {axis('el', 2)}
        <button type="button" class="btn btn--primary chl-arm-grab" disabled={run.end} onClick={grab}>
          {t('challenge.arm.grab')}
        </button>
      </div>
      <p class="chl-msg" role="status" aria-live="polite">{run.msg || t('challenge.arm.hint')}</p>
    </div>
  );
}
