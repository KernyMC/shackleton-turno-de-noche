// Reto del día 30, «Llega la nave de relevo»: cuatro barras, una por tripulante. Cada cursor sube y baja con un
// seno; el jugador fija cada barra cuando el cursor está en la zona. Cierre de la misión: nunca se pierde nada grave.
// Params (challenges.json): seconds, zone (alto de la zona, 0..1), speeds[4] (ciclos por segundo),
// zoneAt[4] (centro de cada zona, 0..1), phases[4] (fase inicial en vueltas, 0..1). Con movimiento reducido no hay
// animación: cada barra tiene botones «Subir/Bajar» (mueven el cursor en el mismo sentido de la barra) y «Fijar».
// Puntuación: barras en zona / 4 (4 = perfecto, 2–3 = parcial, menos = fallo según los cortes de challenges.json).
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { CREW, crewName } from '../../data/crew';
import { Icon } from '../icons';
import type { ChallengeGameProps } from './registry';
import { TimeBar, numParam, useCountdown } from './shared';

const BARS = 4;
/** Con movimiento reducido: cuánto sube o baja el cursor (en % del carril) cada vez que se pulsa Subir o Bajar. */
const MANUAL_STEP = 5;

function listParam(v: unknown, fallback: (i: number) => number): number[] {
  const arr = Array.isArray(v) ? (v as unknown[]) : [];
  return Array.from({ length: BARS }, (_, i) => {
    const n = arr[i];
    return typeof n === 'number' && Number.isFinite(n) ? n : fallback(i);
  });
}

type Fix = 'free' | 'in' | 'out';

export function RelayDocking({ params, onDone }: ChallengeGameProps) {
  const seconds = Math.max(5, numParam(params, 'seconds', 25));
  const zone = Math.min(0.9, Math.max(0.1, numParam(params, 'zone', 0.3)));
  const speeds = listParam(params.speeds, (i) => 0.25 + i * 0.07);
  const phases = listParam(params.phases, (i) => i * 0.23);
  const centers = listParam(params.zoneAt, (i) => [0.3, 0.65, 0.45, 0.75][i]).map((c) =>
    Math.min(1 - zone / 2, Math.max(zone / 2, c)),
  );

  const reduced = useRef(
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  ).current;

  const [fix, setFix] = useState<Fix[]>(Array(BARS).fill('free'));
  const [manual, setManual] = useState<number[]>(Array(BARS).fill(50));
  const [, setTick] = useState(0);
  const [ended, setEnded] = useState(false);
  const fixRef = useRef(fix);
  fixRef.current = fix;
  const tRef = useRef(0);
  const doneRef = useRef(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const posAt = (i: number, time: number): number => 0.5 + 0.5 * Math.sin(2 * Math.PI * (speeds[i] * time + phases[i]));
  const inZone = (i: number, pos: number): boolean => Math.abs(pos - centers[i]) <= zone / 2;

  const finish = (): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    setEnded(true);
    const hits = fixRef.current.filter((f) => f === 'in').length;
    timer.current = window.setTimeout(() => onDone(hits / BARS), 1100);
  };

  const left = useCountdown(seconds, finish, !ended);

  // Movimiento: un solo bucle; en pausa si la pestaña está oculta o hay movimiento reducido.
  useEffect(() => {
    if (reduced || ended) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!document.hidden) {
        tRef.current += dt;
        setTick((n) => (n + 1) % 1e6);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced, ended]);

  const nudge = (i: number, d: number): void => {
    if (ended || fixRef.current[i] !== 'free') return;
    setManual((m) => m.map((x, k) => (k === i ? Math.max(0, Math.min(100, x + d)) : x)));
  };

  const lock = (i: number): void => {
    if (ended || fixRef.current[i] !== 'free') return;
    const pos = reduced ? manual[i] / 100 : posAt(i, tRef.current);
    const next = fixRef.current.slice();
    next[i] = inZone(i, pos) ? 'in' : 'out';
    fixRef.current = next;
    setFix(next);
    if (next.every((f) => f !== 'free')) finish();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const i = '1234'.indexOf(e.key);
      if (i < 0 || e.key.length !== 1) return;
      e.preventDefault();
      lock(i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manual, ended]);

  const hits = fix.filter((f) => f === 'in').length;
  const endKey = ended ? `challenge.relay.end.${hits === BARS ? 'all' : hits >= 2 ? 'some' : 'few'}` : '';

  return (
    <div class="chl-game chl-relay">
      <p class="chl-howto">{t(reduced ? 'challenge.relay.how_reduced' : 'challenge.day30_relay_docking.how')}</p>
      <TimeBar left={left} total={seconds} />
      <div class="chl-relay-bars">
        {CREW.slice(0, BARS).map((c, i) => {
          const pos = reduced ? manual[i] / 100 : posAt(i, tRef.current);
          const f = fix[i];
          const zoneBottom = (centers[i] - zone / 2) * 100;
          return (
            <div key={c.id} class={`chl-relay-bar chl-relay-bar--${f}`} style={{ ['--chl-relay-c' as string]: c.css }}>
              <b class="chl-relay-name">{crewName(c.id)}</b>
              <div class="chl-relay-track">
                <div class="chl-relay-zone" style={{ bottom: `${zoneBottom}%`, height: `${zone * 100}%` }}>
                  <span>{t('challenge.relay.zone')}</span>
                </div>
                <div class="chl-relay-cursor" style={{ bottom: `${pos * 100}%` }} />
              </div>
              <span class="chl-relay-state">
                {f === 'in' ? <Icon name="check" size={16} /> : f === 'out' ? <Icon name="close" size={16} /> : <Icon name="target" size={16} />}{' '}
                {t(`challenge.relay.${f}`)}
              </span>
              {reduced && (
                <div class="chl-relay-nudge" role="group" aria-label={t('challenge.relay.slider', { name: crewName(c.id) })} style={{ display: 'flex', gap: '0.25rem', width: '100%' }}>
                  <button
                    type="button"
                    class="btn chl-relay-up"
                    style={{ flex: 1, minHeight: '44px', minWidth: 0 }}
                    disabled={f !== 'free' || ended || manual[i] >= 100}
                    aria-label={t('challenge.relay.up_for', { name: crewName(c.id) })}
                    onClick={() => nudge(i, MANUAL_STEP)}
                  >
                    {t('challenge.relay.up')}
                  </button>
                  <button
                    type="button"
                    class="btn chl-relay-down"
                    style={{ flex: 1, minHeight: '44px', minWidth: 0 }}
                    disabled={f !== 'free' || ended || manual[i] <= 0}
                    aria-label={t('challenge.relay.down_for', { name: crewName(c.id) })}
                    onClick={() => nudge(i, -MANUAL_STEP)}
                  >
                    {t('challenge.relay.down')}
                  </button>
                </div>
              )}
              <button
                type="button"
                class="btn chl-relay-btn"
                disabled={f !== 'free' || ended}
                aria-label={t('challenge.relay.fix_for', { name: crewName(c.id) })}
                onClick={() => lock(i)}
              >
                {t('challenge.relay.fix')} <kbd>{i + 1}</kbd>
              </button>
            </div>
          );
        })}
      </div>
      <p class="chl-msg" role="status" aria-live="polite">
        {endKey ? t(endKey) : t('challenge.relay.count', { n: hits, total: BARS })}
      </p>
    </div>
  );
}
