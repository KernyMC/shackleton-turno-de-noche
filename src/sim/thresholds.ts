// Zonas de alerta de los recursos (Bajo / Crítico). Mismos umbrales que el HUD: balance.json → thresholds.

import { defaultConfig } from './config';
import type { GameConfig, GameState } from './types';

/** 0 = bien, 1 = bajo, 2 = crítico. */
export type AlertLevel = 0 | 1 | 2;

export interface ResourceLevels {
  lifeSupport: AlertLevel;
  food: AlertLevel;
  dose: AlertLevel;
  battery: AlertLevel;
}

type Values = Pick<GameState, 'lifeSupport' | 'food' | 'dose' | 'battery' | 'difficulty'>;

export function resourceLevels(state: Values, cfg: GameConfig = defaultConfig): ResourceLevels {
  const t = cfg.balance.thresholds;
  const d = cfg.balance.difficulty[state.difficulty];
  const stock = (v: number): AlertLevel => (v <= t.critical ? 2 : v <= t.low ? 1 : 0);
  const doseFraction = state.dose / d.doseLimit;
  return {
    lifeSupport: stock(state.lifeSupport),
    food: stock(state.food),
    dose: doseFraction >= t.doseDanger ? 2 : doseFraction >= t.doseCaution ? 1 : 0,
    battery: state.battery <= d.batteryCapacity * t.batteryLow ? 1 : 0,
  };
}

/** ¿Algún recurso está en Bajo o Crítico? */
export function anyResourceLow(state: Values, cfg: GameConfig = defaultConfig): boolean {
  const l = resourceLevels(state, cfg);
  return l.lifeSupport > 0 || l.food > 0 || l.dose > 0 || l.battery > 0;
}

/** ¿Algún recurso empeoró de nivel (entró en Bajo o Crítico) entre dos estados? */
export function resourceEnteredLow(prev: Values, next: Values, cfg: GameConfig = defaultConfig): boolean {
  const a = resourceLevels(prev, cfg);
  const b = resourceLevels(next, cfg);
  return b.lifeSupport > a.lifeSupport || b.food > a.food || b.dose > a.dose || b.battery > a.battery;
}
