// Clima espacial de hoy (NASA DONKI vía /api/spaceweather). Opcional por diseño: si la consulta
// falla, tarda o el Sol está tranquilo, el juego usa las tormentas históricas sin mostrar errores.

import { signal } from '@preact/signals';
import { isSpaceEvent, strongestEvent } from '../data/donki.ts';
import type { SpaceEvent, SpaceWeather } from '../data/donki.ts';
import type { StormData } from '../sim/types';

export const CLIENT_TIMEOUT_MS = 4000;

export type WeatherOrigin = 'live' | 'cache' | 'fallback' | 'offline';

export interface WeatherState {
  status: 'idle' | 'loading' | 'done';
  /** Solo si el Sol está activo hoy y la respuesta es válida. */
  event: SpaceEvent | null;
  /** live = DONKI respondió ahora · cache = caché del servidor · fallback = DONKI no respondió · offline = no se llegó al servidor. */
  origin: WeatherOrigin | null;
  /** Respuesta cruda o error, para el modo debug. */
  raw: unknown;
}

export const spaceWeather = signal<WeatherState>({ status: 'idle', event: null, origin: null, raw: null });

function isWeather(v: unknown): v is SpaceWeather {
  return typeof v === 'object' && v !== null && Array.isArray((v as SpaceWeather).events) && typeof (v as SpaceWeather).active === 'boolean';
}

/** Lanza la consulta una sola vez. Nunca rechaza ni bloquea. */
export async function loadSpaceWeather(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (spaceWeather.value.status !== 'idle') return;
  spaceWeather.value = { ...spaceWeather.value, status: 'loading' };
  try {
    const response = await fetchImpl('/api/spaceweather', { signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS) });
    const raw: unknown = await response.json();
    if (!response.ok || !isWeather(raw)) throw new Error(`respuesta no válida (${response.status})`);
    const origin: WeatherOrigin = raw.fallback ? 'fallback' : raw.cached ? 'cache' : 'live';
    const event = raw.active && !raw.fallback ? strongestEvent(raw.events.filter(isSpaceEvent)) : null;
    spaceWeather.value = { status: 'done', event, origin, raw };
  } catch (error) {
    // Sin red, sin servidor (p. ej. `astro preview`) o tiempo agotado: silencio para el jugador.
    spaceWeather.value = { status: 'done', event: null, origin: 'offline', raw: String(error) };
  }
}

/** Tormenta del juego a partir del evento real de hoy, o null si no hay. */
export function liveStorm(): StormData | null {
  const e = spaceWeather.value.event;
  if (!e) return null;
  return {
    id: e.id,
    level: `S${e.level}` as StormData['level'],
    date: e.date,
    classType: e.classOrSpeed,
    link: e.link,
    type: e.type,
    origin: 'live',
  };
}

/** Solo para tests. */
export function resetSpaceWeather(): void {
  spaceWeather.value = { status: 'idle', event: null, origin: null, raw: null };
}
