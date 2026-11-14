import { describe, expect, it } from 'vitest';
import { defaultConfig } from './config';
import {
  createGame,
  EMPTY_PLAN,
  getEnergyBudget,
  getEventOptions,
  getLight,
  previewDay,
  resolveEvent,
  runDay,
  setRepairToday,
  validatePlan,
} from './engine';
import { createRng } from './rng';
import { MODULE_IDS } from './types';
import type { GameConfig, GameState, Plan, ScheduledEvent } from './types';

const cmd = defaultConfig.balance.difficulty.comandante;
const FULL: Plan = { recycler: 30, greenhouse: 25, shield: 20, workshop: 15 };

/** Partida de Comandante sin eventos, con los cambios indicados. */
function game(patch: Partial<GameState> = {}, events: ScheduledEvent[] = []): GameState {
  return { ...createGame(1, 'comandante'), unlocked: [...MODULE_IDS], scheduledEvents: events, ...patch };
}
/** Batería necesaria para que el día 1 tenga exactamente `available` de energía. */
const batteryFor = (available: number): number => available - cmd.solarMax * 0.85 + cmd.baseConsumption;

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
    for (const difficulty of ['cadete', 'comandante'] as const) {
      const d = defaultConfig.balance.difficulty[difficulty];
      expect(createGame(1, difficulty)).toMatchObject({
        battery: d.batteryStart,
        lifeSupport: d.lifeSupportStart,
        food: d.foodStart,
        dose: 0,
        day: 1,
        phase: 'planning',
      });
    }
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
    const b = getEnergyBudget(game());
    expect(b.solar).toBeCloseTo(cmd.solarMax * 0.85);
    expect(b.available).toBeCloseTo(cmd.batteryStart + cmd.solarMax * 0.85 - cmd.baseConsumption);
    expect(b.blackout).toBe(false);
  });

  it('fija en 0 y marca apagón cuando el disponible es negativo', () => {
    expect(getEnergyBudget(game({ battery: 0, day: 13 }))).toMatchObject({ available: 0, blackout: true });
  });
});

describe('validatePlan', () => {
  it('acepta un plan dentro de los límites', () => {
    expect(validatePlan(game(), FULL).ok).toBe(true);
  });

  it('acepta un plan que suma exactamente lo disponible', () => {
    expect(validatePlan(game({ battery: batteryFor(90) }), FULL).ok).toBe(true);
  });

  it('rechaza superar el máximo de un módulo', () => {
    expect(validatePlan(game(), { ...EMPTY_PLAN, recycler: 31 }).errors).toContain('plan.error.over_max.recycler');
  });

  it('rechaza superar la energía disponible', () => {
    const poor = game({ battery: 0, day: 13 });
    expect(validatePlan(poor, { ...EMPTY_PLAN, recycler: 1 }).errors).toContain('plan.error.over_budget');
  });

  it('rechaza energía en un módulo averiado', () => {
    const s = game();
    const broken = { ...s, modules: { ...s.modules, shield: { broken: true } } };
    expect(validatePlan(broken, { ...EMPTY_PLAN, shield: 5 }).errors).toContain('plan.error.broken.shield');
  });
});

