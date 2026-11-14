import { describe, expect, it } from 'vitest';
import {
  cmeLevel,
  flareLevel,
  isActive,
  isoDate,
  normalizeCME,
  normalizeFLR,
  normalizeSEP,
  sortEvents,
  strongestEvent,
} from './donki';
import type { SpaceEvent } from './donki';

describe('mapeo de niveles', () => {
  it('fulguraciones: C=1, M=2, X<5=3, X5+=4; A, B y basura → null', () => {
    expect(flareLevel('C3.2')).toBe(1);
    expect(flareLevel('M1.0')).toBe(2);
    expect(flareLevel('X4.9')).toBe(3);
    expect(flareLevel('X5.0')).toBe(4);
    expect(flareLevel('x10')).toBe(4);
    expect(flareLevel('B7.1')).toBeNull();
    expect(flareLevel(null)).toBeNull();
    expect(flareLevel('')).toBeNull();
  });

  it('CME por velocidad', () => {
    expect(cmeLevel(699)).toBe(1);
    expect(cmeLevel(700)).toBe(2);
    expect(cmeLevel(1200)).toBe(2);
    expect(cmeLevel(1201)).toBe(3);
    expect(cmeLevel(2000)).toBe(3);
    expect(cmeLevel(2001)).toBe(4);
    expect(cmeLevel(null)).toBeNull();
    expect(cmeLevel(0)).toBeNull();
  });
});

describe('fechas', () => {
  it('acepta los formatos de DONKI y convierte a UTC', () => {
    expect(isoDate('2024-05-08T05:36Z')).toBe('2024-05-08');
    expect(isoDate('2024-05-08T05:36:00-CME-001')).toBe('2024-05-08');
    expect(isoDate('2024-05-08T23:30:00-05:00')).toBe('2024-05-09');
    expect(isoDate('2024-05-08')).toBe('2024-05-08');
    expect(isoDate('ayer')).toBeNull();
    expect(isoDate(undefined)).toBeNull();
  });
});

describe('normalización', () => {
  it('FLR: usa peakTime o beginTime y descarta clases sin nivel', () => {
    const events = normalizeFLR([
      { flrID: 'f1', classType: 'X1.1', peakTime: '2024-05-10T06:54Z', beginTime: '2024-05-10T06:27Z', link: 'L' },
      { flrID: 'f2', classType: 'M2', peakTime: null, beginTime: '2024-05-11T01:00Z' },
      { flrID: 'f3', classType: null, peakTime: '2024-05-11T01:00Z' },
      { flrID: 'f4', classType: 'B9', peakTime: '2024-05-11T01:00Z' },
    ]);
    expect(events).toEqual([
      { id: 'f1', type: 'FLR', date: '2024-05-10', classOrSpeed: 'X1.1', level: 3, link: 'L' },
      { id: 'f2', type: 'FLR', date: '2024-05-11', classOrSpeed: 'M2', level: 2, link: null },
    ]);
  });

  it('CME: prefiere el análisis más preciso y tolera análisis nulos', () => {
    const events = normalizeCME([
      { activityID: 'c1', startTime: '2024-05-08T05:36Z', cmeAnalyses: [
        { speed: 1500, isMostAccurate: false }, { speed: 870, isMostAccurate: true }] },
      { activityID: 'c2', startTime: '2024-05-09T00:00Z', cmeAnalyses: [{ speed: 2100 }, { speed: null }] },
      { activityID: 'c3', startTime: '2024-05-09T00:00Z', cmeAnalyses: null },
    ]);
    expect(events.map((e) => [e.id, e.level, e.classOrSpeed])).toEqual([
      ['c1', 2, '870 km/s'],
      ['c2', 4, '2100 km/s'],
    ]);
  });

  it('SEP: nivel 3 por defecto', () => {
    expect(normalizeSEP([{ sepID: 's1', eventTime: '2024-05-09T13:59Z' }])[0]).toMatchObject({ level: 3, type: 'SEP' });
  });

  it('entradas vacías o raras no rompen', () => {
    expect(normalizeFLR(null)).toEqual([]);
    expect(normalizeCME({ error: 'x' })).toEqual([]);
    expect(normalizeSEP([null, 3, 'a'])).toEqual([]);
  });
});

describe('resumen', () => {
  const ev = (id: string, date: string, level: 1 | 2 | 3 | 4): SpaceEvent =>
    ({ id, type: 'CME', date, classOrSpeed: null, level, link: null });
  const now = new Date('2026-11-14T12:00:00Z');

  it('activo si hay nivel ≥ 2 en los últimos 7 días', () => {
    expect(isActive([ev('a', '2026-11-08', 2)], now)).toBe(true);
    expect(isActive([ev('a', '2026-11-06', 4)], now)).toBe(false);
    expect(isActive([ev('a', '2026-11-13', 1)], now)).toBe(false);
  });

  it('ordena por fecha, quita duplicados y elige el más fuerte', () => {
    const list = sortEvents([ev('a', '2026-11-01', 2), ev('b', '2026-11-05', 1), ev('a', '2026-11-01', 2), ev('c', '2026-11-03', 3)]);
    expect(list.map((e) => e.id)).toEqual(['b', 'c', 'a']);
    expect(strongestEvent(list)?.id).toBe('c');
    expect(strongestEvent([])).toBeNull();
  });
});
