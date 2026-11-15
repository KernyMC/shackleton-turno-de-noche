// Reto del día 4, «Antenas de clima espacial»: encaja la onda de cada antena con la de referencia.
// Params: seconds, assistSeconds, tolerance (fracción 0..1 del recorrido; si es > 1 se lee como %), waves.
// Opcional `targets` (number[] de 0..1) fija dónde está la onda de referencia; si falta, sale de una fórmula fija.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { Icon } from '../icons';
import type { ChallengeGameProps } from './registry';
import { numParam, TimeBar, useCountdown } from './shared';
import { playDial, playSnap } from '../../audio/sfx';

const W = 240;
const H = 70;
/** Paso del deslizador: ~40 pulsaciones de teclado por recorrido (la tolerancia de las dos dificultades es ≥ 0.15). */
const SLIDER_STEP = 0.025;

function wavePath(freq: number, phase: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const x = (i / 80) * W;
    const y = H / 2 - Math.sin(2 * Math.PI * (freq * (i / 80) + phase)) * (H / 2 - 8);
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Diferencia circular entre dos fases 0..1 (una onda repite cada vuelta). */
function gap(a: number, b: number): number {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
}

export function SolarRadar({ params, assist, onDone }: ChallengeGameProps) {
  const waves = Math.max(1, Math.round(numParam(params, 'waves', 3)));
  const seconds = numParam(params, 'seconds', 18) + assist * numParam(params, 'assistSeconds', 0);
  const rawTol = numParam(params, 'tolerance', 0.15);
  const tol = rawTol > 1 ? rawTol / 100 : rawTol;
  const given = Array.isArray(params.targets) ? (params.targets as number[]) : [];
  const targets = Array.from({ length: waves }, (_, i) => given[i] ?? (0.23 + i * 0.37 + i * i * 0.05) % 1);
  const freqs = Array.from({ length: waves }, (_, i) => 1.5 + (i % 3) * 0.5);
  // Las ondas empiezan lejos del objetivo (media vuelta) para que haya que moverlas.
  const [vals, setVals] = useState<number[]>(() => targets.map((tg) => (tg + 0.5) % 1));
  const doneRef = useRef(false);

  const aligned = vals.map((v, i) => gap(v, targets[i]!) <= tol);
  const count = aligned.filter(Boolean).length;
  const countRef = useRef(count);
  countRef.current = count;

  const finish = (n: number): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(n / waves);
  };
  const left = useCountdown(seconds, () => finish(countRef.current));

  useEffect(() => {
    if (count !== waves || doneRef.current) return;
    const id = window.setTimeout(() => finish(waves), 700);
    return () => window.clearTimeout(id);
  }, [count]);

  return (
    <div class="chl-game chl-radar">
      <p class="chl-howto">{t('challenge.day04_solar_radar.how')}</p>
      <TimeBar left={left} total={seconds} />
      <ul class="chl-antennas">
        {vals.map((v, i) => (
          <li key={i} class={`chl-antenna${aligned[i] ? ' chl-antenna--ok' : ''}`}>
            <div class="chl-antenna__head">
              <span class="chl-antenna__name">{t('challenge.radar.antenna', { n: i + 1 })}</span>
              <span class="chl-antenna__state">
                <Icon name={aligned[i] ? 'check' : 'alert'} size={16} />
                {t(aligned[i] ? 'challenge.radar.locked' : 'challenge.radar.off')}
              </span>
            </div>
            <svg class="chl-wave" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('challenge.radar.wave_alt', { n: i + 1 })}>
              <path d={wavePath(freqs[i]!, targets[i]!)} class="chl-wave__ref" />
              <path d={wavePath(freqs[i]!, v)} class="chl-wave__mine" />
            </svg>
            <label class="chl-slider">
              <span class="chl-slider__label">{t('challenge.radar.slider', { n: i + 1 })}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={SLIDER_STEP}
                value={v}
                onInput={(e) => {
                  if (doneRef.current) return;
                  const nv = Number((e.currentTarget as HTMLInputElement).value);
                  playDial(nv);
                  if (!aligned[i] && gap(nv, targets[i]!) <= tol) playSnap();
                  setVals((a) => a.map((x, j) => (j === i ? nv : x)));
                }}
              />
            </label>
          </li>
        ))}
      </ul>
      <p class="chl-legend">
        <span class="chl-key chl-key--ref" /> {t('challenge.radar.ref')} <span class="chl-key chl-key--mine" /> {t('challenge.radar.mine')}
      </p>
    </div>
  );
}
