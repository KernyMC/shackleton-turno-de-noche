import { describe, expect, it } from 'vitest';
import { buildConfig, parseRealStorms, stormSource } from './config';
import { createGame } from './engine';
import type { StormData } from './types';

const realFile = {
  simulated: false,
  range: { start: '2024-01-01', end: '2024-12-31' },
  events: [
    { id: 'c1', type: 'CME', date: '2024-05-10', classOrSpeed: '1330 km/s', level: 3, link: 'L' },
    { id: 'bad', type: 'CME', date: 'mayo', level: 9 },
  ],
};

describe('tormentas reales', () => {
  it('convierte storms_real.json y descarta eventos inválidos', () => {
    const src = parseRealStorms(realFile)!;
    expect(src.status).toBe('verified');
    expect(src.storms).toEqual([
      { id: 'c1', level: 'S3', date: '2024-05-10', classType: '1330 km/s', link: 'L', type: 'CME', origin: 'real' },
    ]);
  });

  it('archivo inválido, vacío o marcado como simulado → null', () => {
    expect(parseRealStorms(null)).toBeNull();
    expect(parseRealStorms({ simulated: false, events: [] })).toBeNull();
    expect(parseRealStorms({ ...realFile, simulated: true })).toBeNull();
    expect(parseRealStorms('basura')).toBeNull();
  });

  it('sin archivo real cae a las tormentas de ejemplo', () => {
    const cfg = buildConfig(null);
    expect(cfg.stormSource.file).toBe('storms_sample');
    expect(cfg.storms.every((s) => s.origin === 'sample')).toBe(true);
  });

  it('el juego usa storms_real.json del repo cuando existe', () => {
    expect(stormSource.file).toBe('storms_real');
    expect(stormSource.storms.length).toBeGreaterThan(10);
  });
});

describe('primera tormenta en vivo', () => {
  const live: StormData = { id: 'hoy', level: 'S4', date: '2026-11-12', classType: '2100 km/s', type: 'CME', origin: 'live' };

  it('sustituye solo la primera tormenta y no cambia el resto de la partida', () => {
    const normal = createGame(5, 'comandante').scheduledEvents;
    const withLive = createGame(5, 'comandante', undefined, { firstStorm: live }).scheduledEvents;
    const storms = withLive.filter((e) => e.kind === 'storm');
    expect(storms[0]!.payload).toMatchObject({ id: 'hoy', origin: 'live' });
    expect(withLive.map((e) => [e.day, e.kind])).toEqual(normal.map((e) => [e.day, e.kind]));
    expect(storms.slice(1)).toEqual(normal.filter((e) => e.kind === 'storm').slice(1));
  });
});
