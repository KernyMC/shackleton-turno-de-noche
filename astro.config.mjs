// @ts-check
import { defineConfig } from 'astro/config';

import preact from '@astrojs/preact';

// Para desarrollo local: NASA_API_KEY sale de .env (nunca se sube al repo ni llega al navegador).
try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env, /api/spaceweather responde con datos de respaldo.
}

/**
 * Sirve GET /api/spaceweather en `npm run dev` con la misma lógica que la función de
 * Cloudflare Pages (functions/api/spaceweather.ts), con caché en memoria de 1 hora.
 * En producción esta ruta la sirve Cloudflare; en `astro preview` no existe y el juego usa
 * las tormentas históricas.
 * Variables útiles para probar: DONKI_BASE_URL (forzar fallos) y SPACEWEATHER_NO_CACHE=1.
 * @returns {import('vite').Plugin}
 */
function spaceWeatherDevApi() {
  /** @type {{ at: number, body: any } | null} */
  let cache = null;
  return {
    name: 'spaceweather-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/spaceweather', async (req, res) => {
        const { getSpaceWeather, responseHeaders, CACHE_SECONDS, FALLBACK_CACHE_SECONDS } =
          await server.ssrLoadModule('/src/server/spaceweather.ts');
        const ttl = (cache?.body.fallback ? FALLBACK_CACHE_SECONDS : CACHE_SECONDS) * 1000;
        let body;
        if (cache && !process.env.SPACEWEATHER_NO_CACHE && Date.now() - cache.at < ttl) {
          body = { ...cache.body, cached: true };
        } else {
          body = await getSpaceWeather({
            apiKey: process.env.NASA_API_KEY,
            baseUrl: process.env.DONKI_BASE_URL || undefined,
          });
          cache = { at: Date.now(), body };
        }
        res.writeHead(200, responseHeaders(body));
        res.end(JSON.stringify(body));
      });
    },
  };
}

// https://astro.build/config
export default defineConfig({
  integrations: [preact()],
  vite: {
    plugins: [spaceWeatherDevApi()],
    // Three.js (~640 KB) va en su propio archivo y se carga después del menú: no bloquea el primer render.
    build: { chunkSizeWarningLimit: 700 },
  },
});
