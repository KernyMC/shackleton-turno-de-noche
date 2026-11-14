// Reto del día 24, «Gran tormenta solar»: primero un dilema de energía y luego el muro del refugio (SectorDefense).
// Param extra: offArc = sectores que gana el muro si se apaga el Invernadero.
// La consecuencia de cada elección (def.options en challenges.json) se muestra en el botón y se aplica al terminar.
import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { ChallengeEffect } from '../../sim/types';
import { Icon } from '../icons';
import type { ChallengeGameProps } from './registry';
import { effectLine, numParam } from './shared';
import { SectorDefense } from './SectorDefense';

type Choice = 'greenhouse_off' | 'all_on';

/** Consecuencia de una opción en frases cortas (solo texto en línea: va dentro de un botón). */
function Consequence({ effects }: { effects: ChallengeEffect[] }) {
  if (effects.length === 0) return <span class="chl-sector-fx">{t('challenge.no_change')}</span>;
  return (
    <span class="chl-sector-fx">
      {effects.map((e, i) => {
        const l = effectLine(e);
        return (
          <span key={i} class={`chl-sector-fx__item chl-fx__item--${l.good ? 'good' : 'bad'}`}>
            <Icon name={l.icon} size={16} /> {l.text}
          </span>
        );
      })}
    </span>
  );
}

export function SuperStorm({ params, assist, options, onDone }: ChallengeGameProps) {
  const [choice, setChoice] = useState<Choice | null>(null);
  if (choice === null) {
    return (
      <div class="chl-game chl-sector-choice">
        <p class="chl-howto">{t('challenge.day24_super_storm.how')}</p>
        <h3 class="chl-sector-q">{t('challenge.day24_super_storm.choice.q')}</h3>
        <div class="chl-sector-opts">
          <button type="button" class="btn chl-sector-opt" onClick={() => setChoice('greenhouse_off')}>
            <Icon name="greenhouse" size={28} />
            <b>{t('challenge.day24_super_storm.choice.off.title')}</b>
            <span>{t('challenge.day24_super_storm.choice.off.text')}</span>
            <Consequence effects={options?.greenhouse_off ?? []} />
          </button>
          <button type="button" class="btn chl-sector-opt" onClick={() => setChoice('all_on')}>
            <Icon name="battery" size={28} />
            <b>{t('challenge.day24_super_storm.choice.on.title')}</b>
            <span>{t('challenge.day24_super_storm.choice.on.text')}</span>
            <Consequence effects={options?.all_on ?? []} />
          </button>
        </div>
      </div>
    );
  }
  return (
    <SectorDefense
      params={params}
      assist={assist}
      onDone={(score) => onDone(score, choice)}
      howKey="challenge.day24_super_storm.play"
      theme="wall"
      arcBonus={choice === 'greenhouse_off' ? Math.round(numParam(params, 'offArc', 1)) : 0}
    />
  );
}
