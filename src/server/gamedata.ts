// Respaldo de datos del juego en Supabase. Independiente de la plataforma: lo usan la función de
// Vercel (/api/gamedata.ts), el servidor de desarrollo (astro.config.mjs) y los tests.
//
// Orden de lectura en el navegador (src/data/loadData.ts):
//   1. /data/<nombre>.json  (fuente principal: archivo estático del repo, servido por la CDN de Vercel)
//   2. /api/gamedata?name=<nombre>  (esta lógica: Vercel Function → tabla public.game_data de Supabase)
//   3. null  (el componente se oculta o usa su texto por defecto; el juego sigue)
//
// La URL y la clave publicable de Supabase viven en variables de entorno (SUPABASE_URL,
// SUPABASE_PUBLISHABLE_KEY): nunca en el repo. La tabla solo permite leer (RLS).

/** Solo estos nombres se pueden pedir: nada de consultas libres. */
export const GAMEDATA_NAMES = [
  'balance',
  'challenges',
  'food_facts',
  'light_sequence',
  'osdr_facts',
  'radiation_iss',
  'sfx_lines',
  'sources',
  'storms_real',
  'storms_sample',
] as const;
export type GameDataName = (typeof GAMEDATA_NAMES)[number];

export const GAMEDATA_TIMEOUT_MS = 4000;
export const GAMEDATA_CACHE_SECONDS = 3600;

export function isGameDataName(name: unknown): name is GameDataName {
  return typeof name === 'string' && (GAMEDATA_NAMES as readonly string[]).includes(name);
}

export interface GameDataOptions {
  name: unknown;
  url: string | undefined;
  key: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface GameDataResult {
  status: number;
  body: unknown;
}

/** Nunca lanza: devuelve 400 (nombre no permitido), 503 (sin configurar o Supabase caído), 404 o 200. */
export async function getGameData(opts: GameDataOptions): Promise<GameDataResult> {
  if (!isGameDataName(opts.name)) return { status: 400, body: { error: 'unknown_name' } };
  if (!opts.url || !opts.key) return { status: 503, body: { error: 'not_configured' } };
  const doFetch = opts.fetchImpl ?? fetch;
  const endpoint = `${opts.url.replace(/\/$/, '')}/rest/v1/game_data?name=eq.${opts.name}&select=data`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? GAMEDATA_TIMEOUT_MS);
  try {
    const res = await doFetch(endpoint, {
      headers: { apikey: opts.key, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return { status: 503, body: { error: 'upstream', code: res.status } };
    const rows = (await res.json()) as { data: unknown }[];
    if (!Array.isArray(rows) || rows.length === 0) return { status: 404, body: { error: 'not_found' } };
    return { status: 200, body: rows[0].data };
  } catch {
    return { status: 503, body: { error: 'unreachable' } };
  } finally {
    clearTimeout(timer);
  }
}

export function gameDataHeaders(result: GameDataResult): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'x-data-source': result.status === 200 ? 'supabase' : 'none',
    'cache-control': result.status === 200 ? `public, max-age=${GAMEDATA_CACHE_SECONDS}` : 'no-store',
  };
}
