// Motor puro y determinista. Sin DOM, sin Three, sin Preact, sin Math.random.
// Implementado: createGame, getLight, getEnergyBudget, validatePlan.
// Pendiente (ver docs/tasks/A-motor.md): previewDay, runDay, resolveEvent.

import { defaultConfig } from './config';
import { MODULE_IDS } from './types';
import type { Difficulty, EnergyBudget, GameConfig, GameState, Plan } from './types';

export const EMPTY_PLAN: Plan = { recycler: 0, greenhouse: 0, shield: 0, workshop: 0 };

export function createGame(
  seed: number,
  difficulty: Difficulty,
  cfg: GameConfig = defaultConfig,
): GameState {
  const d = cfg.balance.difficulty[difficulty];
  return {
    version: 1,
    seed,
    difficulty,
    day: 1,
    phase: 'planning',
    battery: d.batteryStart,
    lifeSupport: d.lifeSupportStart,
    food: d.foodStart,
    dose: 0,
    modules: {
      recycler: { broken: false },
      greenhouse: { broken: false },
      shield: { broken: false },
      workshop: { broken: false },
    },
    roverAvailable: true,
    shelterToday: false,
    pendingEvent: null,
    scheduledEvents: [], // A-02 los programa con la semilla
    history: [],
    log: [],
    lastPlan: null,
    result: null,
  };
}

/** Luz (0..1) de un día, con el bono de noche de la dificultad. */
export function getLight(day: number, difficulty: Difficulty, cfg: GameConfig = defaultConfig): number {
  const raw = cfg.light.light[day - 1];
  if (raw === undefined) throw new Error(`Día fuera de rango: ${day}`);
  const bonus = cfg.balance.difficulty[difficulty].nightLightBonus;
  if (bonus > 0 && cfg.light.nightDays.includes(day)) return Math.min(0.1, raw + bonus);
  return raw;
}

export function getEnergyBudget(state: GameState, cfg: GameConfig = defaultConfig): EnergyBudget {
  const d = cfg.balance.difficulty[state.difficulty];
  const solar = d.solarMax * getLight(state.day, state.difficulty, cfg);
  const raw = state.battery + solar - d.baseConsumption;
  return { solar, base: d.baseConsumption, available: Math.max(0, raw), blackout: raw < 0 };
}

export interface PlanValidation {
  ok: boolean;
  /** Claves i18n de cada problema encontrado. */
  errors: string[];
}

export function validatePlan(
  state: GameState,
  plan: Plan,
  cfg: GameConfig = defaultConfig,
): PlanValidation {
  const errors: string[] = [];
  let total = 0;
  for (const id of MODULE_IDS) {
    const value = plan[id];
    if (!Number.isFinite(value) || value < 0) errors.push(`plan.error.negative.${id}`);
    if (value > cfg.balance.modules[id].maxEnergy) errors.push(`plan.error.over_max.${id}`);
    if (state.modules[id].broken && value > 0) errors.push(`plan.error.broken.${id}`);
    total += value;
  }
  // Tolerancia mínima por decimales de la producción solar.
  if (total > getEnergyBudget(state, cfg).available + 1e-9) errors.push('plan.error.over_budget');
  return { ok: errors.length === 0, errors };
}
