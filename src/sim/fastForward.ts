// Avance rápido: repite el plan de hoy varios días y se detiene cuando algo requiere atención. Puro.

import { actOf } from './acts';
import { defaultConfig } from './config';
import { fitPlan, runDay, validatePlan } from './engine';
import { resourceEnteredLow } from './thresholds';
import { MODULE_IDS } from './types';
import type { GameConfig, GameState, ModuleId, Plan } from './types';

export type StopReason = 'event' | 'low' | 'night_soon' | 'act' | 'invalid_plan' | 'end' | 'max';

/** Prioridad de reparto al ajustar el plan a la energía de cada día (igual que el preset "repetir"). */
export const REPEAT_ORDER: readonly ModuleId[] = ['recycler', 'shield', 'greenhouse', 'workshop'];

/** ¿Entra la noche en los próximos días del pronóstico sin que ya estemos en ella? */
export function nightSoon(state: Pick<GameState, 'day'>, cfg: GameConfig = defaultConfig): boolean {
  const nights = cfg.light.nightDays;
  if (nights.includes(state.day)) return false;
  const ahead = cfg.balance.fastForward.nightLookahead;
  for (let d = state.day + 1; d <= state.day + ahead; d++) if (nights.includes(d)) return true;
  return false;
}

/**
 * Motivo por el que hay que parar después de pasar de `prev` a `next`, o null si se puede seguir.
 * Prioridad: fin de partida, evento con decisión, cambio de acto, recurso en Bajo/Crítico, noche cerca.
 */
export function stepReason(prev: GameState, next: GameState, cfg: GameConfig = defaultConfig): StopReason | null {
  if (next.phase === 'ended') return 'end';
  if (next.phase === 'event') return 'event';
  if (actOf(next.day, cfg).id !== actOf(prev.day, cfg).id) return 'act';
  if (resourceEnteredLow(prev, next, cfg)) return 'low';
  if (nightSoon(next, cfg)) return 'night_soon';
  return null;
}

export interface FastForwardStep {
  state: GameState;
  /** Plan que se ejecutó (ajustado a la energía de ese día). Null si no se ejecutó el día. */
  plan: Plan | null;
  /** true si se resolvió un día. */
  ran: boolean;
  /** Motivo de parada tras este paso; null = seguir. Si `ran` es false siempre trae motivo. */
  reason: StopReason | null;
}

/**
 * Un día de avance rápido: ajusta `desired` a la energía de hoy (módulos averiados o bloqueados
 * quedan en 0) y lo ejecuta. Si la falta de energía obliga a recortar el plan, NO se ejecuta
 * y se devuelve 'invalid_plan': la comandante debe decidir.
 */
export function fastForwardStep(state: GameState, desired: Plan, cfg: GameConfig = defaultConfig): FastForwardStep {
  if (state.phase === 'ended') return { state, plan: null, ran: false, reason: 'end' };
  if (state.phase === 'event') return { state, plan: null, ran: false, reason: 'event' };

  // Lo que se podría pedir hoy sin contar la falta de energía: sin averiados ni bloqueados.
  const wanted: Plan = { ...desired };
  for (const id of MODULE_IDS) {
    if (state.modules[id].broken || !state.unlocked.includes(id)) wanted[id] = 0;
  }
  const fitted = fitPlan(state, wanted, REPEAT_ORDER, cfg);
  const total = (p: Plan): number => MODULE_IDS.reduce((sum, id) => sum + p[id], 0);
  if (total(fitted) < total(wanted) || !validatePlan(state, fitted, cfg).ok) {
    return { state, plan: null, ran: false, reason: 'invalid_plan' };
  }
  const next = runDay(state, fitted, cfg);
  return { state: next, plan: fitted, ran: true, reason: stepReason(state, next, cfg) };
}

export interface FastForwardResult {
  state: GameState;
  /** Días resueltos. */
  days: number;
  reason: StopReason;
}

/** Ejecuta el mismo plan día tras día hasta `fastForward.maxDays` o hasta que algo pida atención. */
export function fastForward(state: GameState, plan: Plan, cfg: GameConfig = defaultConfig): FastForwardResult {
  const max = cfg.balance.fastForward.maxDays;
  let current = state;
  let days = 0;
  for (;;) {
    const step = fastForwardStep(current, plan, cfg);
    if (!step.ran) return { state: current, days, reason: step.reason ?? 'invalid_plan' };
    current = step.state;
    days++;
    if (step.reason) return { state: current, days, reason: step.reason };
    if (days >= max) return { state: current, days, reason: 'max' };
  }
}
