// Veredicto de un plan antes de ejecutarlo: ¿cómo amanece la base mañana?
// Puro: solo interpreta el resultado de previewDay. Umbrales de §4.7 del documento original.

import { defaultConfig } from './config';
import { previewDay } from './engine';
import type { GameConfig, GameState, Plan } from './types';

export type VerdictLevel = 'safe' | 'tight' | 'critical';
export type VerdictReason = 'blackout' | 'life_support' | 'food' | 'dose';

export interface Verdict {
  level: VerdictLevel;
  /** Lo que más preocupa, o null si todo va bien. */
  reason: VerdictReason | null;
  /** Valores con los que termina el día. */
  lifeSupport: number;
  food: number;
  battery: number;
  dose: number;
  wasted: number;
}

export function planVerdict(state: GameState, plan: Plan, cfg: GameConfig = defaultConfig): Verdict {
  const p = previewDay(state, plan, cfg);
  const lifeSupport = Math.round((state.lifeSupport + p.lifeSupport) * 100) / 100;
  const food = Math.round((state.food + p.food) * 100) / 100;
  const dose = Math.round((state.dose + p.dose) * 100) / 100;
  const { low: LOW, critical: CRITICAL, doseCaution: DOSE_CAUTION, doseDanger: DOSE_DANGER } = cfg.balance.thresholds;
  const doseFraction = dose / cfg.balance.difficulty[state.difficulty].doseLimit;

  // Se revisa de lo más grave a lo menos grave; dentro de cada nivel, el recurso más bajo manda.
  const checks: [boolean, VerdictLevel, VerdictReason][] = [
    [p.blackout, 'critical', 'blackout'],
    [doseFraction >= DOSE_DANGER, 'critical', 'dose'],
    [lifeSupport <= CRITICAL && lifeSupport <= food, 'critical', 'life_support'],
    [food <= CRITICAL, 'critical', 'food'],
    [lifeSupport <= CRITICAL, 'critical', 'life_support'],
    [doseFraction >= DOSE_CAUTION, 'tight', 'dose'],
    [lifeSupport <= LOW && lifeSupport <= food, 'tight', 'life_support'],
    [food <= LOW, 'tight', 'food'],
    [lifeSupport <= LOW, 'tight', 'life_support'],
  ];
  const hit = checks.find(([condition]) => condition);
  return {
    level: hit ? hit[1] : 'safe',
    reason: hit ? hit[2] : null,
    lifeSupport,
    food,
    battery: p.battery,
    dose,
    wasted: p.wasted,
  };
}
