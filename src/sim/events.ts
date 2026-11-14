// Programación de los eventos garantizados de una partida. Puro y determinista.
// Reglas: docs/specs/00-documento-original.md §6.1.

import { defaultConfig } from './config';
import { createRng } from './rng';
import type { Difficulty, GameConfig, ModuleId, ScheduledEvent, StormData } from './types';

/**
 * Módulos que pueden averiarse.
 * - El taller nunca: sin taller no se podría reparar nada.
 * - En Cadete tampoco el reciclador: una avería sin reparar llegaría a la noche lunar.
 */
export function breakableModules(difficulty: Difficulty): ModuleId[] {
  return difficulty === 'cadete' ? ['greenhouse', 'shield'] : ['recycler', 'greenhouse', 'shield'];
}

function daysIn([from, to]: [number, number]): number[] {
  const days: number[] = [];
  for (let d = Math.max(2, from); d <= to; d++) days.push(d); // nunca el día 1
  return days;
}

export interface ScheduleOptions {
  /** Si se da, la primera tormenta de la partida es este evento (p. ej. la tormenta real de hoy). */
  firstStorm?: StormData;
}

export function scheduleEvents(
  seed: number,
  difficulty: Difficulty,
  cfg: GameConfig = defaultConfig,
  options: ScheduleOptions = {},
): ScheduledEvent[] {
  const rng = createRng(seed);
  const ev = cfg.balance.events;
  const taken = new Set<number>();
  const events: ScheduledEvent[] = [];

  const place = (
    kind: ScheduledEvent['kind'],
    window: [number, number],
    payload?: Record<string, unknown>,
  ): void => {
    const free = daysIn(window).filter((d) => !taken.has(d));
    if (free.length === 0) return; // sin hueco: se descarta
    const day = rng.pick(free);
    taken.add(day);
    events.push(payload ? { day, kind, payload } : { day, kind });
  };

  // Orden fijo: primero lo que no se puede mover.
  place('night_warning', [ev.nightWarningDay, ev.nightWarningDay]);
  place('ice', ev.iceWindow);
  const stormCount = cfg.balance.difficulty[difficulty].stormCount;
  ev.stormWindows.slice(0, stormCount).forEach((window, i) => {
    // Se sortea siempre, aunque luego se sustituya, para no alterar el resto de la secuencia.
    const picked = rng.pick(cfg.storms);
    const storm = i === 0 && options.firstStorm ? options.firstStorm : picked;
    place('storm', window, { ...storm });
  });
  place('breakdown', ev.breakdownWindow, { module: rng.pick(breakableModules(difficulty)) });

  return events.sort((a, b) => a.day - b.day);
}
