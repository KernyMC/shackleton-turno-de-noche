// Utilidades comunes de los retos: reloj, barra de tiempo, formateador de efectos y lectura de params.
// Ningún número de balance aquí: los valores vienen de `def.params` (public/data/challenges.json).
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ChallengeEffect, ChallengeParams } from '../../sim/types';
import { t } from '../../i18n';
import { Icon } from '../icons';
import type { IconName } from '../icons';

/** Lee un número de los params; si falta usa `fallback` (documentado en cada reto). */
export function numParam(p: ChallengeParams, key: string, fallback: number): number {
  const v = p[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Cuenta atrás en segundos. Se detiene con la pestaña oculta y avisa una sola vez al llegar a 0. */
export function useCountdown(seconds: number, onEnd: () => void, running = true): number {
  const [left, setLeft] = useState(seconds);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    if (!running) return;
    let remaining = seconds;
    let last = performance.now();
    let fired = false;
    setLeft(seconds);
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.5);
      last = now;
      if (document.hidden || fired) return;
      remaining = Math.max(0, remaining - dt);
      setLeft(remaining);
      if (remaining <= 0) {
        fired = true;
        endRef.current();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [seconds, running]);
  return left;
}

/** Barra de tiempo con el número al lado (nunca solo color). */
export function TimeBar({ left, total }: { left: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  return (
    <div class="chl-time">
      <span class="chl-time__label">
        <Icon name="ff" size={16} /> {t('challenge.time')}
      </span>
      <div
        class="chl-time__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.ceil(left)}
        aria-label={t('challenge.time')}
      >
        <div class="chl-time__fill" style={{ width: `${pct * 100}%` }} />
      </div>
      <b class="chl-time__num">{t('challenge.seconds', { n: Math.ceil(left) })}</b>
    </div>
  );
}

function signed(n: number): string {
  const s = Number.isInteger(n) ? String(Math.abs(n)) : Math.abs(n).toFixed(1);
  return n < 0 ? `−${s}` : `+${s}`;
}

const RESOURCE_ICON: Record<string, IconName> = {
  lifeSupport: 'life_support',
  food: 'food',
  dose: 'dose',
  battery: 'battery',
};

/** Un efecto de reto como texto + ícono. Con «bueno/malo» en palabras, no solo en color. */
export function effectLine(e: ChallengeEffect): { icon: IconName; text: string; good: boolean } {
  switch (e.type) {
    case 'resource': {
      // Más dosis es malo; más de cualquier otro recurso es bueno.
      const good = e.key === 'dose' ? e.amount <= 0 : e.amount >= 0;
      return { icon: RESOURCE_ICON[e.key] ?? 'info', text: t(`challenge.effect.resource.${e.key}`, { amount: signed(e.amount) }), good };
    }
    case 'break':
      return { icon: 'alert', text: t('challenge.effect.break', { module: t(`module.${e.module}`) }), good: false };
    case 'daily':
      return {
        icon: 'life_support',
        text: t('challenge.effect.daily', { amount: signed(e.amount), days: e.days }),
        good: e.amount >= 0,
      };
    case 'doseFactor':
      return {
        icon: 'dose',
        text: t(e.factor < 1 ? 'challenge.effect.dose_less' : 'challenge.effect.dose_more', {
          pct: Math.round(Math.abs(1 - e.factor) * 100),
        }),
        good: e.factor <= 1,
      };
    case 'noWarnings':
      return { icon: 'alert', text: t('challenge.effect.no_warnings', { day: e.untilDay }), good: false };
  }
}

/** Lista de efectos; vacía → «Sin cambios». */
export function EffectList({ effects }: { effects: ChallengeEffect[] }) {
  if (effects.length === 0) return <p class="chl-none">{t('challenge.no_change')}</p>;
  return (
    <ul class="chl-fx">
      {effects.map((e, i) => {
        const l = effectLine(e);
        return (
          <li key={i} class={`chl-fx__item chl-fx__item--${l.good ? 'good' : 'bad'}`}>
            <Icon name={l.icon} size={18} />
            <span>{l.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