describe('runDay', () => {
  it('aplica producción, consumo y dosis con todos los módulos al 100 %', () => {
    const before = game();
    const after = runDay(before, FULL);
    expect(after.lifeSupport).toBeCloseTo(before.lifeSupport + 14 - 2 - 10);
    expect(after.food).toBeCloseTo(before.food + 9 - 6);
    expect(after.dose).toBeCloseTo(cmd.doseBaseDaily * 0.4);
    expect(after.day).toBe(2);
    expect(after.history).toHaveLength(1);
    expect(after.lastPlan).toEqual(FULL);
  });

  it('no muta el estado que recibe', () => {
    const before = game();
    const copy = JSON.stringify(before);
    runDay(before, FULL);
    expect(JSON.stringify(before)).toBe(copy);
  });

  it('deja la batería en 0 si el plan gasta todo lo disponible', () => {
    const after = runDay(game({ battery: batteryFor(90) }), FULL);
    expect(after.battery).toBe(0);
    expect(after.history[0]!.wasted).toBe(0);
  });

  it('desperdicia la energía que no cabe en la batería', () => {
    const after = runDay(game({ battery: cmd.batteryCapacity }), EMPTY_PLAN);
    expect(after.battery).toBe(cmd.batteryCapacity);
    expect(after.history[0]!.wasted).toBeCloseTo(cmd.solarMax * 0.85 - cmd.baseConsumption);
    expect(after.log.some((l) => l.key === 'log.wasted')).toBe(true);
  });

  it('en apagón parcial el soporte vital baja 3 extra', () => {
    const after = runDay(game({ battery: 0, day: 13, lifeSupport: 50 }), EMPTY_PLAN);
    expect(after.lifeSupport).toBe(50 - 10 - 3);
    expect(after.history[0]!.blackout).toBe(true);
  });

  it('limita los recursos a 100', () => {
    const after = runDay(game({ lifeSupport: 99, food: 99 }), { ...FULL, greenhouse: 25 });
    expect(after.lifeSupport).toBe(100);
    expect(after.food).toBe(100);
  });

  it('en el refugio el invernadero no produce y la tormenta pega solo el 15 %', () => {
    const before = game({ shelterToday: true, stormToday: 'S2' });
    const after = runDay(before, { ...EMPTY_PLAN, recycler: 30, greenhouse: 25 });
    expect(after.food).toBe(before.food - 6);
    expect(after.lifeSupport).toBe(before.lifeSupport + 14 - 10); // sin gasto de agua del invernadero
    expect(after.dose).toBeCloseTo(cmd.doseBaseDaily + 15 * 0.15);
    expect(after.shelterToday).toBe(false);
    expect(after.stormToday).toBeNull();
  });

  it('sin refugio la tormenta pega completa', () => {
    const after = runDay(game({ stormToday: 'S4' }), EMPTY_PLAN);
    expect(after.dose).toBeCloseTo(cmd.doseBaseDaily + 35);
  });

  it('rechaza un plan inválido y ejecutar con un evento pendiente', () => {
    expect(() => runDay(game(), { ...EMPTY_PLAN, recycler: 99 })).toThrow();
    expect(() => runDay(game({ phase: 'event' }), EMPTY_PLAN)).toThrow();
  });

  it('previewDay coincide con runDay', () => {
    for (const patch of [{}, { battery: 0, day: 13 }, { shelterToday: true, stormToday: 'S3' as const }]) {
      const before = game(patch);
      const plan = validatePlan(before, FULL).ok ? FULL : EMPTY_PLAN;
      const preview = previewDay(before, plan);
      const after = runDay(before, plan);
      expect(after.lifeSupport).toBeCloseTo(before.lifeSupport + preview.lifeSupport);
      expect(after.food).toBeCloseTo(before.food + preview.food);
      expect(after.dose).toBeCloseTo(before.dose + preview.dose);
      expect(after.battery).toBe(preview.battery);
    }
  });
});

describe('derrota y victoria', () => {
  it('soporte vital en 0 → life_support', () => {
    const after = runDay(game({ lifeSupport: 5 }), EMPTY_PLAN);
    expect(after.phase).toBe('ended');
    expect(after.result).toMatchObject({ outcome: 'loss', causes: ['life_support'], day: 1, stars: 0 });
  });

  it('comida en 0 → food', () => {
    expect(runDay(game({ food: 6 }), EMPTY_PLAN).result?.causes).toEqual(['food']);
  });

  it('dosis en el límite → radiation', () => {
    expect(runDay(game({ dose: cmd.doseLimit - 1 }), EMPTY_PLAN).result?.causes).toEqual(['radiation']);
  });

  it('varias causas el mismo día se guardan todas, por prioridad', () => {
    const after = runDay(game({ lifeSupport: 5, food: 3, dose: cmd.doseLimit - 1 }), EMPTY_PLAN);
    expect(after.result?.causes).toEqual(['radiation', 'life_support', 'food']);
  });

  it('terminar el día 30 sin derrota es victoria', () => {
    const after = runDay(game({ day: 30 }), FULL);
    expect(after.phase).toBe('ended');
    expect(after.result).toMatchObject({ outcome: 'win', day: 30 });
  });

  it('una derrota en el día 30 es derrota', () => {
    expect(runDay(game({ day: 30, food: 2 }), EMPTY_PLAN).result?.outcome).toBe('loss');
  });
});

