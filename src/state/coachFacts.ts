// Datos que aparecen en las frases de la guía y quién dice cada burbuja del tutorial.
// Puro (sin señales ni DOM): lo usan Coach.tsx y scripts/generate-voices.ts, para que la voz
// grabada diga exactamente el mismo texto que se ve en pantalla.
import type { CrewId } from '../data/crew';
import { defaultConfig } from '../sim/config';
import type { Difficulty, GameConfig } from '../sim/types';
import type { TutorialStep } from './tutorial';

/** Energía mínima que pide el tutorial a cada módulo (lo comprueba src/state/tutorial.ts). */
export const TUTORIAL_MIN = { recycler: 20, greenhouse: 15 } as const;

/** Números de las frases de la guía: salen de la configuración, no se escriben a mano. */
export function coachFacts(difficulty: Difficulty = 'cadete', day = 1, cfg: GameConfig = defaultConfig) {
  const d = cfg.balance.difficulty[difficulty];
  const nights = cfg.light.nightDays;
  const firstNight = Math.min(...nights);
  return {
    personas: d.crew,
    dias: cfg.balance.days,
    noche: firstNight,
    duracion: nights.length,
    faltan: Math.max(0, firstNight - day),
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
export const COACH_SPEAKER: Record<TutorialStep, CrewId> = {
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

/** Aviso de recurso bajo: lo dice quien cuida ese recurso. */
export const WARN_SPEAKER = { 'coach.low_air': 'valeria', 'coach.low_food': 'mateo' } as const satisfies Record<string, CrewId>;
