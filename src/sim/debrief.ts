// Lectura de una partida terminada para el debrief: cuándo se decidió y qué pasó. Puro.

import { defaultConfig } from './config';
import type { GameConfig, GameState, LossCause } from './types';

export interface MissionReview {
  /** Primer día en que el recurso que falló entró en zona de peligro. Null si se ganó. */
  decisiveDay: number | null;
  /** Día al que conviene volver para intentarlo de nuevo. Null si se ganó. */
  rewindDay: number | null;
  /** La derrota ocurrió durante la noche lunar. */
  duringNight: boolean;
  /** Energía total desperdiciada por tener la batería llena. */
  wasted: number;
  stormsTotal: number;
  stormsSheltered: number;
  blackouts: number;
  /** Valor más bajo que tuvo cada recurso. */
  lowest: { lifeSupport: number; food: number; battery: number };
}

const LOW = 25;
const DOSE_CAUTION = 0.7;
/** Días de margen antes del día decisivo para poder corregir el rumbo. */
const REWIND_MARGIN = 2;

function inDanger(cause: LossCause, h: { lifeSupport: number; food: number; dose: number }, doseLimit: number): boolean {
  if (cause === 'life_support') return h.lifeSupport <= LOW;
  if (cause === 'food') return h.food <= LOW;
  return h.dose / doseLimit >= DOSE_CAUTION;
}

export function reviewMission(state: GameState, cfg: GameConfig = defaultConfig): MissionReview {
  const history = state.history;
  const doseLimit = cfg.balance.difficulty[state.difficulty].doseLimit;
  const cause = state.result?.outcome === 'loss' ? state.result.causes[0] : undefined;

  let decisiveDay: number | null = null;
  if (cause) {
    decisiveDay = history.find((h) => inDanger(cause, h, doseLimit))?.day ?? history.at(-1)?.day ?? 1;
  }
  const storms = state.log.filter((l) => l.key === 'log.storm.shelter' || l.key === 'log.storm.work');
  const lastDay = history.at(-1)?.day ?? state.day;

  return {
    decisiveDay,
    rewindDay: decisiveDay === null ? null : Math.max(1, decisiveDay - REWIND_MARGIN),
    duringNight: cause !== undefined && cfg.light.nightDays.includes(lastDay),
    wasted: Math.round(history.reduce((sum, h) => sum + h.wasted, 0)),
    stormsTotal: storms.length,
    stormsSheltered: storms.filter((l) => l.key === 'log.storm.shelter').length,
    blackouts: history.filter((h) => h.blackout).length,
    lowest: {
      lifeSupport: Math.min(...history.map((h) => h.lifeSupport), state.lifeSupport),
      food: Math.min(...history.map((h) => h.food), state.food),
      battery: Math.min(...history.map((h) => h.battery), state.battery),
    },
  };
}
