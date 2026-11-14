// Carga los JSON de /public/data. Se importan de forma estática para que el motor
// funcione igual en el navegador, en Vitest y en scripts de Node.
// Para usar datos reales basta con cambiar los JSON (ver docs/specs/04-datos-nasa.md).
//
// Tormentas: se usa public/data/storms_real.json (eventos reales de NASA DONKI, generado con
// `npm run data:donki`) si existe y es válido; si no, public/data/storms_sample.json (simulado).

import { isSpaceEvent } from '../data/donki.ts';
import balanceJson from '../../public/data/balance.json';
import lightJson from '../../public/data/light_sequence.json';
import sampleJson from '../../public/data/storms_sample.json';
import type { Balance, DataStatus, GameConfig, LightSequence, StormData, StormsFile } from './types';

function assertConfig(balance: Balance, light: LightSequence): void {
  if (light.light.length !== balance.days) {
    throw new Error(`light_sequence.json debe tener ${balance.days} valores`);
  }
  if (light.light.some((v) => v < 0 || v > 1)) {
    throw new Error('light_sequence.json: valores fuera de 0..1');
  }
}

export interface StormSource {
  storms: StormData[];
  status: DataStatus;
  /** 'storms_real' o 'storms_sample'. */
  file: string;
  range?: { start: string; end: string };
}

/** Convierte storms_real.json en tormentas del juego. Devuelve null si no es válido. */
export function parseRealStorms(raw: unknown): StormSource | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const file = raw as { simulated?: unknown; events?: unknown; range?: { start: string; end: string } };
  if (file.simulated !== false || !Array.isArray(file.events)) return null;
  const storms: StormData[] = file.events.filter(isSpaceEvent).map((e) => ({
    id: e.id,
    level: `S${e.level}` as StormData['level'],
    date: e.date,
    classType: e.classOrSpeed,
    link: e.link,
    type: e.type,
    origin: 'real' as const,
  }));
  if (storms.length === 0) return null;
  return { storms, status: 'verified', file: 'storms_real', ...(file.range ? { range: file.range } : {}) };
}

function parseSampleStorms(raw: StormsFile): StormSource {
  const storms = raw.storms.map((s) => ({ ...s, origin: 'sample' as const }));
  if (storms.length === 0) throw new Error('storms_sample.json no tiene tormentas');
  return { storms, status: raw.status, file: 'storms_sample' };
}

/**
 * storms_real.json puede no existir, así que se busca con import.meta.glob (Vite/Vitest).
 * Fuera de Vite (scripts con tsx) glob no existe: allí se usa la muestra salvo que el script
 * pase el archivo real a buildConfig().
 */
function findRealStorms(): unknown {
  // Vite reemplaza solo la llamada directa a import.meta.glob (no se puede comprobar con typeof).
  try {
    const files = import.meta.glob('../../public/data/storms_real.json', { eager: true, import: 'default' });
    return Object.values(files)[0] ?? null;
  } catch {
    return null; // fuera de Vite: import.meta.glob no existe
  }
}

export function buildConfig(realStorms: unknown = findRealStorms()): GameConfig & { stormSource: StormSource } {
  const balance = balanceJson as unknown as Balance;
  const light = lightJson as unknown as LightSequence;
  assertConfig(balance, light);
  const stormSource = parseRealStorms(realStorms) ?? parseSampleStorms(sampleJson as unknown as StormsFile);
  return { balance, light, storms: stormSource.storms, stormSource };
}

export const defaultConfig = buildConfig();
/** De dónde salen las tormentas de la partida, para la ficha "¿De dónde sale este número?". */
export const stormSource = defaultConfig.stormSource;
