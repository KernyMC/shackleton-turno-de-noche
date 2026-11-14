// Jugadores automáticos para probar el balance (tests y `npm run simulate`). Puro.

import { defaultConfig } from './config';
import { maxEnergyFor } from './acts';
import { createGame, EMPTY_PLAN, getEnergyBudget, getLight, resolveEvent, runDay } from './engine';
import { createRng } from './rng';
import { MODULE_IDS } from './types';
import type { Difficulty, GameConfig, GameState, ModuleId, Plan } from './types';

export interface Strategy {
  name: string;
  plan(state: GameState, cfg: GameConfig): Plan;
  /** Devuelve el id de una opción habilitada del evento pendiente. */
  choose(state: GameState, cfg: GameConfig): string;
}

/** Reparte `energy` entre módulos en el orden dado, respetando máximos, bloqueos y averías. */
export function allocate(
  state: GameState,
  energy: number,
  order: readonly ModuleId[],
  cfg: GameConfig,
  base: Plan = EMPTY_PLAN,
): Plan {
  const plan = { ...base };
  let left = Math.floor(energy) - MODULE_IDS.reduce((sum, id) => sum + plan[id], 0);
  for (const id of order) {
    if (left <= 0) break;
    if (state.modules[id].broken) continue;
    const add = Math.min(maxEnergyFor(state, id, cfg) - plan[id], left);
    plan[id] += add;
    left -= add;
  }
  return plan;
}

const firstEnabled = (state: GameState, preferred: string[]): string => {
  const options = state.pendingEvent?.options ?? [];
  for (const id of preferred) {
    if (options.some((o) => o.id === id && !o.disabledReason)) return id;
  }
  const fallback = options.find((o) => !o.disabledReason);
  if (!fallback) throw new Error('Evento sin opciones disponibles');
  return fallback.id;
};

/** Todo al reciclador, nada guardado, ignora los eventos. Debe perder en la noche lunar. */
export const allRecycler: Strategy = {
  name: 'todo-al-reciclador',
  plan: (state, cfg) => allocate(state, getEnergyBudget(state, cfg).available, ['recycler'], cfg),
  choose: (state) => firstEnabled(state, ['work', 'later', 'skip', 'tilt', 'ok']),
};

/** Reparte al azar y elige al azar. */
export const randomPlayer: Strategy = {
  name: 'aleatoria',
  plan(state, cfg) {
    const rng = createRng((state.seed ^ Math.imul(state.day, 0x85ebca6b)) >>> 0);
    const available = getEnergyBudget(state, cfg).available;
    const order = [...MODULE_IDS].sort(() => rng.next() - 0.5);
    return allocate(state, available * rng.next(), order, cfg);
  },
  choose(state) {
    const rng = createRng((state.seed ^ Math.imul(state.day, 0xc2b2ae35)) >>> 0);
    const enabled = (state.pendingEvent?.options ?? []).filter((o) => !o.disabledReason);
    return rng.pick(enabled).id;
  },
};

/**
 * Jugadora prudente: se refugia, repara, envía el rover, guarda batería antes de la noche
 * y la raciona durante la noche. Es la referencia de "se puede ganar jugando bien".
 */
export const prudent: Strategy = {
  name: 'prudente',
  plan(state, cfg) {
    const d = cfg.balance.difficulty[state.difficulty];
    const available = getEnergyBudget(state, cfg).available;
    const nights = cfg.light.nightDays;
    const lastNight = Math.max(...nights);
    const netSolar = (day: number): number =>
      Math.max(0, d.solarMax * getLight(day, state.difficulty, cfg) - d.baseConsumption);

    let spend: number;
    if (nights.includes(state.day)) {
      // Racionar: lo que queda, menos el consumo base de las noches que faltan, a partes iguales.
      const remaining = nights.filter((n) => n >= state.day).length;
      spend = Math.max(0, (available - d.baseConsumption * (remaining - 1)) / remaining);
    } else if (state.day < Math.min(...nights)) {
      // Antes de la noche: gastar solo lo que el sol de los días siguientes puede reponer.
      let recoverable = 0;
      for (let day = state.day + 1; day < Math.min(...nights); day++) recoverable += netSolar(day);
      spend = Math.max(0, available - Math.max(0, d.batteryCapacity - recoverable));
    } else {
      spend = state.day > lastNight ? available : 0;
    }

    const needsWorkshop =
      state.unlocked.includes('workshop') && (state.repairToday !== null || state.roverSendToday || state.cleanToday);
    const base: Plan = needsWorkshop
      ? { ...EMPTY_PLAN, workshop: Math.min(cfg.balance.effects.workshopMinEnergy, Math.floor(available)) }
      : EMPTY_PLAN;
    const order: ModuleId[] =
      state.food < state.lifeSupport
        ? ['greenhouse', 'recycler', 'shield']
        : ['recycler', 'greenhouse', 'shield'];
    return allocate(state, Math.max(spend, base.workshop), order, cfg, base);
  },
  choose: (state) => firstEnabled(state, ['shelter', 'repair', 'send', 'clean', 'ok']),
};

/** Juega una partida completa con una estrategia y devuelve el estado final. */
export function playGame(
  seed: number,
  difficulty: Difficulty,
  strategy: Strategy,
  cfg: GameConfig = defaultConfig,
): GameState {
  let state = createGame(seed, difficulty, cfg);
  for (let guard = 0; guard < 500 && state.phase !== 'ended'; guard++) {
    state =
      state.phase === 'event'
        ? resolveEvent(state, strategy.choose(state, cfg), cfg)
        : runDay(state, strategy.plan(state, cfg), cfg);
  }
  if (state.phase !== 'ended') throw new Error('La partida no terminó');
  return state;
}
