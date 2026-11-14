// Guía del juego (7–12 años): presentación (Onboarding), burbujas de un tripulante con cara en el modo
// Tutorial, tarjeta final del tutorial y la leyenda "¿Cómo se juega?", disponible siempre.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { exitToMenu, game, resolving, screen, tabletOpen } from '../state/store';
import { actCard, toast } from '../state/acts';
import { dayDone, milestone, reacting } from '../state/rewards';
import { ackTutorial, helpOpen, onboardingOpen, skipTutorial, TUTORIAL_MIN, tutorialEnd, tutorialStep, tutorialWarn } from '../state/tutorial';
import { gameMode, menuMode, TUTORIAL_DAYS } from '../state/mode';
import type { TutorialStep } from '../state/tutorial';
import { crewById, crewName } from '../data/crew';
import type { CrewId } from '../data/crew';
import { CrewPortrait } from './CrewPortrait';
import { Icon } from './icons';
import type { IconName } from './icons';
import { Onboarding } from './Onboarding';
import { TutorialDone } from './TutorialDone';

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
    meta: cfg.balance.acts.list[0]?.goal.target ?? 0,
  };
}

/** Quién habla en cada paso: el tripulante que cuida lo que se enseña. */
const SPEAKER: Record<TutorialStep, CrewId> = {
  welcome: 'valeria',
  pick_recycler: 'valeria',
  power_recycler: 'valeria',
  greenhouse: 'mateo',
  execute: 'lucia',
  d2_flow: 'lucia',
  d2_pass: 'valeria',
  d3_harvest: 'mateo',
  d3_forecast: 'lucia',
  d3_pass: 'lucia',
  d4_dust: 'amaru',
  d4_workshop: 'lucia',
  d4_pass: 'lucia',
  d5_goal: 'amaru',
  d5_pass: 'lucia',
};
/** Lo que señala el aro de cada paso (si existe en pantalla; si no, no se dibuja). */
const TARGET: Partial<Record<TutorialStep, string>> = {
  d2_flow: '.eflow',
  d3_forecast: '.forecast',
  d4_workshop: '.meter[data-module="workshop"]',
  d5_goal: '.act-pill',
};
const WARN_TARGET: Record<string, string> = {
  recycler: '.meter[data-module="recycler"]',
  greenhouse: '.meter[data-module="greenhouse"]',
};
/** Pasos que esperan el botón «¡Entendido!». */
const MANUAL_STEPS: ReadonlySet<TutorialStep> = new Set(['d2_flow', 'd3_forecast', 'd4_workshop', 'd5_goal']);

/** Día del tutorial al que pertenece cada paso (para la etiqueta «Día N de 5»). */
function dayOf(step: TutorialStep): number {
  const m = /^d(\d)_/.exec(step);
  return m ? Number(m[1]) : 1;
}

/** Burbuja del tripulante que guía el paso actual. Esc salta la guía. */
function Bubble({ step }: { step: TutorialStep }) {
  const manual = MANUAL_STEPS.has(step);
  const speaker = crewById(SPEAKER[step]);
  const warn = tutorialWarn.value;
  const target = warn ? WARN_TARGET[warn] : TARGET[step];
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !helpOpen.value) skipTutorial();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      {target && tabletOpen.value && <Spot selector={target} />}
      <div class="coach" role="status" aria-live="polite" style={{ '--crew': speaker.css }} key={step}>
        <span class="coach__portrait" aria-hidden="true">
          <CrewPortrait crew={speaker.id} color={speaker.css} size={48} mood="happy" />
        </span>
        <div class="coach__body">
          <p class="coach__voice">
            <strong>{crewName(speaker.id)}</strong>
            <span class="tut-day">{t('coach.day', { n: dayOf(step), total: TUTORIAL_DAYS })}</span>
          </p>
          <p class="coach__text">{t(`coach.${step}`, facts())}</p>
          {warn && <p class="coach__text tut-warn">{t(warn === 'recycler' ? 'coach.low_air' : 'coach.low_food')}</p>}
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
    </>
  );
}

/** «Jugar el tutorial» desde la ayuda: deja el tutorial elegido en el menú (si hay una partida, vuelve al menú). */
function playTutorialFromHelp(): void {
  helpOpen.value = false;
  menuMode.value = 'tutorial';
  if (screen.value === 'game') exitToMenu();
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
        <button
          type="button"
          class="btn"
          onClick={() => {
            helpOpen.value = false;
            onboardingOpen.value = true;
          }}
        >
          {t('help.replay')}
        </button>
        <button type="button" class="btn btn--primary tut-help-play" onClick={playTutorialFromHelp}>
          {t('help.play_tutorial')}
        </button>
      </section>
    </div>
  );
}

/** Aro que rodea lo que señala la pista; si no existe en pantalla, no se dibuja nada. */
function Spot({ selector }: { selector: string }) {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    const measure = (): void => {
      const el = document.querySelector(selector);
      const r = el?.getBoundingClientRect();
      setBox(r && r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);
    };
    measure();
    const id = window.setInterval(measure, 300);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
    };
  }, [selector]);
  if (!box) return null;
  return <div class="onb-spot" aria-hidden="true" style={{ left: `${box.x - 4}px`, top: `${box.y - 4}px`, width: `${box.w + 8}px`, height: `${box.h + 8}px` }} />;
}

export function Coach() {
  const step = tutorialStep.value;
  if (onboardingOpen.value) return <Onboarding review vars={facts()} />;
  if (helpOpen.value) return <Help />;
  if (tutorialEnd.value) return <TutorialDone />;
  if (step === 'welcome') return <Onboarding vars={facts()} tutorial={gameMode.value === 'tutorial'} />;
  // La burbuja cede el sitio a los avisos de fin de día, a la tarjeta de acto y a los avisos cortos.
  const busy = dayDone.value !== null || milestone.value !== null || reacting.value || resolving.value || toast.value !== null || actCard.value !== null;
  if (step) return busy ? null : <Bubble step={step} />;
  return null;
}
