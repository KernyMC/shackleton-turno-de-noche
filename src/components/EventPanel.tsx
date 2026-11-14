// Panel de evento: qué pasa, y dos botones grandes que dicen su consecuencia ANTES de elegir.
// La tensión sale de la consecuencia, no de un reloj (docs/DIVERSION.md). Solo muestra y llama al store.
import { useEffect } from 'preact/hooks';
import { lang, t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { getStormDose } from '../sim/engine';
import type { EventOption, GameState, ModuleId, PendingEvent, StormLevel } from '../sim/types';
import { sourcesOpen } from '../state/sources';
import { chooseEventOption } from '../state/store';
import { EventInfographic, hasInfographic } from './EventInfographic';
import { num } from './format';
import { Icon } from './icons';
import type { IconName } from './icons';

interface OptionView {
  icon: IconName;
  /** Líneas de consecuencia, ya traducidas. */
  effects: string[];
  recommended?: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang.value === 'es' ? 'es-EC' : 'en-US', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/** Qué muestra cada opción. Los números salen del motor y de balance.json. */
function optionView(event: PendingEvent, option: EventOption, game: GameState): OptionView {
  const fx = defaultConfig.balance.effects;
  const moduleName = event.payload?.module ? t(`module.${event.payload.module as ModuleId}`) : '';
  switch (`${event.kind}.${option.id}`) {
    case 'storm.shelter': {
      const level = event.payload?.level as StormLevel;
      return {
        icon: 'shield',
        recommended: true,
        effects: [
          t('event.effect.dose', { valor: num(getStormDose(level, true), 1) }),
          t('event.effect.shelter_stop'),
        ],
      };
    }
    case 'storm.work': {
      const level = event.payload?.level as StormLevel;
      return {
        icon: 'workshop',
        effects: [t('event.effect.dose', { valor: num(getStormDose(level, false), 1) }), t('event.effect.work_normal')],
      };
    }
    case 'breakdown.repair':
      return {
        icon: 'workshop',
        recommended: true,
        effects: [t('event.effect.workshop_cost', { min: fx.workshopMinEnergy }), t('event.effect.repair_tomorrow', { modulo: moduleName })],
      };
    case 'breakdown.later':
      return { icon: 'moon', effects: [t('event.effect.stays_broken', { modulo: moduleName })] };
    case 'ice.send':
      return {
        icon: 'life_support',
        recommended: true,
        effects: [
          t('event.effect.workshop_cost', { min: fx.workshopMinEnergy }),
          t(game.difficulty === 'comandante' ? 'event.effect.rover_gain_maybe' : 'event.effect.rover_gain', { valor: fx.roverLifeSupport }),
        ],
      };
    case 'ice.skip':
      return { icon: 'close', effects: [t('event.effect.nothing')] };
    default:
      return { icon: 'check', effects: [] };
  }
}

const EVENT_ICON: Record<string, IconName> = { storm: 'sun', breakdown: 'alert', ice: 'life_support', night_warning: 'moon' };

export function EventPanel({ game }: { game: GameState }) {
  const event = game.pendingEvent;

  // Teclas 1 y 2 eligen la opción (si está disponible).
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent): void => {
      const option = event.options[Number(e.key) - 1];
      if (option && !option.disabledReason) chooseEventOption(option.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [event]);

  if (!event) return null;
  const payload = event.payload ?? {};
  const level = typeof payload.level === 'string' ? Number(payload.level.slice(1)) : 0;
  const vars = {
    nivel: level,
    modulo: payload.module ? t(`module.${payload.module as ModuleId}`) : '',
    tipo: (typeof payload.type === 'string' ? t(`sun.type.${payload.type}`) : t('event.storm.generic')).toLowerCase(),
    detalle: typeof payload.classType === 'string' ? ` (${payload.classType})` : '',
  };
  const origin = String(payload.origin ?? 'sample');
  const single = event.options.length === 1;

  return (
    <div class={`event event--${event.kind}`}>
      <p class="event__title">
        <Icon name={EVENT_ICON[event.kind] ?? 'alert'} size={26} />
        {t(`event.${event.kind}.title`, vars)}
      </p>
      {event.kind === 'storm' && (
        <p class="event__level" aria-label={t('event.storm.level', vars)}>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} class={`event__pip${n <= level ? ' event__pip--on' : ''}`} />
          ))}
          <span>{t('event.storm.level', vars)}</span>
        </p>
      )}
      {hasInfographic(event.kind) && (
        <>
          <EventInfographic event={event} />
          <button type="button" class="linkbtn info__more" onClick={() => { sourcesOpen.value = true; }}>
            {t('info.more')}
          </button>
        </>
      )}
      <p class="event__text">{t(`event.${event.kind}.text`, vars)}</p>
      {event.kind === 'storm' && (
        <p class="event__source">
          {t(`storm.origin.${origin}`, { fecha: typeof payload.date === 'string' ? formatDate(payload.date) : '' })}
          {typeof payload.link === 'string' && (
            <>
              {' '}
              <a href={payload.link} target="_blank" rel="noopener noreferrer">{t('event.storm.see_nasa')}</a>
            </>
          )}
        </p>
      )}

      <div class={`event__options${single ? ' event__options--single' : ''}`}>
        {event.options.map((option, i) => {
          const view = optionView(event, option, game);
          return (
            <button
              key={option.id}
              type="button"
              class={`option${view.recommended && !option.disabledReason ? ' option--recommended' : ''}`}
              disabled={!!option.disabledReason}
              onClick={() => chooseEventOption(option.id)}
            >
              <span class="option__head">
                <Icon name={view.icon} size={22} />
                <strong>{t(`event.${event.kind}.option.${option.id}`)}</strong>
                {!single && <kbd class="option__key">{i + 1}</kbd>}
              </span>
              {view.recommended && !option.disabledReason && <span class="option__tag">{t('event.recommended')}</span>}
              {view.effects.map((line) => (
                <span key={line} class="option__effect">{line}</span>
              ))}
              {option.disabledReason && (
                <span class="option__reason">
                  <Icon name="alert" size={14} />
                  {t(option.disabledReason)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
