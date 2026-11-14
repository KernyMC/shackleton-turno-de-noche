import { describe, expect, it } from 'vitest';
import { defaultConfig } from './config';
import { actOf } from './acts';
import { breakableModules, scheduleEvents, stormsForRange } from './events';
import { computeResult, minMargin } from './scoring';
import { allRecycler, playGame, prudent, randomPlayer } from './strategies';
import type { DaySnapshot, Difficulty, StormData } from './types';

const SEEDS = 1000;
const inWindow = (day: number, [from, to]: [number, number]): boolean => day >= from && day <= to;

describe('programación de eventos por actos (1000 semillas × 2 dificultades)', () => {
  const ev = defaultConfig.balance.events;
  const actOfDay = (day: number): number => actOf(day).id;

  for (const difficulty of ['cadete', 'comandante'] as Difficulty[]) {
    it(`${difficulty}: cada evento cae en su ventana y acto, sin choques`, () => {
      const slots = ev.storms.filter((s) => s.levels[difficulty]);
      for (let seed = 1; seed <= SEEDS; seed++) {
        const events = scheduleEvents(seed, difficulty);
        const days = events.map((e) => e.day);
        expect(new Set(days).size).toBe(days.length);
        expect(days.every((d) => d > 1)).toBe(true);

        // Fijos: cosecha, polvo, aviso de noche.
        for (const fixed of ev.fixed) {
          expect(events.filter((e) => e.kind === fixed.kind).map((e) => e.day)).toEqual([fixed.day]);
        }

        const storms = events.filter((e) => e.kind === 'storm');
        expect(storms).toHaveLength(slots.length);
        storms.forEach((s, i) => expect(inWindow(s.day, slots[i]!.window)).toBe(true));

        const breakdowns = events.filter((e) => e.kind === 'breakdown');
        expect(breakdowns.length).toBeGreaterThanOrEqual(1);
        expect(breakdowns.length).toBeLessThanOrEqual(ev.breakdowns.length);
        expect(inWindow(breakdowns[0]!.day, ev.breakdowns[0]!.window)).toBe(true);
        for (const b of breakdowns) expect(breakableModules(difficulty)).toContain(b.payload?.module);
        if (difficulty === 'cadete') expect(breakdowns).toHaveLength(1);

        const ice = events.filter((e) => e.kind === 'ice');
        expect(ice).toHaveLength(1);
        expect(inWindow(ice[0]!.day, ev.iceWindow)).toBe(true);

        // Acto 1: nada negativo salvo el polvo (ni tormentas ni averías).
        for (const e of events.filter((x) => actOfDay(x.day) === 1)) {
          expect(['harvest', 'dust']).toContain(e.kind);
        }
        // Acto 2: primera tormenta y avería; acto 3: hielo; acto 5: la tormenta fuerte.
        expect(storms.filter((s) => actOfDay(s.day) === 2)).toHaveLength(1);
        expect(breakdowns.filter((b) => actOfDay(b.day) === 2)).toHaveLength(1);
        expect(ice.every((e) => actOfDay(e.day) === 3)).toBe(true);
        expect(storms.filter((s) => actOfDay(s.day) === 5)).toHaveLength(1);
        expect(storms.some((s) => actOfDay(s.day) === 4)).toBe(difficulty === 'comandante');
      }
    });
  }

  it('en Comandante la segunda avería (acto 4) ocurre en cerca de la mitad de las semillas', () => {
    let second = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      if (scheduleEvents(seed, 'comandante').filter((e) => e.kind === 'breakdown').length === 2) second++;
    }
    expect(second).toBeGreaterThan(SEEDS * 0.4);
    expect(second).toBeLessThan(SEEDS * 0.6);
  });

  it('las tormentas son eventos reales del catálogo y conservan su nivel', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const e of scheduleEvents(seed, 'comandante').filter((x) => x.kind === 'storm')) {
        const payload = e.payload as { id: string; level: string };
        const source = defaultConfig.storms.find((s) => s.id === payload.id);
        expect(source).toBeDefined();
        expect(payload.level).toBe(source!.level);
      }
    }
  });

  it('stormsForRange: sin tormentas en el rango toma el nivel más cercano sin cambiarlo', () => {
    const mk = (level: 'S1' | 'S2' | 'S3' | 'S4'): StormData => ({ id: level, level, date: null, classType: null });
    expect(stormsForRange([mk('S1'), mk('S2')], [3, 4]).map((s) => s.level)).toEqual(['S2']);
    expect(stormsForRange([mk('S1'), mk('S3'), mk('S4')], [2, 3]).map((s) => s.level)).toEqual(['S3']);
    expect(stormsForRange([mk('S1'), mk('S4')], [2, 2]).map((s) => s.level)).toEqual(['S1']);
  });

  it('la tormenta real de hoy (firstStorm) sustituye a la primera', () => {
    const live: StormData = { id: 'live', level: 'S2', date: null, classType: null, origin: 'live' };
    const events = scheduleEvents(5, 'comandante', defaultConfig, { firstStorm: live });
    expect(events.filter((e) => e.kind === 'storm')[0]!.payload).toMatchObject({ id: 'live' });
    // El resto de la programación no cambia.
    const plain = scheduleEvents(5, 'comandante');
    expect(events.map((e) => e.day)).toEqual(plain.map((e) => e.day));
  });

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

  it('el acto 1 es fácil: la prudente nunca pierde antes del día 6 (en ninguna dificultad)', () => {
    for (const difficulty of ['cadete', 'comandante'] as Difficulty[]) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const result = playGame(seed, difficulty, prudent).result!;
        if (result.outcome === 'loss') expect(result.day).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it('jugar al azar gana ≤ 25 %', () => {
    expect(winRate('comandante', randomPlayer)).toBeLessThanOrEqual(0.25);
    expect(winRate('cadete', randomPlayer)).toBeLessThanOrEqual(0.25);
  });
});
