// Guía para quien juega por primera vez (7–12 años): bienvenida corta y un tripulante con cara
// que acompaña el día 1 paso a paso. Y la leyenda "¿Cómo se juega?", disponible siempre.
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { commanderName, game } from '../state/store';
import { ackTutorial, helpOpen, skipTutorial, TUTORIAL_MIN, tutorialStep } from '../state/tutorial';
import type { TutorialStep } from '../state/tutorial';
import { crewById } from '../data/crew';
import type { CrewId } from '../data/crew';
import { CrewPortrait } from './CrewPortrait';
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
    aviso: cfg.balance.events.warningDays,
  };
}

/**
 * Bienvenida: una sola pantalla, tres ideas cortas con ícono y la cara de Valeria, que guía.
 * No habla de perder: eso se aprende jugando, con avisos a tiempo.
 */
function Welcome() {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);
  const f = facts();
  const guide = crewById('valeria');
  const lines: [IconName, string][] = [
    ['life_support', 'coach.welcome.crew'],
    ['sun', 'coach.welcome.energy'],
    ['check', 'coach.welcome.goal'],
  ];
  return (
    <div class="overlay">
      <section class="card card--welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" style={{ '--crew': guide.css }}>
        <div class="welcome__guide">
          <span class="welcome__portrait" aria-hidden="true">
            <CrewPortrait color={guide.css} size={72} mood="happy" />
          </span>
          <div>
            <p class="card__kicker">{t('coach.guide_says', { nombre: t('crew.valeria.short') })}</p>
            <h2 id="welcome-title">{t('coach.welcome.title_named', { nombre: commanderName.value.trim() || t('crew.commander_default') })}</h2>
          </div>
        </div>
        <ul class="card__list welcome__list">
          {lines.map(([icon, key]) => (
            <li key={key}>
              <Icon name={icon} size={24} />
              <span>{t(key, f)}</span>
            </li>
          ))}
        </ul>
        <div class="card__actions">
          <button ref={button} type="button" class="btn btn--primary" onClick={ackTutorial}>
            {t('coach.welcome.start')}
          </button>
        </div>
        <button type="button" class="linkbtn welcome__skip" onClick={skipTutorial}>
          {t('coach.skip')}
        </button>
      </section>
    </div>
  );
}

/** Los pasos de acción, en orden, para los puntos de progreso. */
const STEPS: TutorialStep[] = ['pick_recycler', 'power_recycler', 'greenhouse', 'execute', 'night'];
/** Quién habla en cada paso: el tripulante que cuida lo que se enseña. */
const SPEAKER: Record<TutorialStep, CrewId> = {
  welcome: 'valeria',
  pick_recycler: 'valeria',
  power_recycler: 'valeria',
  greenhouse: 'mateo',
  execute: 'lucia',
  night: 'lucia',
};

/** Burbuja del tripulante que guía el paso actual. Esc salta la guía. */
function Bubble({ step }: { step: TutorialStep }) {
  const manual = step === 'night';
  const index = STEPS.indexOf(step);
  const speaker = crewById(SPEAKER[step]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !helpOpen.value) skipTutorial();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div class="coach" role="status" aria-live="polite" style={{ '--crew': speaker.css }} key={step}>
      <span class="coach__portrait" aria-hidden="true">
        <CrewPortrait color={speaker.css} size={48} mood="happy" />
      </span>
      <div class="coach__body">
        <p class="coach__voice">
          <strong>{t(`crew.${speaker.id}.short`)}</strong>
          {index >= 0 && (
            <span class="coach__dots" role="img" aria-label={t('coach.step', { n: index + 1, total: STEPS.length })}>
              {STEPS.map((s, i) => (
                <span key={s} class={`coach__dot${i < index ? ' coach__dot--done' : i === index ? ' coach__dot--now' : ''}`} />
              ))}
            </span>
          )}
        </p>
        <p class="coach__text">{t(`coach.${step}`, facts())}</p>
        <div class="coach__actions">
          {manual && (
            <button type="button" class="btn btn--small btn--primary" onClick={ackTutorial}>
              {t('coach.ok')}
            </button>
          )}
          <button type="button" class="linkbtn" onClick={skipTutorial}>
            {t('coach.skip')}
          </button>
        </div>
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
        ['info', 'help.antenna_name', 'help.antenna'],
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
