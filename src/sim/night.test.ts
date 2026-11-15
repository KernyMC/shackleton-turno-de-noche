import { describe, expect, it } from 'vitest';
import { defaultConfig } from './config';
import { createGame, getEnergyBudget, validatePlan } from './engine';
import { nightInfo, nightRationPlan } from './night';
import type { GameState } from './types';
import { MODULE_IDS } from './types';

const nights = defaultConfig.light.nightDays;
const first = Math.min(...nights);
const last = Math.max(...nights);
const d = defaultConfig.balance.difficulty.cadete;
const game = (patch: Partial<GameState> = {}): GameState => ({ ...createGame(1, 'cadete'), unlocked: [...MODULE_IDS], ...patch });

describe('nightInfo', () => {
  it('lejos de la noche no dice nada', () => {
    expect(nightInfo(game({ day: 1 }))).toBeNull();
    expect(nightInfo(game({ day: last + 1 }))).toBeNull();
  });

  it('avisa cuando la noche entra en los próximos días', () => {
    const ahead = defaultConfig.balance.fastForward.nightLookahead;
    const info = nightInfo(game({ day: first - ahead }));
    expect(info?.phase).toBe('soon');
    expect(info?.daysUntil).toBe(ahead);
    expect(info?.nightTotal).toBe(nights.length);
    expect(nightInfo(game({ day: first - ahead - 1 }))).toBeNull();
  });

  it('de noche cuenta cuál es y cuántas quedan', () => {
    const info = nightInfo(game({ day: first + 1, battery: d.batteryCapacity }));
    expect(info?.phase).toBe('night');
    expect(info?.nightIndex).toBe(2);
    expect(info?.nightsLeft).toBe(nights.length - 1);
  });

  it('la ración deja batería para la base todas las noches que quedan', () => {
    const state = game({ day: first, battery: d.batteryCapacity });
    const info = nightInfo(state)!;
    expect(info.ration).toBeGreaterThan(0);
    // Gastar la ración cada noche, más lo que consume la base, cabe en la batería.
    expect((info.ration + d.baseConsumption) * info.nightsLeft).toBeLessThanOrEqual(state.battery);
  });

  it('sin batería la ración es 0 y nunca negativa', () => {
    expect(nightInfo(game({ day: first, battery: 0 }))?.ration).toBe(0);
    expect(nightInfo(game({ day: last, battery: 3 }))?.ration).toBe(0);
  });
});

describe('nightRationPlan', () => {
  it('reparte la ración entre aire y comida, es válido y no se pasa', () => {
    const state = game({ day: first, battery: d.batteryCapacity });
    const info = nightInfo(state)!;
    const plan = nightRationPlan(state);
    const total = plan.recycler + plan.greenhouse + plan.shield + plan.workshop;
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(info.ration);
    expect(total).toBeLessThanOrEqual(getEnergyBudget(state).available);
    expect(plan.recycler).toBeGreaterThan(0);
    expect(plan.greenhouse).toBeGreaterThan(0);
    expect(plan.shield + plan.workshop).toBe(0);
    expect(validatePlan(state, plan).ok).toBe(true);
  });

  it('un módulo averiado se queda a 0', () => {
    const base = game({ day: first, battery: d.batteryCapacity });
    const state = { ...base, modules: { ...base.modules, greenhouse: { ...base.modules.greenhouse, broken: true } } };
    expect(nightRationPlan(state).greenhouse).toBe(0);
  });

  it('fuera de la noche no propone gasto', () => {
    const plan = nightRationPlan(game({ day: 1 }));
    expect(plan.recycler + plan.greenhouse).toBe(0);
  });
});
