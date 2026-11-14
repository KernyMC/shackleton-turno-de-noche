import { describe, expect, it } from 'vitest';
import { createGame, EMPTY_PLAN, getEnergyBudget, getLight, validatePlan } from './engine';
import { createRng } from './rng';

describe('rng', () => {
  it('es determinista con la misma semilla', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('int respeta los límites', () => {
    const r = createRng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.int(5, 8);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(8);
    }
  });
});

describe('createGame', () => {
  it('respeta los valores iniciales por dificultad', () => {
    expect(createGame(1, 'cadete')).toMatchObject({ battery: 90, lifeSupport: 85, food: 70, day: 1 });
    expect(createGame(1, 'comandante')).toMatchObject({ battery: 70, lifeSupport: 75, food: 60 });
  });
});

describe('getLight', () => {
  it('suma el bono de noche solo en Cadete', () => {
    expect(getLight(13, 'comandante')).toBe(0);
    expect(getLight(13, 'cadete')).toBeCloseTo(0.05);
    expect(getLight(1, 'cadete')).toBe(0.85);
  });
});

describe('getEnergyBudget', () => {
  it('calcula batería + solar − base', () => {
    const b = getEnergyBudget(createGame(1, 'comandante'));
    expect(b.solar).toBeCloseTo(51);
    expect(b.available).toBeCloseTo(70 + 51 - 10);
    expect(b.blackout).toBe(false);
  });

  it('fija en 0 y marca apagón cuando el disponible es negativo', () => {
    const s = { ...createGame(1, 'comandante'), battery: 0, day: 13 };
    expect(getEnergyBudget(s)).toMatchObject({ available: 0, blackout: true });
  });
});

describe('validatePlan', () => {
  const state = createGame(1, 'comandante');

  it('acepta un plan dentro de los límites', () => {
    expect(validatePlan(state, { recycler: 30, greenhouse: 25, shield: 20, workshop: 15 }).ok).toBe(true);
  });

  it('rechaza superar el máximo de un módulo', () => {
    expect(validatePlan(state, { ...EMPTY_PLAN, recycler: 31 }).errors).toContain(
      'plan.error.over_max.recycler',
    );
  });

  it('rechaza superar la energía disponible', () => {
    const poor = { ...state, battery: 0, day: 13 };
    expect(validatePlan(poor, { ...EMPTY_PLAN, recycler: 1 }).errors).toContain('plan.error.over_budget');
  });

  it('rechaza energía en un módulo averiado', () => {
    const broken = { ...state, modules: { ...state.modules, shield: { broken: true } } };
    expect(validatePlan(broken, { ...EMPTY_PLAN, shield: 5 }).errors).toContain('plan.error.broken.shield');
  });
});
