// Ayuda para la noche lunar: cuánto falta, cuántas noches quedan y cuánta batería se puede gastar
// en cada una para llegar al amanecer. Solo informa y propone un plan: no cambia ninguna regla.
// Puro y determinista, como el resto del motor.
import { maxEnergyFor } from './acts';
import { defaultConfig } from './config';
import { fitPlan, getEnergyBudget } from './engine';
import { nightSoon, REPEAT_ORDER } from './fastForward';
import type { GameConfig, GameState, Plan } from './types';

export interface NightInfo {
  /** 'soon' = la noche entra en los próximos días; 'night' = hoy es noche. */
  phase: 'soon' | 'night';
  /** Días que faltan para la primera noche (0 si ya es de noche). */
  daysUntil: number;
  /** Qué noche es hoy dentro de esta noche lunar (1..total); 0 si aún no empezó. */
  nightIndex: number;
  /** Cuántos días dura esta noche lunar. */
  nightTotal: number;
  /** Noches que quedan por pasar, contando la de hoy. */
  nightsLeft: number;
  /** Energía que se puede repartir en cada noche que queda sin apagar la base antes del amanecer. */
  ration: number;
}

/** Días seguidos de noche a partir de `from` (incluido). */
function runFrom(nights: readonly number[], from: number): number {
  let n = 0;
  while (nights.includes(from + n)) n++;
  return n;
}

/** Datos de la noche lunar para el día actual, o null si ni es de noche ni está cerca. */
export function nightInfo(state: GameState, cfg: GameConfig = defaultConfig): NightInfo | null {
  const nights = cfg.light.nightDays;
  const base = cfg.balance.difficulty[state.difficulty].baseConsumption;
  if (nights.includes(state.day)) {
    let start = state.day;
    while (nights.includes(start - 1)) start--;
    const total = runFrom(nights, start);
    const left = runFrom(nights, state.day);
    // Lo que se puede gastar: la batería menos lo que la base consume sola cada noche que queda.
    const spendable = Math.max(0, state.battery - base * left);
    const ration = Math.min(Math.floor(spendable / left), Math.floor(getEnergyBudget(state, cfg).available + 1e-9));
    return { phase: 'night', daysUntil: 0, nightIndex: state.day - start + 1, nightTotal: total, nightsLeft: left, ration: Math.max(0, ration) };
  }
  if (!nightSoon(state, cfg)) return null;
  const first = nights.filter((d) => d > state.day).sort((a, b) => a - b)[0]!;
  const total = runFrom(nights, first);
  const capacity = cfg.balance.difficulty[state.difficulty].batteryCapacity;
  // Con la batería llena, esto es lo que tocaría por noche: sirve de referencia al prepararse.
  const ration = Math.max(0, Math.floor((capacity - base * total) / total));
  return { phase: 'soon', daysUntil: first - state.day, nightIndex: 0, nightTotal: total, nightsLeft: total, ration };
}

/**
 * Plan que reparte la ración de esta noche entre aire y comida, en proporción a lo que admite cada
 * módulo, sin pasarse de la energía de hoy. Los módulos averiados o bloqueados quedan a 0.
 */
export function nightRationPlan(state: GameState, cfg: GameConfig = defaultConfig): Plan {
  const info = nightInfo(state, cfg);
  const ration = info?.phase === 'night' ? info.ration : 0;
  const caps = {
    recycler: state.modules.recycler.broken ? 0 : maxEnergyFor(state, 'recycler', cfg),
    greenhouse: state.modules.greenhouse.broken ? 0 : maxEnergyFor(state, 'greenhouse', cfg),
  };
  const sum = caps.recycler + caps.greenhouse;
  const recycler = sum > 0 ? Math.min(caps.recycler, Math.round((ration * caps.recycler) / sum)) : 0;
  const greenhouse = sum > 0 ? Math.min(caps.greenhouse, Math.max(0, ration - recycler)) : 0;
  return fitPlan(state, { recycler, greenhouse, shield: 0, workshop: 0 }, REPEAT_ORDER, cfg);
}
