import { describe, expect, it } from 'vitest';
import { defaultConfig } from './config';
import { createGame, EMPTY_PLAN, runDay } from './engine';
import type { GameState, Plan } from './types';
import { planVerdict } from './verdict';

const FULL: Plan = { recycler: 30, greenhouse: 25, shield: 20, workshop: 0 };
const game = (patch: Partial<GameState> = {}): GameState => ({
  ...createGame(1, 'comandante'),
  scheduledEvents: [],
  ...patch,
});

describe('planVerdict', () => {
  it('seguro cuando nada baja de los umbrales', () => {
    expect(planVerdict(game(), FULL)).toMatchObject({ level: 'safe', reason: null });
  });

  it('los valores coinciden con lo que deja runDay', () => {
    const before = game();
    const v = planVerdict(before, FULL);
    const after = runDay(before, FULL);
    expect(v).toMatchObject({ lifeSupport: after.lifeSupport, food: after.food, battery: after.battery, dose: after.dose });
  });

  it('justo si un recurso termina en 25 o menos', () => {
    expect(planVerdict(game({ food: 30 }), EMPTY_PLAN)).toMatchObject({ level: 'tight', reason: 'food' });
    expect(planVerdict(game({ lifeSupport: 33 }), EMPTY_PLAN)).toMatchObject({ level: 'tight', reason: 'life_support' });
  });

  it('crítico si termina en 10 o menos, y señala el recurso más bajo', () => {
    expect(planVerdict(game({ lifeSupport: 18 }), EMPTY_PLAN)).toMatchObject({ level: 'critical', reason: 'life_support' });
    expect(planVerdict(game({ lifeSupport: 19, food: 8 }), EMPTY_PLAN)).toMatchObject({ level: 'critical', reason: 'food' });
  });

  it('crítico por apagón', () => {
    expect(planVerdict(game({ battery: 0, day: 13 }), EMPTY_PLAN)).toMatchObject({ level: 'critical', reason: 'blackout' });
  });

  it('la dosis avisa al 70 % y al 90 % del límite', () => {
    const limit = defaultConfig.balance.difficulty.comandante.doseLimit;
    expect(planVerdict(game({ dose: limit * 0.7 }), FULL)).toMatchObject({ level: 'tight', reason: 'dose' });
    expect(planVerdict(game({ dose: limit * 0.9 }), FULL)).toMatchObject({ level: 'critical', reason: 'dose' });
  });

  it('informa de la energía que se desperdiciaría', () => {
    const capacity = defaultConfig.balance.difficulty.comandante.batteryCapacity;
    expect(planVerdict(game({ battery: capacity }), EMPTY_PLAN).wasted).toBeGreaterThan(0);
    expect(planVerdict(game(), FULL).wasted).toBe(0);
  });
});
