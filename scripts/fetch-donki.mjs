// Descarga única de tormentas solares reales de NASA DONKI para un año completo y las guarda en
// public/data/storms_real.json. El JSON generado SE SUBE al repo: así el juego funciona sin red.
//
// Uso:   npm run data:donki            (año 2024)
//        npm run data:donki -- 2023
// Clave: NASA_API_KEY en .env (o en el entorno). Nunca se escribe en el JSON.
// Requiere Node 22.18+ (ejecuta TypeScript de src/data/donki.ts sin compilar).

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NORMALIZERS, sortEvents, ymd } from '../src/data/donki.ts';

try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env: se usa la variable del entorno si existe.
}

const API_KEY = process.env.NASA_API_KEY;
const BASE = process.env.DONKI_BASE_URL ?? 'https://api.nasa.gov/DONKI/';
const YEAR = Number(process.argv[2] ?? 2024);
const TYPES = ['FLR', 'CME', 'SEP'];
const CHUNK_DAYS = 30;
const PAUSE_MS = 1000;
const OUT = resolve('public/data/storms_real.json');
/** El juego solo usa tormentas que se notan; las de nivel 1 se cuentan pero no se guardan. */
const MIN_LEVEL = 2;

if (!API_KEY) {
  console.error('Falta NASA_API_KEY. Copia .env.example a .env y pon tu clave de https://api.nasa.gov');
  process.exit(1);
}
if (!Number.isInteger(YEAR) || YEAR < 2010 || YEAR > new Date().getUTCFullYear()) {
  console.error(`Año no válido: ${process.argv[2]}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tramos de 30 días que cubren el año sin solaparse. */
function chunks(year) {
  const list = [];
  const last = new Date(Date.UTC(year, 11, 31));
  for (let start = new Date(Date.UTC(year, 0, 1)); start <= last; ) {
    const end = new Date(Math.min(start.getTime() + (CHUNK_DAYS - 1) * 864e5, last.getTime()));
    list.push([ymd(start), ymd(end)]);
    start = new Date(end.getTime() + 864e5);
  }
  return list;
}

const events = [];
const failures = [];
const okByType = { FLR: 0, CME: 0, SEP: 0 };

for (const [start, end] of chunks(YEAR)) {
  for (const type of TYPES) {
    const url = `${BASE}${type}?startDate=${start}&endDate=${end}&api_key=${encodeURIComponent(API_KEY)}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const found = NORMALIZERS[type](text.trim() === '' ? [] : JSON.parse(text));
      events.push(...found);
      okByType[type]++;
      console.log(`${type} ${start}…${end}: ${found.length}`);
    } catch (error) {
      failures.push({ type, start, end, error: String(error.message ?? error) });
      console.warn(`${type} ${start}…${end}: FALLÓ (${error.message ?? error})`);
    }
    await sleep(PAUSE_MS);
  }
}

const everything = sortEvents(events);
const countsByLevel = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (const e of everything) countsByLevel[e.level]++;
const list = everything.filter((e) => e.level >= MIN_LEVEL);
if (list.length === 0) {
  console.error('No se obtuvo ningún evento. No se escribe el archivo (el juego seguirá con storms_sample.json).');
  process.exit(1);
}

const failedTypes = TYPES.filter((t) => okByType[t] === 0);
await mkdir(resolve('public/data'), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify(
    {
      simulated: false,
      version: 1,
      status: 'verified',
      source: 'NASA DONKI',
      source_id: 'nasa_donki',
      source_url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
      api: 'https://api.nasa.gov (DONKI: FLR, CME, SEP)',
      range: { start: `${YEAR}-01-01`, end: `${YEAR}-12-31` },
      fetched_at: new Date().toISOString(),
      failed_types: failedTypes,
      level_mapping: {
        status: 'game_balance',
        FLR: 'C=1, M=2, X<5=3, X5+=4',
        CME: '<700 km/s=1, 700-1200=2, 1200-2000=3, >2000=4',
        SEP: '3',
      },
      min_level: MIN_LEVEL,
      counts_by_level: countsByLevel,
      count: list.length,
      events: list,
    },
    null,
    2,
  ) + '\n',
);

const byLevel = [1, 2, 3, 4].map((l) => `nivel ${l}: ${countsByLevel[l]}`).join(' · ');
console.log(`\n${everything.length} eventos (${byLevel}); guardados ${list.length} de nivel ≥ ${MIN_LEVEL} → ${OUT}`);
if (failedTypes.length) console.warn(`Tipos sin ningún dato: ${failedTypes.join(', ')}`);
if (failures.length) console.warn(`${failures.length} llamadas fallaron.`);
