// Lógica del proxy de clima espacial. Independiente de la plataforma: la usan la función de
// Cloudflare Pages (/functions/api/spaceweather.ts), el servidor de desarrollo (astro.config.mjs)
// y los tests. La clave de NASA se recibe como parámetro: NUNCA llega al navegador.

import { isActive, NORMALIZERS, sortEvents, ymd } from '../data/donki.ts';
import type { DonkiType, SpaceEvent, SpaceWeather } from '../data/donki.ts';

export const DONKI_BASE_URL = 'https://api.nasa.gov/DONKI/';
export const DONKI_TYPES: DonkiType[] = ['FLR', 'CME', 'SEP'];
export const LOOKBACK_DAYS = 30;
export const TIMEOUT_MS = 5000;
/** Segundos que se guarda una respuesta buena / de respaldo. */
export const CACHE_SECONDS = 3600;
export const FALLBACK_CACHE_SECONDS = 300;

export interface SpaceWeatherOptions {
  apiKey: string | undefined;
  fetchImpl?: typeof fetch;
  now?: Date;
  baseUrl?: string;
  timeoutMs?: number;
}

export function fallbackResponse(now: Date): SpaceWeather {
  return { fetchedAt: now.toISOString(), active: false, events: [], fallback: true };
}

/**
 * Consulta FLR, CME y SEP de los últimos 30 días en paralelo, con un tiempo máximo común.
 * Nunca lanza error: si ningún tipo responde, devuelve la respuesta de respaldo.
 * Si solo algunos fallan, devuelve los que sí respondieron y lista los fallidos en `failed`.
 */
export async function getSpaceWeather(options: SpaceWeatherOptions): Promise<SpaceWeather> {
  const now = options.now ?? new Date();
  const doFetch = options.fetchImpl ?? fetch;
  const base = options.baseUrl ?? DONKI_BASE_URL;
  if (!options.apiKey) return fallbackResponse(now);

  const signal = AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS);
  const start = ymd(new Date(now.getTime() - LOOKBACK_DAYS * 864e5));
  const end = ymd(now);

  const results = await Promise.all(
    DONKI_TYPES.map(async (type): Promise<SpaceEvent[] | null> => {
      try {
        const url = `${base}${type}?startDate=${start}&endDate=${end}&api_key=${encodeURIComponent(options.apiKey!)}`;
        const response = await doFetch(url, { signal });
        if (!response.ok) return null;
        const text = await response.text();
        // DONKI responde cuerpo vacío cuando no hay eventos en el rango.
        const data: unknown = text.trim() === '' ? [] : JSON.parse(text);
        return NORMALIZERS[type](data);
      } catch {
        return null; // red caída, tiempo agotado, JSON inválido
      }
    }),
  );

  const failed = DONKI_TYPES.filter((_, i) => results[i] === null);
  if (failed.length === DONKI_TYPES.length) return fallbackResponse(now);

  const events = sortEvents(results.flatMap((r) => r ?? []));
  const body: SpaceWeather = { fetchedAt: now.toISOString(), active: isActive(events, now), events };
  if (failed.length > 0) body.failed = failed;
  return body;
}

/** Cabeceras HTTP de la respuesta según si es buena o de respaldo. */
export function responseHeaders(body: SpaceWeather): Record<string, string> {
  const seconds = body.fallback ? FALLBACK_CACHE_SECONDS : CACHE_SECONDS;
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': `public, max-age=${seconds}`,
  };
}
