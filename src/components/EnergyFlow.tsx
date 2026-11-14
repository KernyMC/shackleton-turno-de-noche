// De dónde sale la energía, en tres pasos de izquierda a derecha:
//   Sol hoy +51  →  Batería 54 / 100  →  Para repartir hoy 95
// Debajo (versión completa), el gasto fijo de la base, para que la cuenta cuadre:
//   batería + Sol − base = para repartir.
// Cada paso explica su número en lenguaje simple al pasar el cursor, enfocarlo o tocarlo.
// Solo lee el store. La energía se cuenta en "unidades de energía" del juego (ícono de rayo).
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { budget, game } from '../state/store';
import { num } from './format';
import { Icon } from './icons';
import type { IconName } from './icons';

function Step({ icon, label, value, tip, cls, mark }: { icon: IconName; label: string; value: string; tip: string; cls: string; mark?: string }) {
  return (
    <span class={`eflow__step eflow__step--${cls}`} tabIndex={0} aria-label={`${label}: ${value}${mark ? ` (${mark})` : ''}. ${tip}`}>
      <span class="eflow__icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span class="eflow__text" aria-hidden="true">
        <span class="eflow__label">{label}</span>
        <b class="eflow__value">{value}</b>
        {mark && <span class="eflow__mark">{mark}</span>}
      </span>
      <span class="eflow__tip" role="tooltip">
        {tip}
      </span>
    </span>
  );
}

export function EnergyFlow({ compact = false }: { compact?: boolean }) {
  const g = game.value;
  const b = budget.value;
  if (!g || !b) return null;
  const capacity = defaultConfig.balance.difficulty[g.difficulty].batteryCapacity;
  const noSun = b.solar < 0.5;
  // Polvo en los paneles: el porcentaje sale del balance, no está escrito a mano.
  const dustPct = Math.round((1 - defaultConfig.balance.effects.dustSolarFactor) * 100);
  const dusty = g.dust && !noSun;
  return (
    <div class={`eflow${compact ? ' eflow--compact' : ''}${noSun ? ' eflow--night' : ''}`} role="group" aria-label={t('eflow.aria')}>
      <div class="eflow__row">
        <Step
          cls="sun"
          icon={noSun ? 'moon' : 'sun'}
          label={t(noSun ? 'eflow.no_sun' : 'eflow.sun')}
          value={noSun ? '0' : `+${num(b.solar, 0)}`}
          tip={dusty ? `${t('eflow.tip.sun')} ${t('eflow.tip.dust', { pct: dustPct })}` : t(noSun ? 'eflow.tip.no_sun' : 'eflow.tip.sun')}
          mark={dusty ? t('eflow.dust', { pct: dustPct }) : undefined}
        />
        <span class="eflow__arrow" aria-hidden="true">
          <Icon name="arrow" size={16} />
        </span>
        <Step
          cls="battery"
          icon="battery"
          label={t('eflow.battery')}
          value={`${num(g.battery, 0)} / ${capacity}`}
          tip={t('eflow.tip.battery')}
        />
        <span class="eflow__arrow" aria-hidden="true">
          <Icon name="arrow" size={16} />
        </span>
        <Step cls="spend" icon="bolt" label={t('eflow.spend')} value={num(b.available, 0)} tip={t('eflow.tip.spend', { base: b.base })} />
      </div>
      {!compact && (
        <p class="eflow__note">
          <Icon name="info" size={13} />
          {t('eflow.base', { base: b.base })}
        </p>
      )}
    </div>
  );
}
