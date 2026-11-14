// Guía para quien juega por primera vez: tarjeta de bienvenida y la voz de Control de Misión
// que acompaña el día 1 paso a paso. Y la leyenda "¿Cómo se juega?", disponible siempre.
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { commanderName, game } from '../state/store';
import { ackTutorial, helpOpen, skipTutorial, TUTORIAL_MIN, tutorialStep } from '../state/tutorial';
import type { TutorialStep } from '../state/tutorial';
import { Icon } from './icons';
import type { IconName } from './icons';

/** Datos del juego que aparecen en los textos: salen de la configuración, no se escriben a mano. */
function facts() {
  const g = game.value;
  const cfg = defaultConfig;
  const d = cfg.balance.difficulty[g?.difficulty ?? 'cadete'];
  const nights = cfg.light.nightDays;
  const firstNight = Math.min(...nights);
  return {
    personas: d.crew,
    dias: cfg.balance.days,
    noche: firstNight,
    duracion: nights.length,
    faltan: Math.max(0, firstNight - (g?.day ?? 1)),
    comida: cfg.balance.crewConsumption.foodPerPerson * d.crew,
    aire: cfg.balance.crewConsumption.lifeSupportPerPerson * d.crew,
    reciclador: TUTORIAL_MIN.recycler,
    invernadero: TUTORIAL_MIN.greenhouse,
    taller: cfg.balance.effects.workshopMinEnergy,
  };
}

function Welcome() {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);
  const f = facts();
  const lines: [IconName, string][] = [
    ['life_support', 'coach.welcome.crew'],
    ['sun', 'coach.welcome.energy'],
    ['moon', 'coach.welcome.night'],
    ['alert', 'coach.welcome.lose'],
  ];
  return (
    <div class="overlay">
      <section class="card" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <p class="card__kicker">{t('coach.voice')}</p>
        <h2 id="welcome-title">{t('coach.welcome.title_named', { nombre: commanderName.value.trim() || t('crew.commander_default') })}</h2>
        <ul class="card__list">
          {lines.map(([icon, key]) => (
            <li key={key}>
              <Icon name={icon} size={22} />
              <span>{t(key, f)}</span>
            </li>
          ))}
        </ul>
        <div class="card__actions">
          <button ref={button} type="button" class="btn btn--primary" onClick={ackTutorial}>
            {t('coach.welcome.start')}
          </button>
          <button type="button" class="btn btn--ghost btn--small" onClick={skipTutorial}>
            {t('coach.skip')}
          </button>
        </div>
      </section>
    </div>
  );
}

const STEP_NUMBER: Partial<Record<TutorialStep, number>> = {
  pick_recycler: 1,
  power_recycler: 2,
  pick_greenhouse: 3,
  power_greenhouse: 4,
  verdict: 5,
  execute: 6,
};
const STEP_TOTAL = 6;

/** Burbuja de Control de Misión con el paso actual. */
function Bubble({ step }: { step: TutorialStep }) {
  const manual = step === 'verdict' || step === 'night';
  const n = STEP_NUMBER[step];
  return (
    <div class="coach" role="status" aria-live="polite">
      <p class="coach__voice">
        {t('coach.voice')}
        {n && <span class="coach__count">{t('coach.step', { n, total: STEP_TOTAL })}</span>}
      </p>
      <p class="coach__text">{t(`coach.${step}`, facts())}</p>
      <div class="coach__actions">
        {manual && (
          <button type="button" class="btn btn--small btn--primary" onClick={ackTutorial}>
            {t('coach.ok')}
          </button>
        )}
        <button type="button" class="btn btn--small btn--ghost" onClick={skipTutorial}>
          {t('coach.skip')}
        </button>
      </div>
    </div>
  );
}

/** Leyenda de la pantalla: qué es cada cosa, en una línea. */
function Help() {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  const f = facts();
  const groups: { title: string; items: [IconName, string, string][] }[] = [
    {
      title: 'help.screen',
      items: [
        ['life_support', 'hud.life_support', 'help.life_support'],
        ['food', 'hud.food', 'help.food'],
        ['battery', 'hud.battery', 'help.battery'],
        ['dose', 'hud.dose', 'help.dose'],
        ['moon', 'help.night_name', 'help.night'],
      ],
    },
    {
      title: 'help.modules',
      items: [
        ['recycler', 'module.recycler', 'module.recycler.what'],
        ['greenhouse', 'module.greenhouse', 'module.greenhouse.what'],
        ['shield', 'module.shield', 'module.shield.what'],
        ['workshop', 'module.workshop', 'help.workshop'],
      ],
    },
  ];
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      helpOpen.value = false;
    }
  };
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && (helpOpen.value = false)} onKeyDown={onKey}>
      <section class="card card--help" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <header class="card__head">
          <h2 id="help-title">{t('help.title')}</h2>
          <button ref={close} type="button" class="btn btn--icon btn--ghost" aria-label={t('help.close')} onClick={() => (helpOpen.value = false)}>
            <Icon name="close" />
          </button>
        </header>
        <p class="card__goal">{t('help.goal', f)}</p>
        <ol class="card__steps">
          <li>{t('help.step1')}</li>
          <li>{t('help.step2')}</li>
          <li>{t('help.step3')}</li>
        </ol>
        {groups.map((group) => (
          <div key={group.title}>
            <h3>{t(group.title)}</h3>
            <dl class="card__legend">
              {group.items.map(([icon, name, text]) => (
                <div key={name}>
                  <dt>
                    <Icon name={icon} size={18} />
                    {t(name)}
                  </dt>
                  <dd>{t(text, f)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <p class="card__goal">{t('help.storm')}</p>
      </section>
    </div>
  );
}

export function Coach() {
  const step = tutorialStep.value;
  if (helpOpen.value) return <Help />;
  if (step === 'welcome') return <Welcome />;
  if (step) return <Bubble step={step} />;
  return null;
}
