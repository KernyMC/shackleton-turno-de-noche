// Vercel Function: GET /api/spaceweather
// Proxy de NASA DONKI. La clave vive en la variable de entorno NASA_API_KEY del proyecto de Vercel
// (Settings → Environment Variables) y nunca se envía al navegador.
// Misma lógica que la función de Cloudflare Pages (functions/api/spaceweather.ts) y que el servidor
// de desarrollo (astro.config.mjs). La CDN de Vercel guarda la respuesta 1 hora (5 min si NASA
// no respondió), así la cuota de la clave no se gasta en cada visita.

import { CACHE_SECONDS, FALLBACK_CACHE_SECONDS, getSpaceWeather, responseHeaders } from '../src/server/spaceweather.ts';

export async function GET(): Promise<Response> {
  const body = await getSpaceWeather({ apiKey: process.env.NASA_API_KEY });
  const seconds = body.fallback ? FALLBACK_CACHE_SECONDS : CACHE_SECONDS;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...responseHeaders(body), 'vercel-cdn-cache-control': `max-age=${seconds}` },
  });
}
