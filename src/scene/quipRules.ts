// Qué dice la tripulación y cuándo: reglas de PRESENTACIÓN (no tocan el estado ni el motor).
// Compara el estado anterior con el nuevo al cerrarse un día y devuelve, como mucho, una frase.
// Scene.tsx añade las reglas de contexto (sin evento pendiente, sin tormenta hoy, sin avance rápido,
// sin resolver el día y como mucho un globo cada 2 días). Tono cálido y concreto: nunca culpa ni asusta.

import type { CrewId } from '../data/crew';
import { defaultConfig } from '../sim/config';
import { getLight } from '../sim/engine';
import { resourceLevels } from '../sim/thresholds';
import { MODULE_IDS } from '../sim/types';
import type { GameState } from '../sim/types';

export interface Quip {
  crew: CrewId;
  /** Clave i18n (quip.*). */
  key: string;
}

/** Días de aviso antes de la noche. */
const NIGHT_WARNING_DAYS = 2;

/** Primer día de noche posterior a `day` (o null si ya no queda ninguno). */
function nextNightDay(day: number): number | null {
  const next = defaultConfig.light.nightDays.filter((d) => d > day).sort((a, b) => a - b)[0];
  return next ?? null;
}

/** Por orden de importancia. Solo se llama con `g.day === before.day + 1`. */
export function pickQuip(before: GameState, g: GameState): Quip | null {
  const cfg = defaultConfig;
  const t = cfg.balance.thresholds;
  const capacity = cfg.balance.difficulty[g.difficulty].batteryCapacity;

  if (g.day === cfg.balance.days) return { crew: 'valeria', key: 'quip.last_day' };
  if (before.stormToday !== null && g.stormToday === null) return { crew: 'amaru', key: 'quip.storm_over' };
  if (MODULE_IDS.some((id) => before.modules[id].broken && !g.modules[id].broken)) return { crew: 'lucia', key: 'quip.repaired' };
  if (resourceLevels(g, cfg).lifeSupport > 0) return { crew: 'valeria', key: 'quip.air_low' };
  if (getLight(before.day, before.difficulty, cfg) < 0.1 && getLight(g.day, g.difficulty, cfg) >= 0.1) {
    return { crew: 'amaru', key: 'quip.sun_back' };
  }
  const nightNow = nextNightDay(g.day);
  const nightBefore = nextNightDay(before.day);
  if (nightNow !== null && nightNow - g.day <= NIGHT_WARNING_DAYS && (nightBefore === null || nightBefore - before.day > NIGHT_WARNING_DAYS)) {
    return { crew: 'lucia', key: 'quip.night_soon' };
  }
  if (g.battery >= capacity && before.battery < capacity) return { crew: 'lucia', key: 'quip.battery_full' };
  // "Alta": en la mitad superior de lo que queda por encima del umbral de Bajo.
  const high = t.low + (100 - t.low) / 2;
  if (g.food > before.food && g.food >= high) return { crew: 'mateo', key: 'quip.food_up' };
  return null;
}
