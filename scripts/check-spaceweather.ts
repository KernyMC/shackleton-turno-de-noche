// Comprueba el proxy de clima espacial en tres situaciones reales. Uso: npm run check:nasa
//   1. API funcionando (clave de .env, DONKI real)
//   2. API caída (ruta de DONKI inexistente → 404)
//   3. Sin internet (servidor inalcanzable → error de conexión)
// En los tres casos la respuesta debe ser un JSON válido y nunca debe contener la clave.

import { getSpaceWeather } from '../src/server/spaceweather.ts';

try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env el caso 1 también acaba en respaldo.
}
const apiKey = process.env.NASA_API_KEY;

const cases = [
  { name: '1. API funcionando', baseUrl: undefined },
  { name: '2. API caída (404)', baseUrl: 'https://api.nasa.gov/DONKI-NO-EXISTE/' },
  { name: '3. Sin internet', baseUrl: 'http://127.0.0.1:9/' },
];

for (const c of cases) {
  const started = Date.now();
  const body = await getSpaceWeather({ apiKey, baseUrl: c.baseUrl });
  const text = JSON.stringify(body);
  console.log(`\n${c.name} — ${Date.now() - started} ms`);
  console.log({
    active: body.active,
    fallback: body.fallback ?? false,
    failed: body.failed ?? [],
    eventos: body.events.length,
    másReciente: body.events[0] ? `${body.events[0].type} ${body.events[0].date} nivel ${body.events[0].level}` : '-',
    contieneClave: apiKey ? text.includes(apiKey) : false,
  });
}
