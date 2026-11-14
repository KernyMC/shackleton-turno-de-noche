// Resultado final de una partida: causas, estrellas e insignias. Puro.

import type { DaySnapshot, GameConfig, GameResult, GameState, LossCause } from './types';

const CAUSE_PRIORITY: LossCause[] = ['radiation', 'life_support', 'food'];

/** Causas de derrota de un día ya resuelto, ordenadas por prioridad. Vacío = sigue la misión. */
export function lossCauses(
  values: { lifeSupport: number; food: number; dose: number },
  doseLimit: number,
): LossCause[] {
  const found = new Set<LossCause>();
  if (values.dose >= doseLimit) found.add('radiation');
  if (values.lifeSupport <= 0) found.add('life_support');
  if (values.food <= 0) found.add('food');
  return CAUSE_PRIORITY.filter((c) => found.has(c));
}

/**
 * Margen mínimo de la partida: el valor más bajo que tuvo soporte vital, comida o
 * "dosis restante" (100 − % del límite). La batería no cuenta: vaciarla de noche es normal.
 */
export function minMargin(history: DaySnapshot[], doseLimit: number): number {
  let min = 100;
  for (const h of history) {
    min = Math.min(min, h.lifeSupport, h.food, 100 - (h.dose / doseLimit) * 100);
  }
  return Math.max(0, min);
}

export function computeResult(
  state: Pick<GameState, 'history' | 'difficulty' | 'day'>,
  causes: LossCause[],
  cfg: GameConfig,
): GameResult {
  if (causes.length > 0) {
    return { outcome: 'loss', causes, day: state.day, stars: 0, badges: [] };
  }
  const margin = minMargin(state.history, cfg.balance.difficulty[state.difficulty].doseLimit);
  const { two, three } = cfg.balance.stars;
  const stars = margin >= three ? 3 : margin >= two ? 2 : 1;
  return { outcome: 'win', causes: [], day: state.day, stars, badges: [] }; // insignias: tarea A-06
}
