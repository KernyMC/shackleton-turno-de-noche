// Guía del juego (7–12 años): presentación (Onboarding), burbujas de un tripulante con cara en el modo
// Tutorial, tarjeta final del tutorial y la leyenda "¿Cómo se juega?", disponible siempre.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { sceneBridge } from '../scene/bridge';
import type { ModuleId } from '../sim/types';
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
  pick_recycler: '.meter[data-module="recycler"]',
  power_recycler: '.meter[data-module="recycler"]',
  greenhouse: '.meter[data-module="greenhouse"]',
  execute: '.tablet__actions',
  d2_flow: '.eflow',
  d2_pass: '.board',
  d3_harvest: '.event__options',
  d3_forecast: '.forecast',
  d3_pass: '.board',
  d4_dust: '.event__options',
  d4_workshop: '.meter[data-module="workshop"]',
  d4_pass: '.board',
  d5_goal: '.act-pill',
  d5_pass: '.board',
};
/** Módulo de la maqueta que se ilumina junto con lo del panel. */
const FOCUS_MODULE: Partial<Record<TutorialStep, ModuleId>> = {
  pick_recycler: 'recycler',
  power_recycler: 'recycler',
  greenhouse: 'greenhouse',
  d3_harvest: 'greenhouse',
  d4_workshop: 'workshop',
};
/**
 * Lo que además se ilumina en cada paso, fuera del panel: la tarjeta del recurso que cambia al
 * repartir energía, o la barra de arriba (radiación, día y energía) cuando la guía habla de ella.
 */
