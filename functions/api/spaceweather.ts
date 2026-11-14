// Cloudflare Pages Function: GET /api/spaceweather
// Proxy de NASA DONKI. La clave vive en la variable de entorno NASA_API_KEY del proyecto de
// Cloudflare (Settings → Variables and Secrets) y nunca se envía al navegador.
// En local: `npm run dev` sirve esta misma ruta desde astro.config.mjs leyendo .env.

import { getSpaceWeather, responseHeaders } from '../../src/server/spaceweather.ts';
import type { SpaceWeather } from '../../src/data/donki.ts';

interface Env {
  NASA_API_KEY?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
  waitUntil(promise: Promise<unknown>): void;
}

/** Cache API de Cloudflare (`caches.default`). No existe fuera de Workers. */
function edgeCache(): Cache | null {
  const store = (globalThis as unknown as { caches?: { default?: Cache } }).caches;
  return store?.default ?? null;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const cache = edgeCache();
  const cacheKey = new Request(new URL('/api/spaceweather', context.request.url).toString(), { method: 'GET' });

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const body = (await hit.json()) as SpaceWeather;
      return new Response(JSON.stringify({ ...body, cached: true }), { headers: responseHeaders(body) });
    }
  }

  const body = await getSpaceWeather({ apiKey: context.env.NASA_API_KEY });
  const response = new Response(JSON.stringify(body), { status: 200, headers: responseHeaders(body) });
  if (cache) context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
