// Descarga datos reales de NASA y los guarda en /public/data. El juego NUNCA llama a la API:
// solo lee los JSON generados aquí. Uso: npm run fetch:nasa
// Spec: docs/specs/04-datos-nasa.md. Tarea: D-01.
//
// Fuente: NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information),
// servicio de fulguraciones solares (FLR) a través de api.nasa.gov.

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env se usa DEMO_KEY (límite bajo de peticiones, suficiente para una descarga).
}

const API_KEY = process.env.NASA_API_KEY ?? 'DEMO_KEY';
const START = process.env.NASA_START ?? '2024-01-01';
const END = process.env.NASA_END ?? '2024-12-31';
const OUT = resolve('public/data/storms.json');

interface DonkiFlare {
  flrID: string;
  beginTime: string;
  peakTime: string | null;
  classType: string | null;
  sourceLocation: string | null;
  link: string | null;
}

type StormLevel = 'S1' | 'S2' | 'S3' | 'S4';

/**
 * DECISIÓN DE DISEÑO (game_balance), NO es ciencia: la clase de rayos X de una fulguración
 * no equivale a la escala S de NOAA (que mide protones). Usamos la clase solo para ordenar
 * eventos reales por intensidad dentro del juego. La fecha y la clase sí son datos reales.
 */
function toLevel(classType: string): StormLevel | null {
  const match = /^([MX])(\d+(?:\.\d+)?)/.exec(classType);
  if (!match) return null;
  const magnitude = Number(match[2]);
  if (match[1] === 'M') return magnitude >= 5 ? 'S1' : null;
  if (magnitude >= 8) return 'S4';
  if (magnitude >= 4) return 'S3';
  return 'S2';
}

const url = `https://api.nasa.gov/DONKI/FLR?startDate=${START}&endDate=${END}&api_key=${API_KEY}`;
const response = await fetch(url);
if (!response.ok) {
  console.error(`DONKI respondió ${response.status} ${response.statusText}`);
  process.exit(1);
}
const flares = (await response.json()) as DonkiFlare[];

const storms = flares.flatMap((f) => {
  const level = f.classType ? toLevel(f.classType) : null;
  if (!level) return [];
  return [
    {
      id: f.flrID,
      date: (f.peakTime ?? f.beginTime).slice(0, 10),
      classType: f.classType,
      level,
      sourceLocation: f.sourceLocation,
      link: f.link,
    },
  ];
});

await mkdir(resolve('public/data'), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify(
    {
      simulated: false,
      version: 1,
      status: 'verified',
      source_id: 'nasa_donki_flr',
      source: 'NASA DONKI — Solar Flare (FLR)',
      source_url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/',
      range: { start: START, end: END },
      fetched_at: new Date().toISOString(),
      level_mapping: { status: 'game_balance', note: 'M5+ → S1, X<4 → S2, X4–X7.9 → S3, X8+ → S4' },
      storms,
    },
    null,
    2,
  ) + '\n',
);
console.log(`${storms.length} tormentas (de ${flares.length} fulguraciones) → ${OUT}`);