const ALSO: Partial<Record<TutorialStep, string[]>> = {
  power_recycler: ['.pres--life'],
  greenhouse: ['.pres--food'],
  execute: ['.pres'],
  d2_flow: ['.topbar__dose', '.topbar__day'],
  d2_pass: ['.pres', '.tablet__actions'],
  d3_pass: ['.pres', '.tablet__actions'],
  d4_pass: ['.pres', '.tablet__actions'],
  d5_pass: ['.pres', '.tablet__actions'],
  d3_forecast: ['.pres'],
  d4_workshop: ['.pres--battery'],
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
      <Focus selector={tabletOpen.value ? target : undefined} module={FOCUS_MODULE[step] ?? null} also={warn ? undefined : ALSO[step]} />
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

interface Hole { x: number; y: number; w: number; h: number; round: boolean }

/** Radio (px) del hueco redondo que ilumina un módulo en la maqueta. */
const MODULE_HOLE = 84;

/**
 * Foco de la pista: oscurece la pantalla y deja a la vista lo señalado, que puede ser a la vez
 * un elemento del panel y un módulo de la maqueta. Lo que no existe en pantalla no se dibuja.
 */
function Focus({ selector, module, also }: { selector?: string; module: ModuleId | null; also?: string[] }) {
  const alsoKey = (also ?? []).join('|');
  const [holes, setHoles] = useState<Hole[]>([]);
  useEffect(() => {
    const measure = (): void => {
      const next: Hole[] = [];
      const W = window.innerWidth;
      const H = window.innerHeight;
      const tablet = document.querySelector('.tablet:not(.tablet--away)')?.getBoundingClientRect();
      const el = selector ? document.querySelector(selector) : null;
      const r = el?.getBoundingClientRect();
      if (el && r && r.width > 0 && r.height > 0) {
        // Solo cuenta la parte que se ve: dentro del panel con scroll y dentro de la ventana.
        const clip = el.closest('.tablet')?.getBoundingClientRect();
        // El pie fijo del panel tapa lo que queda debajo: el foco termina donde empieza el pie.
        const foot = el.closest('.tablet__actions') ? null : el.closest('.tablet')?.querySelector('.tablet__actions')?.getBoundingClientRect();
        const left = Math.max(r.left, clip?.left ?? 0, 0);
        const top = Math.max(r.top, clip?.top ?? 0, 0);
        const right = Math.min(r.right, clip?.right ?? W, W);
        const bottom = Math.min(r.bottom, foot?.top ?? H, clip?.bottom ?? H, H);
        if (right - left > 16 && bottom - top > 16) next.push({ x: left - 4, y: top - 4, w: right - left + 8, h: bottom - top + 8, round: false });
      }
      // Huecos extra (tarjetas de recursos, barra de arriba): solo si se ven y hay un hueco principal.
      for (const sel of alsoKey ? alsoKey.split('|') : []) {
        const b = document.querySelector(sel)?.getBoundingClientRect();
        if (b && b.width > 8 && b.height > 8 && b.bottom > 0 && b.top < H) next.push({ x: b.left - 4, y: b.top - 4, w: b.width + 8, h: b.height + 8, round: false });
      }
      const p = module ? sceneBridge.project?.(module) : null;
      if (p) {
        const R = Math.min(MODULE_HOLE, Math.min(W, H) * 0.16);
        const inside = p.x > R * 0.5 && p.x < W - R * 0.5 && p.y > R * 0.5 && p.y < H - R * 0.5;
        // Si el panel tapa el módulo, no se abre un hueco encima del panel.
        const covered = tablet && p.x + R > tablet.left && p.x - R < tablet.right && p.y + R > tablet.top && p.y - R < tablet.bottom;
        if (inside && !covered) next.push({ x: p.x - R, y: p.y - R, w: R * 2, h: R * 2, round: true });
      }
      // La burbuja de la guía nunca tapa el módulo iluminado: se coloca debajo o encima de su hueco.
      const round = next.find((h) => h.round);
      const rootStyle = document.documentElement.style;
      if (round) {
        const coachH = document.querySelector('.coach')?.getBoundingClientRect().height ?? 130;
        const below = round.y + round.h + 14;
        let top = below + coachH < H - 12 ? below : Math.max(8, round.y - 14 - coachH);
        // Tampoco tapa las tarjetas iluminadas de abajo: si las pisaría, sube por encima del módulo.
        const lowHole = next.filter((h) => !h.round && h.y > H / 2 && h.x < W / 2).reduce((m, h) => Math.min(m, h.y), H);
        if (top + coachH > lowHole - 10) top = Math.max(8, Math.min(round.y - 14 - coachH, lowHole - 14 - coachH));
        rootStyle.setProperty('--coach-top', `${Math.round(top)}px`);
      } else rootStyle.removeProperty('--coach-top');
      setHoles((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    // Lo señalado se trae a la vista dentro del panel antes de medirlo.
    const first = selector ? document.querySelector(selector) : null;
    if (first?.closest('.tablet') && !first.matches('.tablet')) first.scrollIntoView({ block: 'nearest' });
    measure();
    const id = window.setInterval(measure, 120);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
      document.documentElement.style.removeProperty('--coach-top');
    };
  }, [selector, module, alsoKey]);
  if (holes.length === 0) return null;
  const n = (v: number): string => v.toFixed(1);
  // Pantalla completa con agujeros (regla par-impar): rectángulos para el panel, círculo para el módulo.
  const cut = holes
    .map((h) =>
      h.round
        ? `M${n(h.x)} ${n(h.y + h.h / 2)}a${n(h.w / 2)} ${n(h.h / 2)} 0 1 0 ${n(h.w)} 0a${n(h.w / 2)} ${n(h.h / 2)} 0 1 0 ${n(-h.w)} 0Z`
        : `M${n(h.x)} ${n(h.y)}h${n(h.w)}v${n(h.h)}h${n(-h.w)}Z`,
    )
    .join('');
  const clip = `path(evenodd, "M0 0H${window.innerWidth}V${window.innerHeight}H0Z${cut}")`;
  return (
    <>
      <div class="onb-dim" aria-hidden="true" style={{ clipPath: clip }} />
      {holes.map((h, i) => (
        <div
          key={i}
          class={`onb-spot${h.round ? ' onb-spot--round' : ''}`}
          aria-hidden="true"
          style={{ left: `${h.x}px`, top: `${h.y}px`, width: `${h.w}px`, height: `${h.h}px` }}
        />
      ))}
    </>
  );
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
