// Actos de la partida y desbloqueo de módulos. Puro: todo sale de balance.json (acts).

import { defaultConfig } from './config';
import type { ActDef, GameConfig, GameState, ModuleId } from './types';

export interface ActInfo {
  /** 1..5 */
  id: number;
  /** Nombre corto del acto (i18n: act.<key>). */
  key: string;
  from: number;
  to: number;
}

export interface ActGoalStatus {
  act: number;
  key: string;
  /** Tipo de objetivo (air_food, battery_pct, no_blackout, all_min, reach_day). */
  goal: string;
  /** Variables para el texto del objetivo (valor actual, meta, días...). */
  vars: Record<string, number>;
  /** 0..1 */
  progress: number;
  /** Valor actual de lo que se mide. */
  value: number;
  target: number;
  /** El objetivo se cumple con el estado de ahora. Es definitivo al cerrar el acto. */
  met: boolean;
  /** true mientras el acto sigue abierto (la partida no ha terminado). */
  pending: boolean;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const r2 = (n: number): number => Math.round(n * 100) / 100;

function defOf(day: number, cfg: GameConfig): ActDef {
  const list = cfg.balance.acts.list;
  return list.find((a) => day >= a.from && day <= a.to) ?? (day < 1 ? list[0]! : list[list.length - 1]!);
}

/** Acto al que pertenece un día. */
export function actOf(day: number, cfg: GameConfig = defaultConfig): ActInfo {
  const a = defOf(day, cfg);
  return { id: a.id, key: a.key, from: a.from, to: a.to };
}

/** ¿Es `day` el último día de su acto? */
export function isLastDayOfAct(day: number, cfg: GameConfig = defaultConfig): boolean {
  return actOf(day, cfg).to === day;
}

/** Evalúa el objetivo de un acto con el estado dado. */
function evaluate(
  def: ActDef,
  state: Pick<GameState, 'battery' | 'lifeSupport' | 'food' | 'history' | 'result' | 'difficulty'>,
  cfg: GameConfig,
): Pick<ActGoalStatus, 'vars' | 'progress' | 'value' | 'target' | 'met'> {
  const { type, target } = def.goal;
  const capacity = cfg.balance.difficulty[state.difficulty].batteryCapacity;
  const batteryPct = r2((state.battery / capacity) * 100);
  switch (type) {
    case 'air_food': {
      const value = Math.min(state.lifeSupport, state.food);
      return {
        vars: { air: state.lifeSupport, food: state.food, value, target },
        progress: clamp01(value / target),
        value,
        target,
        met: value >= target,
      };
    }
    case 'battery_pct':
      return {
        vars: { value: batteryPct, target },
        progress: clamp01(batteryPct / target),
        value: batteryPct,
        target,
        met: batteryPct >= target,
      };
    case 'all_min': {
      const value = Math.min(state.lifeSupport, state.food, batteryPct);
      return {
        vars: { air: state.lifeSupport, food: state.food, battery: batteryPct, value, target },
        progress: clamp01(value / target),
        value,
        target,
        met: value >= target,
      };
    }
    case 'no_blackout': {
      const inAct = state.history.filter((h) => h.day >= def.from && h.day <= def.to);
      const blackouts = inAct.filter((h) => h.blackout).length;
      const length = def.to - def.from + 1;
      return {
        vars: { blackouts, days: inAct.length, length },
        progress: blackouts > 0 ? 0 : clamp01(inAct.length / length),
        value: blackouts,
        target: 0,
        met: blackouts === 0,
      };
    }
    case 'reach_day': {
      const value = state.history.length;
      return {
        vars: { value, target },
        progress: clamp01(value / target),
        value,
        target,
        met: value >= target && state.result?.outcome !== 'loss',
      };
    }
  }
}

/** Progreso del objetivo del acto ACTUAL con el estado de ahora. */
export function actGoalStatus(state: GameState, cfg: GameConfig = defaultConfig): ActGoalStatus {
  const def = defOf(state.day, cfg);
  return {
    act: def.id,
    key: def.key,
    goal: def.goal.type,
    ...evaluate(def, state, cfg),
    pending: state.phase !== 'ended',
  };
}

/** Evalúa el objetivo de un acto concreto (lo usa el motor al cerrarlo). */
export function actGoalMet(state: GameState, actId: number, cfg: GameConfig = defaultConfig): boolean {
  const def = cfg.balance.acts.list.find((a) => a.id === actId);
  return def ? evaluate(def, state, cfg).met : false;
}

/** ¿Está el módulo desbloqueado? Los bloqueados no reciben energía. */
export function isUnlocked(state: Pick<GameState, 'unlocked'>, id: ModuleId): boolean {
  return state.unlocked.includes(id);
}

/** Energía máxima que puede recibir un módulo hoy: 0 si está bloqueado. */
export function maxEnergyFor(state: Pick<GameState, 'unlocked'>, id: ModuleId, cfg: GameConfig = defaultConfig): number {
  return isUnlocked(state, id) ? cfg.balance.modules[id].maxEnergy : 0;
}
