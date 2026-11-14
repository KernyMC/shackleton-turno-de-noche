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

const levelNumber = (storm: StormData): number => Number(storm.level.slice(1));

/**
 * Tormentas reales (DONKI) cuyo nivel está en el rango; si no hay ninguna, las del nivel más
 * cercano al rango. Nunca se cambia el nivel de una tormenta.
 */
export function stormsForRange(storms: readonly StormData[], [min, max]: [number, number]): StormData[] {
  const gap = (s: StormData): number => Math.max(min - levelNumber(s), levelNumber(s) - max, 0);
  const best = Math.min(...storms.map(gap));
  return storms.filter((s) => gap(s) === best);
}

/**
 * Eventos de la partida, por actos (ver balance.json → events). Determinista por semilla.
 * Orden fijo de colocación: eventos de día fijo, hielo, tormentas, averías. Nunca dos eventos el
 * mismo día; si una ventana no tiene hueco, el evento se descarta.
 */
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

  for (const fixed of ev.fixed) place(fixed.kind, [fixed.day, fixed.day]);
  place('ice', ev.iceWindow);

  let firstStormPending = true;
  for (const slot of ev.storms) {
    const range = slot.levels[difficulty];
    if (!range) continue; // esta dificultad no tiene esta tormenta
    // Se sortea siempre, aunque luego se sustituya, para no alterar el resto de la secuencia.
    const picked = rng.pick(stormsForRange(cfg.storms, range));
    const storm = firstStormPending && options.firstStorm ? options.firstStorm : picked;
    firstStormPending = false;
    place('storm', slot.window, { ...storm });
  }

  for (const slot of ev.breakdowns) {
    const roll = rng.next();
    const mod = rng.pick(breakableModules(difficulty));
    if (roll < slot.chance[difficulty]) place('breakdown', slot.window, { module: mod });
  }

  return events.sort((a, b) => a.day - b.day);
}
