import { describe, expect, it } from 'vitest';
import { defaultConfig } from './config';
import { breakableModules, scheduleEvents } from './events';
import { computeResult, minMargin } from './scoring';
import { allRecycler, playGame, prudent, randomPlayer } from './strategies';
import type { DaySnapshot, Difficulty } from './types';

const SEEDS = 1000;
const inWindow = (day: number, [from, to]: [number, number]): boolean => day >= from && day <= to;

describe('programación de eventos (1000 semillas)', () => {
  for (const difficulty of ['cadete', 'comandante'] as Difficulty[]) {
    it(`${difficulty}: todos los garantizados, en su ventana y sin choques`, () => {
      const ev = defaultConfig.balance.events;
      const stormCount = defaultConfig.balance.difficulty[difficulty].stormCount;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const events = scheduleEvents(seed, difficulty);
        const days = events.map((e) => e.day);
        expect(new Set(days).size).toBe(days.length);
        expect(days.every((d) => d > 1)).toBe(true);

        const storms = events.filter((e) => e.kind === 'storm');
        expect(storms).toHaveLength(stormCount);
        storms.forEach((s, i) => expect(inWindow(s.day, ev.stormWindows[i]!)).toBe(true));

        const breakdown = events.filter((e) => e.kind === 'breakdown');
        expect(breakdown).toHaveLength(1);
        expect(inWindow(breakdown[0]!.day, ev.breakdownWindow)).toBe(true);
        expect(breakableModules(difficulty)).toContain(breakdown[0]!.payload?.module);

        const ice = events.filter((e) => e.kind === 'ice');
        expect(ice).toHaveLength(1);
        expect(inWindow(ice[0]!.day, ev.iceWindow)).toBe(true);

        expect(events.filter((e) => e.kind === 'night_warning').map((e) => e.day)).toEqual([ev.nightWarningDay]);
      }
    });
  }

  it('en Cadete nunca se avería el reciclador', () => {
    expect(breakableModules('cadete')).not.toContain('recycler');
  });
});

describe('determinismo', () => {
  it('misma semilla y mismas decisiones → partida idéntica', () => {
    expect(playGame(123, 'comandante', prudent)).toEqual(playGame(123, 'comandante', prudent));
    expect(playGame(7, 'cadete', randomPlayer)).toEqual(playGame(7, 'cadete', randomPlayer));
  });

  it('semillas distintas programan eventos distintos', () => {
    const a = JSON.stringify(scheduleEvents(1, 'comandante'));
    expect([2, 3, 4, 5].some((s) => JSON.stringify(scheduleEvents(s, 'comandante')) !== a)).toBe(true);
  });
});

describe('puntuación', () => {
  const snap = (lifeSupport: number, food: number, dose: number): DaySnapshot => ({
    day: 1, battery: 0, lifeSupport, food, dose, solar: 0, wasted: 0, blackout: false, sheltered: false,
    plan: { recycler: 0, greenhouse: 0, shield: 0, workshop: 0 },
  });
  const stars = (history: DaySnapshot[]): number =>
    computeResult({ history, difficulty: 'comandante', day: 30 }, [], defaultConfig).stars;

  it('el margen mínimo cuenta la dosis como 100 − % del límite', () => {
    expect(minMargin([snap(80, 70, 90)], 100)).toBe(10);
    expect(minMargin([snap(80, 12, 0), snap(40, 60, 0)], 100)).toBe(12);
  });

  it('estrellas según el margen mínimo', () => {
    expect(stars([snap(50, 14, 0)])).toBe(1);
    expect(stars([snap(50, 15, 0)])).toBe(2);
    expect(stars([snap(50, 30, 0)])).toBe(3);
  });

  it('una derrota tiene 0 estrellas', () => {
    expect(computeResult({ history: [], difficulty: 'cadete', day: 9 }, ['food'], defaultConfig)).toMatchObject({
      outcome: 'loss', stars: 0, day: 9,
    });
  });
});

describe('balance (1000 partidas por estrategia)', () => {
  const winRate = (difficulty: Difficulty, strategy: typeof prudent): number => {
    let wins = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      if (playGame(seed, difficulty, strategy).result?.outcome === 'win') wins++;
    }
    return wins / SEEDS;
  };

  it('"todo al reciclador" pierde en Comandante entre los días 12 y 18', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const result = playGame(seed, 'comandante', allRecycler).result!;
      expect(result.outcome).toBe('loss');
      expect(inWindow(result.day, [12, 18])).toBe(true);
    }
  });

  it('la jugadora prudente gana ≥ 70 % en Comandante y ≥ 90 % en Cadete', () => {
    expect(winRate('comandante', prudent)).toBeGreaterThanOrEqual(0.7);
    expect(winRate('cadete', prudent)).toBeGreaterThanOrEqual(0.9);
  });

  it('jugar al azar gana ≤ 25 %', () => {
    expect(winRate('comandante', randomPlayer)).toBeLessThanOrEqual(0.25);
    expect(winRate('cadete', randomPlayer)).toBeLessThanOrEqual(0.25);
  });
});