describe('eventos', () => {
  const storm: ScheduledEvent = { day: 2, kind: 'storm', payload: { level: 'S3' } };
  const breakdown: ScheduledEvent = { day: 2, kind: 'breakdown', payload: { module: 'greenhouse' } };
  const ice: ScheduledEvent = { day: 2, kind: 'ice' };
  const toDay2 = (event: ScheduledEvent, patch: Partial<GameState> = {}): GameState =>
    runDay(game(patch, [event]), EMPTY_PLAN);

  it('abre el evento al llegar a su día', () => {
    const s = toDay2(storm);
    expect(s.phase).toBe('event');
    expect(s.pendingEvent?.options.map((o) => o.id)).toEqual(['shelter', 'work']);
  });

  it('tormenta: refugiarse activa el refugio y se aplica una sola vez', () => {
    const s = resolveEvent(toDay2(storm), 'shelter');
    expect(s).toMatchObject({ phase: 'planning', shelterToday: true, stormToday: 'S3', pendingEvent: null });
    expect(() => resolveEvent(s, 'shelter')).toThrow();
  });

  it('tormenta: seguir trabajando recibe la dosis completa', () => {
    const s = runDay(resolveEvent(toDay2(storm), 'work'), EMPTY_PLAN);
    expect(s.dose).toBeCloseTo(cmd.doseBaseDaily * 2 + 25);
  });

  it('avería: rompe el módulo y "reparar hoy" lo arregla al final del día con taller ≥ 10', () => {
    const broken = toDay2(breakdown);
    expect(broken.modules.greenhouse).toEqual({ broken: true, brokenSinceDay: 2 });
    const repaired = runDay(resolveEvent(broken, 'repair'), { ...EMPTY_PLAN, workshop: 10 });
    expect(repaired.modules.greenhouse.broken).toBe(false);
  });

  it('avería: sin energía en el taller la reparación no ocurre', () => {
    const s = runDay(resolveEvent(toDay2(breakdown), 'repair'), EMPTY_PLAN);
    expect(s.modules.greenhouse.broken).toBe(true);
    expect(s.log.some((l) => l.key === 'log.repair.failed')).toBe(true);
  });

  it('avería: se puede reparar en un día posterior', () => {
    const later = runDay(resolveEvent(toDay2(breakdown), 'later'), EMPTY_PLAN);
    const repaired = runDay(setRepairToday(later, 'greenhouse'), { ...EMPTY_PLAN, workshop: 10 });
    expect(repaired.modules.greenhouse.broken).toBe(false);
  });

  it('avería: "reparar hoy" se deshabilita con su razón si no hay energía', () => {
    const event: ScheduledEvent = { day: 13, kind: 'breakdown', payload: { module: 'shield' } };
    const s = runDay(game({ day: 12, battery: 0 }, [event]), EMPTY_PLAN);
    expect(s.pendingEvent?.options[0]).toEqual({ id: 'repair', disabledReason: 'event.reason.workshop_energy' });
    expect(() => resolveEvent(s, 'repair')).toThrow();
  });

  it('avería: si el módulo ya está roto se elige otro', () => {
    const base = game({}, [breakdown]);
    const s = runDay({ ...base, modules: { ...base.modules, greenhouse: { broken: true } } }, EMPTY_PLAN);
    expect(s.pendingEvent?.payload?.module).toBe('shield');
  });

  it('hielo: el rover trae +25 de soporte vital al día siguiente', () => {
    const sent = runDay(resolveEvent(toDay2(ice, { lifeSupport: 50 }), 'send'), { ...EMPTY_PLAN, workshop: 10 });
    expect(sent.pendingEffects).toEqual([{ day: 3, kind: 'rover_water', amount: 25 }]);
    expect(sent.roverAvailable).toBe(false);
    const arrived = runDay(sent, EMPTY_PLAN);
    expect(arrived.lifeSupport).toBe(sent.lifeSupport - 10 + 25);
    expect(arrived.roverAvailable).toBe(true);
  });

  it('hielo: con retraso el agua llega un día después', () => {
    const cfg: GameConfig = {
      ...defaultConfig,
      balance: { ...defaultConfig.balance, roverDelayChance: { cadete: 1, comandante: 1 } },
    };
    const s = runDay(game({}, [ice]), EMPTY_PLAN, cfg);
    const sent = runDay(resolveEvent(s, 'send', cfg), { ...EMPTY_PLAN, workshop: 10 }, cfg);
    expect(sent.pendingEffects[0]?.day).toBe(4);
    expect(sent.log.some((l) => l.key === 'log.rover.delayed')).toBe(true);
  });

  it('hielo: el día 30 no hay tiempo para enviar el rover', () => {
    expect(getEventOptions(game({ day: 30 }), { kind: 'ice' })[0]).toEqual({
      id: 'send',
      disabledReason: 'event.reason.no_time',
    });
  });

  it('aviso de noche: una sola opción y no cambia recursos', () => {
    const s = toDay2({ day: 2, kind: 'night_warning' });
    expect(s.pendingEvent?.options).toEqual([{ id: 'ok' }]);
    const after = resolveEvent(s, 'ok');
    expect(after).toMatchObject({ phase: 'planning', lifeSupport: s.lifeSupport, food: s.food });
  });
});
