// Comunicaciones: la antena de la Tierra. Pura y determinista; solo lee el estado.
// Si ayer el Taller recibió energía suficiente, la Tierra avisa de la próxima tormenta.
// Sin antena no se revela nada: la tormenta llega por sorpresa.

import { defaultConfig } from './config';
import type { GameConfig, GameState, StormLevel } from './types';

export interface StormWarning {
  /** Día en que golpea la tormenta. */
  day: number;
  /** Fuerza S1..S4 si el aviso la trae. */
  level?: StormLevel;
  /** Días que faltan desde hoy. */
  inDays: number;
}

/** ¿Está encendida la antena? Depende del Taller de ayer y de que no esté averiado. */
export function antennaOn(state: GameState, cfg: GameConfig = defaultConfig): boolean {
  const plan = state.lastPlan;
  if (!plan || state.modules.workshop.broken) return false;
  return plan.workshop >= cfg.balance.effects.workshopMinEnergy;
}

/** Próxima tormenta anunciada por la Tierra, o null si no hay antena o no hay tormenta a la vista. */
export function stormWarning(state: GameState, cfg: GameConfig = defaultConfig): StormWarning | null {
  if (state.phase === 'ended' || !antennaOn(state, cfg)) return null;
  const limit = state.day + cfg.balance.events.warningDays;
  const next = state.scheduledEvents
    .filter((e) => e.kind === 'storm' && e.day > state.day && e.day <= limit)
    .sort((a, b) => a.day - b.day)[0];
  if (!next) return null;
  const raw = next.payload?.level;
  const level = typeof raw === 'string' && /^S[1-4]$/.test(raw) ? (raw as StormLevel) : undefined;
  return { day: next.day, ...(level ? { level } : {}), inDays: next.day - state.day };
}
