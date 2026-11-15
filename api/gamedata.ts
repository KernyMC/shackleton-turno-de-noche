// Vercel Function: GET /api/gamedata?name=<archivo>
// Respaldo de los JSON de public/data: si el navegador no puede leer /data/<archivo>.json, pide aquí
// la copia guardada en Supabase (tabla public.game_data, solo lectura). La URL y la clave publicable
// viven en las variables de entorno del proyecto de Vercel (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY).
// Lógica compartida con el servidor de desarrollo en src/server/gamedata.ts.

import { GAMEDATA_CACHE_SECONDS, gameDataHeaders, getGameData } from '../src/server/gamedata.ts';

export async function GET(request: Request): Promise<Response> {
  const name = new URL(request.url).searchParams.get('name');
  const result = await getGameData({
    name,
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_PUBLISHABLE_KEY,
  });
  const headers: Record<string, string> = gameDataHeaders(result);
  if (result.status === 200) headers['vercel-cdn-cache-control'] = `max-age=${GAMEDATA_CACHE_SECONDS}`;
  return new Response(JSON.stringify(result.body), { status: result.status, headers });
}
