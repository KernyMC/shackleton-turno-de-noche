// Guía para quien juega por primera vez (7–12 años): presentación de 6 tarjetas (Onboarding) y un
// tripulante con cara que acompaña el día 1 paso a paso, más pistas breves los días 2 y 3. Y la leyenda "¿Cómo se juega?", disponible siempre.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { game } from '../state/store';
import { ackTutorial, contextHint, dismissHint, helpOpen, onboardingOpen, skipTutorial, TUTORIAL_MIN, tutorialStep } from '../state/tutorial';
import type { HintId, TutorialStep } from '../state/tutorial';
import { crewById } from '../data/crew';
import type { CrewId } from '../data/crew';
import { CrewPortrait } from './CrewPortrait';
import { Icon } from './icons';
import type { IconName } from './icons';
import { Onboarding } from './Onboarding';

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
      </section>
    </div>
  );
}

/** Quién habla y qué señala cada pista de los días 2 y 3. */
const HINTS: Record<HintId, { speaker: CrewId; target: string }> = {
  day2: { speaker: 'valeria', target: '.eflow' },
  day3: { speaker: 'lucia', target: '.forecast' },
};
const HINT_MS = 14000;

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

/** Pista breve y sin bloqueo: se cierra sola o con un toque. */
function Hint({ id }: { id: HintId }) {
  const { speaker: who, target } = HINTS[id];
  const speaker = crewById(who);
  useEffect(() => {
    const timer = window.setTimeout(dismissHint, HINT_MS);
    return () => window.clearTimeout(timer);
  }, [id]);
  return (
    <>
      <Spot selector={target} />
      <div class="coach onb-hint" role="status" aria-live="polite" style={{ '--crew': speaker.css }} key={id} onClick={dismissHint}>
        <span class="coach__portrait" aria-hidden="true">
          <CrewPortrait color={speaker.css} size={48} mood="happy" />
        </span>
        <div class="coach__body">
          <p class="coach__voice">
            <strong>{t(`crew.${speaker.id}.short`)}</strong>
          </p>
          <p class="coach__text">{t(`coach.hint_${id}`)}</p>
          <div class="coach__actions">
            <button type="button" class="btn btn--small btn--primary" onClick={dismissHint}>
              {t('coach.ok')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function Coach() {
  const step = tutorialStep.value;
  const hint = contextHint.value;
  if (onboardingOpen.value) return <Onboarding review vars={facts()} />;
  if (helpOpen.value) return <Help />;
  if (step === 'welcome') return <Onboarding vars={facts()} />;
  if (step) return <Bubble step={step} />;
  if (hint) return <Hint id={hint} />;
  return null;
}
