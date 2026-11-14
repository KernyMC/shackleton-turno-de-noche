// Retos diarios: minijuegos en un día fijo. Puro y determinista. El minijuego vive en la interfaz;
// aquí solo se decide qué reto toca, cuánta ayuda hay y qué efectos deja el resultado.

import { defaultConfig } from './config';
import { isUnlocked } from './acts';
import type {
  ChallengeDef,
  ChallengeEffect,
  ChallengeId,
  ChallengeOutcome,
  GameConfig,
  GameState,
  LogEntry,
  ModuleId,
  Plan,
} from './types';

const MAX_LOG = 100;
const r2 = (n: number): number => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** Reto de hoy que aún no se ha resuelto, o null (sin reto, ya resuelto o partida terminada). */
export function challengeDue(state: GameState, cfg: GameConfig = defaultConfig): ChallengeDef | null {
  if (state.phase === 'ended') return null;
  const def = cfg.challenges.list.find((c) => c.day === state.day);
  if (!def || state.challenges[def.id] !== undefined) return null;
  return def;
}

/** Ayuda 0..1 que da la energía del plan al Taller y/o al Blindaje (0 si están rotos o bloqueados). */
export function challengeAssist(
  state: GameState,
  plan: Plan,
  def: ChallengeDef,
  cfg: GameConfig = defaultConfig,
): number {
  if (def.assistFrom === null) return 0;
  const one = (id: ModuleId): number => {
    if (state.modules[id].broken || !isUnlocked(state, id)) return 0;
    return clamp(plan[id] / cfg.balance.modules[id].maxEnergy, 0, 1);
  };
  if (def.assistFrom === 'workshop') return one('workshop');
  if (def.assistFrom === 'shield') return one('shield');
  return (one('workshop') + one('shield')) / 2;
}

/** Convierte una puntuación 0..1 en resultado con los umbrales de challenges.json. */
export function scoreToOutcome(score: number, cfg: GameConfig = defaultConfig): 'perfect' | 'partial' | 'failed' {
  const t = cfg.challenges.thresholds;
  if (score >= t.perfect) return 'perfect';
  if (score >= t.partial) return 'partial';
  return 'failed';
}

function applyEffect(state: GameState, effect: ChallengeEffect, cfg: GameConfig): GameState {
  const capacity = cfg.balance.difficulty[state.difficulty].batteryCapacity;
  switch (effect.type) {
    case 'resource': {
      if (effect.key === 'battery') {
        return { ...state, battery: r2(clamp(state.battery + effect.amount, 0, capacity)) };
      }
      if (effect.key === 'dose') return { ...state, dose: r2(Math.max(0, state.dose + effect.amount)) };
      return { ...state, [effect.key]: r2(clamp(state[effect.key] + effect.amount, 0, 100)) };
    }
    case 'break': {
      if (effect.module === 'workshop' || state.modules[effect.module].broken) return state;
      return {
        ...state,
        modules: { ...state.modules, [effect.module]: { broken: true, brokenSinceDay: state.day } },
      };
    }
    case 'daily':
      return {
        ...state,
        mods: {
          ...state.mods,
          daily: [
            ...state.mods.daily,
            { key: effect.key, amount: effect.amount, untilDay: state.day + effect.days - 1 },
          ],
        },
      };
    case 'doseFactor':
      return { ...state, mods: { ...state.mods, doseFactor: state.mods.doseFactor * effect.factor } };
    case 'noWarnings':
      return {
        ...state,
        mods: { ...state.mods, warningsOffUntil: Math.max(state.mods.warningsOffUntil, effect.untilDay) },
      };
  }
}

/** Aplica el resultado de un reto: efectos, marca de resuelto y bitácora. Devuelve un estado nuevo. */
export function applyChallenge(
  state: GameState,
  id: ChallengeId,
  outcome: ChallengeOutcome,
  cfg: GameConfig = defaultConfig,
  optionId?: string,
): GameState {
  if (state.phase !== 'planning') throw new Error(`No se puede resolver un reto en fase "${state.phase}"`);
  const due = challengeDue(state, cfg);
  if (!due || due.id !== id) throw new Error(`El reto ${id} no toca hoy`);
  if (outcome === 'skipped' && !due.skippable) throw new Error(`El reto ${id} no se puede saltar`);

  if (optionId !== undefined && outcome !== 'skipped' && !due.options?.[optionId]) {
    throw new Error(`El reto ${id} no tiene la opción ${optionId}`);
  }
  let next: GameState = state;
  for (const effect of due.outcomes[outcome]) next = applyEffect(next, effect, cfg);
  if (optionId !== undefined && outcome !== 'skipped') {
    for (const effect of due.options![optionId]!) next = applyEffect(next, effect, cfg);
  }
  const type: LogEntry['type'] = outcome === 'perfect' ? 'achievement' : outcome === 'failed' ? 'warning' : 'event';
  const entry: LogEntry = { day: state.day, type, key: `log.challenge.${outcome}`, vars: { challenge: id } };
  return {
    ...next,
    challenges: { ...state.challenges, [id]: outcome },
    log: [...next.log, entry].slice(-MAX_LOG),
  };
}
