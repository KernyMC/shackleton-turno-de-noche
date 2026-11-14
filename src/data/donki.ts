// Normalización de NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information).
// Compartido por el proxy (/functions/api/spaceweather.ts), el script de descarga
// (scripts/fetch-donki.mjs) y el juego. Puro: sin red, sin DOM.
// IMPORTANTE: solo TypeScript "borrable" (sin enum ni namespace) e imports con extensión .ts, para que
// Node pueda ejecutarlo directamente desde scripts/fetch-donki.mjs.
//
// Mapeo a nivel de juego (DECISIÓN DE DISEÑO, ver DECISIONES.md; no es una escala científica):
//   Fulguración (FLR) por clase de rayos X: C = 1, M = 2, X < 5 = 3, X5+ = 4. A y B se ignoran.
//   Eyección de masa coronal (CME) por velocidad: < 700 km/s = 1, 700–1200 = 2, 1200–2000 = 3, > 2000 = 4.
//   Evento de partículas energéticas (SEP): 3 por defecto.

export type DonkiType = 'FLR' | 'CME' | 'SEP';
export type GameLevel = 1 | 2 | 3 | 4;

export interface SpaceEvent {
  id: string;
  type: DonkiType;
  /** Fecha UTC AAAA-MM-DD. */
  date: string;
  /** Clase de la fulguración ("X1.2"), velocidad de la CME ("1330 km/s") o null. */
  classOrSpeed: string | null;
  level: GameLevel;
  link: string | null;
}

export interface SpaceWeather {
  fetchedAt: string;
  /** Hubo algún evento de nivel ≥ 2 en los últimos 7 días. */
  active: boolean;
  events: SpaceEvent[];
  /** true si no se pudo obtener ningún dato de DONKI. */
  fallback?: boolean;
  /** Tipos que fallaron en esta consulta (los demás sí respondieron). */
  failed?: DonkiType[];
  /** La respuesta salió de la caché del servidor. */
  cached?: boolean;
}

export const ACTIVE_WINDOW_DAYS = 7;
export const SEP_DEFAULT_LEVEL: GameLevel = 3;

/** Nivel de una fulguración a partir de su clase ("M2.5", "X10"). Null si no aplica. */
export function flareLevel(classType: unknown): GameLevel | null {
  if (typeof classType !== 'string') return null;
  const match = /^\s*([ABCMX])\s*(\d+(?:\.\d+)?)?/i.exec(classType);
  if (!match) return null;
  const letter = match[1]!.toUpperCase();
  const magnitude = match[2] ? Number(match[2]) : 1;
  if (letter === 'C') return 1;
  if (letter === 'M') return 2;
  if (letter === 'X') return magnitude >= 5 ? 4 : 3;
  return null;
}

/** Nivel de una CME a partir de su velocidad en km/s. Null si no hay velocidad válida. */
export function cmeLevel(speed: unknown): GameLevel | null {
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed <= 0) return null;
  if (speed < 700) return 1;
  if (speed <= 1200) return 2;
  if (speed <= 2000) return 3;
  return 4;
}

/**
 * Convierte una fecha de DONKI a AAAA-MM-DD en UTC. Acepta "2024-05-08T05:36Z",
 * "2024-05-08T05:36:00-CME-001" (inicio de un activityID), offsets "+00:00" y fechas solas.
 */
export function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const head = /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?/.exec(value.trim());
  if (!head) return null;
  const [, day, time, zone] = head;
  if (!time) return day!;
  const parsed = new Date(`${day}${time}${zone ?? 'Z'}`);
  return Number.isNaN(parsed.getTime()) ? day! : parsed.toISOString().slice(0, 10);
}

type Raw = Record<string, unknown>;
const asRecords = (raw: unknown): Raw[] =>
  Array.isArray(raw) ? raw.filter((r): r is Raw => typeof r === 'object' && r !== null) : [];
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

export function normalizeFLR(raw: unknown): SpaceEvent[] {
  return asRecords(raw).flatMap((r) => {
    const level = flareLevel(r.classType);
    const date = isoDate(r.peakTime) ?? isoDate(r.beginTime);
    const id = str(r.flrID);
    if (!level || !date || !id) return [];
    return [{ id, type: 'FLR' as const, date, classOrSpeed: str(r.classType), level, link: str(r.link) }];
  });
}

/** Velocidad de una CME: la del análisis marcado como más preciso; si no, la mayor disponible. */
function cmeSpeed(r: Raw): number | null {
  const analyses = asRecords(r.cmeAnalyses);
  const speeds = (list: Raw[]): number[] =>
    list.map((a) => a.speed).filter((s): s is number => typeof s === 'number' && Number.isFinite(s) && s > 0);
  const best = speeds(analyses.filter((a) => a.isMostAccurate === true));
  if (best.length > 0) return Math.max(...best);
  const all = speeds(analyses);
  return all.length > 0 ? Math.max(...all) : null;
}

export function normalizeCME(raw: unknown): SpaceEvent[] {
  return asRecords(raw).flatMap((r) => {
    const speed = cmeSpeed(r);
    const level = cmeLevel(speed);
    const date = isoDate(r.startTime) ?? isoDate(r.activityID);
    const id = str(r.activityID);
    if (!level || !date || !id) return [];
    return [{ id, type: 'CME' as const, date, classOrSpeed: `${Math.round(speed!)} km/s`, level, link: str(r.link) }];
  });
}

export function normalizeSEP(raw: unknown): SpaceEvent[] {
  return asRecords(raw).flatMap((r) => {
    const date = isoDate(r.eventTime) ?? isoDate(r.sepID);
    const id = str(r.sepID);
    if (!date || !id) return [];
    return [{ id, type: 'SEP' as const, date, classOrSpeed: null, level: SEP_DEFAULT_LEVEL, link: str(r.link) }];
  });
}

export const NORMALIZERS: Record<DonkiType, (raw: unknown) => SpaceEvent[]> = {
  FLR: normalizeFLR,
  CME: normalizeCME,
  SEP: normalizeSEP,
};

/** Más reciente primero; a igual fecha, más fuerte primero. Sin duplicados por id. */
export function sortEvents(events: SpaceEvent[]): SpaceEvent[] {
  const unique = new Map(events.map((e) => [e.id, e]));
  return [...unique.values()].sort((a, b) => b.date.localeCompare(a.date) || b.level - a.level);
}

/** ¿Hubo algún evento de nivel ≥ 2 en los últimos `ACTIVE_WINDOW_DAYS` días? */
export function isActive(events: SpaceEvent[], now: Date): boolean {
  const since = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
  return events.some((e) => e.level >= 2 && e.date >= since);
}

/** El evento más fuerte (a igual nivel, el más reciente). */
export function strongestEvent(events: SpaceEvent[]): SpaceEvent | null {
  let best: SpaceEvent | null = null;
  for (const e of events) {
    if (!best || e.level > best.level || (e.level === best.level && e.date > best.date)) best = e;
  }
  return best;
}

/** Valida un objeto que dice ser un SpaceEvent (para JSON descargados o recibidos). */
export function isSpaceEvent(v: unknown): v is SpaceEvent {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Raw;
  return (
    typeof e.id === 'string' &&
    (e.type === 'FLR' || e.type === 'CME' || e.type === 'SEP') &&
    typeof e.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    (e.level === 1 || e.level === 2 || e.level === 3 || e.level === 4)
  );
}

export const ymd = (d: Date): string => d.toISOString().slice(0, 10);
