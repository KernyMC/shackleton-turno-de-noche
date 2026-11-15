// Radar de sectores compartido por los retos del día 18 (micrometeoritos) y del día 24 (tormenta solar).
// Params: sectors, waves, warnSeconds, assistWarn, readySeconds, impactSeconds, arc, assistArc, sequence (opcional, 0-based).
// Puntuación: oleadas bloqueadas / oleadas. El arco cubre `arc + round(assist*assistArc) + arcBonus` sectores.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { Icon } from '../icons';
import type { ChallengeGameProps } from './registry';
import { numParam, TimeBar } from './shared';
import { playDeflect, playHit, playPick, playWhoosh } from '../../audio/sfx';

export interface SectorDefenseProps extends Pick<ChallengeGameProps, 'params' | 'assist' | 'onDone'> {
  /** Clave i18n del «cómo se juega». */
  howKey: string;
  /** Tema: busca `challenge.sector.<theme>.shield` y `.cover`. */
  theme: string;
  /** Sectores extra que cubre el escudo (p. ej. por una decisión previa). */
  arcBonus?: number;
  /** Controles adicionales opcionales, debajo del radar. */
  extra?: ComponentChildren;
}

const C = 100;
const R_OUT = 92;
const R_IN = 30;

function pt(r: number, deg: number): string {
  const a = (deg * Math.PI) / 180;
  return `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
}

function wedge(i: number, n: number): string {
  const step = 360 / n;
  const a0 = -90 + i * step - step / 2 + 1;
  const a1 = -90 + i * step + step / 2 - 1;
  return `M${pt(R_IN, a0)} L${pt(R_OUT, a0)} A${R_OUT} ${R_OUT} 0 0 1 ${pt(R_OUT, a1)} L${pt(R_IN, a1)} A${R_IN} ${R_IN} 0 0 0 ${pt(R_IN, a0)}Z`;
}

function labelPos(i: number, n: number): { x: number; y: number } {
  const a = ((-90 + (i * 360) / n) * Math.PI) / 180;
  const r = (R_IN + R_OUT) / 2;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}

/** Sectores cubiertos por un arco de `arc` sectores centrado en `center`. */
export function coveredSectors(center: number, arc: number, n: number): number[] {
  const left = Math.floor((arc - 1) / 2);
  const right = arc - 1 - left;
  const out: number[] = [];
  for (let k = -left; k <= right; k++) out.push((((center + k) % n) + n) % n);
  return out;
}

export function SectorDefense({ params, assist, onDone, howKey, theme, arcBonus = 0, extra }: SectorDefenseProps) {
  const n = Math.max(3, Math.round(numParam(params, 'sectors', 8)));
  const waves = Math.max(1, Math.round(numParam(params, 'waves', 6)));
  const warn = numParam(params, 'warnSeconds', 3) + assist * numParam(params, 'assistWarn', 0);
  const ready = numParam(params, 'readySeconds', 1.5);
  const impact = numParam(params, 'impactSeconds', 1);
  const arc = Math.min(
    n,
    Math.max(1, Math.round(numParam(params, 'arc', 1) + assist * numParam(params, 'assistArc', 0)) + arcBonus),
  );
  const given = Array.isArray(params.sequence) ? (params.sequence as number[]) : [];
  const seq = Array.from({ length: waves }, (_, i) => {
    const g = given[i];
    return typeof g === 'number' ? ((Math.round(g) % n) + n) % n : (i * 3 + 1 + (i >> 2)) % n;
  });
  const per = warn + impact;
  const total = ready + waves * per;

  const [center, setCenter] = useState(0);
  const centerRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const resultsRef = useRef<boolean[]>([]);
  const doneRef = useRef(false);

  const move = (to: number, turn = false): void => {
    const c = ((to % n) + n) % n;
    if (c !== centerRef.current) (turn ? playWhoosh : playPick)();
    centerRef.current = c;
    setCenter(c);
  };

  useEffect(() => {
    let e = 0;
    let prev = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - prev) / 1000, 0.5);
      prev = now;
      if (document.hidden || doneRef.current) return;
      e += dt;
      const into = e - ready;
      if (into >= 0) {
        const k = Math.min(waves - 1, Math.floor(into / per));
        for (let w = 0; w <= k; w++) {
          if (into >= w * per + warn && resultsRef.current.length === w) {
            const ok = coveredSectors(centerRef.current, arc, n).includes(seq[w]!);
            (ok ? playDeflect : playHit)();
            resultsRef.current = [...resultsRef.current, ok];
            setResults(resultsRef.current);
          }
        }
      }
      if (e >= total) {
        doneRef.current = true;
        setElapsed(total);
        onDone(resultsRef.current.filter(Boolean).length / waves);
        return;
      }
      setElapsed(e);
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (doneRef.current) return;
      if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        move(centerRef.current - 1, true);
      } else if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        move(centerRef.current + 1, true);
      } else if (/^[1-9]$/.test(ev.key) && Number(ev.key) <= n) {
        move(Number(ev.key) - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const into = elapsed - ready;
  const k = into >= 0 ? Math.min(waves - 1, Math.floor(into / per)) : -1;
  const within = k >= 0 ? into - k * per : 0;
  const warning = k >= 0 && results.length <= k && within < warn;
  const impacting = k >= 0 && results.length > k;
  const incoming = warning ? seq[k]! : -1;
  const lastOk = results.length > 0 ? results[results.length - 1]! : null;
  const covered = coveredSectors(center, arc, n);
  const blocked = results.filter(Boolean).length;
  const shieldName = t(`challenge.sector.${theme}.shield`);

  return (
    <div class="chl-game chl-sector">
      <p class="chl-howto">{t(howKey)}</p>
      <TimeBar left={Math.max(0, total - elapsed)} total={total} />
      <div class="chl-sector-score">
        <span class="chl-sector-count">
          <Icon name="check" size={16} /> {t('challenge.sector.count', { ok: blocked, total: waves })}
        </span>
        <span class="chl-sector-count">
          <Icon name="alert" size={16} /> {t('challenge.sector.hits', { n: results.length - blocked })}
        </span>
      </div>
      <p class={`chl-sector-msg${warning ? ' chl-sector-msg--warn' : ''}`} role="status">
        {warning ? (
          <>
            <Icon name="alert" size={18} /> {t('challenge.sector.incoming', { n: incoming + 1 })}{' '}
            <span class="chl-sector-wave">{t('challenge.sector.wave', { n: k + 1, total: waves })}</span>
          </>
        ) : impacting && lastOk !== null && !doneRef.current ? (
          <>
            <Icon name={lastOk ? 'check' : 'alert'} size={18} /> {t(lastOk ? 'challenge.sector.blocked' : 'challenge.sector.hit')}
          </>
        ) : (
          t('challenge.sector.waiting')
        )}
      </p>
      <svg class="chl-sector-radar" viewBox="0 0 200 200" role="img" aria-label={t('challenge.sector.radar_alt', { n })}>
        {Array.from({ length: n }, (_, i) => {
          const isShield = covered.includes(i);
          const isIn = incoming === i;
          const flash = impacting && seq[k] === i && lastOk !== null ? (lastOk ? ' chl-sector-wedge--block' : ' chl-sector-wedge--hit') : '';
          const p = labelPos(i, n);
          return (
            <g key={i} onClick={() => !doneRef.current && move(i)}>
              <path
                d={wedge(i, n)}
                class={`chl-sector-wedge${isShield ? ' chl-sector-wedge--shield' : ''}${isIn ? ' chl-sector-wedge--in' : ''}${flash}`}
              />
              <text x={p.x} y={p.y} class="chl-sector-num" text-anchor="middle" dominant-baseline="central">
                {isIn ? '!' : i + 1}
              </text>
            </g>
          );
        })}
        <circle cx={C} cy={C} r={R_IN - 4} class="chl-sector-base" />
        <rect x={C - 7} y={C - 7} width="14" height="14" class="chl-sector-core" />
      </svg>
      <p class="chl-sector-cover">
        <Icon name="shield" size={16} />{' '}
        {t(`challenge.sector.${theme}.cover`, {
          shield: shieldName,
          list: covered.map((s) => s + 1).sort((a, b) => a - b).join(', '),
        })}
      </p>
      <div class="chl-sector-btns">
        <button type="button" class="btn chl-sector-turn" aria-label={t('challenge.sector.left')} onClick={() => move(center - 1, true)}>
          <Icon name="arrow" size={18} />
        </button>
        <div class="chl-sector-nums" role="group" aria-label={t('challenge.sector.pick')}>
          {Array.from({ length: n }, (_, i) => (
            <button
              key={i}
              type="button"
              // Solo el sector elegido queda marcado; los que el escudo cubre de más van con borde suave.
              class={`btn chl-sector-btn${i === ((center % n) + n) % n ? ' chl-sector-btn--on' : covered.includes(i) ? ' chl-sector-btn--also' : ''}`}
              aria-pressed={i === ((center % n) + n) % n}
              aria-label={t('challenge.sector.btn', { n: i + 1 })}
              onClick={() => move(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button type="button" class="btn chl-sector-turn chl-sector-turn--r" aria-label={t('challenge.sector.right')} onClick={() => move(center + 1, true)}>
          <Icon name="arrow" size={18} />
        </button>
      </div>
      <p class="chl-legend">{t('challenge.sector.keys', { max: n })}</p>
      {extra}
    </div>
  );
}
