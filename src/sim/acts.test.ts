import { describe, expect, it } from 'vitest';
import { actGoalStatus, actOf, isUnlocked, maxEnergyFor } from './acts';
import { defaultConfig } from './config';
import { createGame, EMPTY_PLAN, fitPlan, getEnergyBudget, getEventOptions, previewDay, resolveEvent, runDay, setCleanToday, validatePlan } from './engine';
import { prudent } from './strategies';
import type { GameState, Plan, ScheduledEvent } from './types';
import { MODULE_IDS } from './types';

const cmd = defaultConfig.balance.difficulty.comandante;
const game = (patch: Partial<GameState> = {}, events: ScheduledEvent[] = []): GameState => ({
  ...createGame(1, 'comandante'),
  scheduledEvents: events,
  ...patch,
});
const ALL = { unlocked: [...MODULE_IDS] };
const SAFE: Plan = { ...EMPTY_PLAN, recycler: 20, greenhouse: 10 };

describe('actos', () => {
  it('actOf devuelve el acto de cada día', () => {
    const expected: [number, number, string][] = [
      [1, 1, 'llegada'], [5, 1, 'llegada'], [6, 2, 'sol_despierta'], [10, 2, 'sol_despierta'],
      [11, 3, 'noche_larga'], [17, 3, 'noche_larga'], [18, 4, 'amanecer'], [24, 4, 'amanecer'],
      [25, 5, 'cuenta_final'], [30, 5, 'cuenta_final'],
    ];
    for (const [day, id, key] of expected) expect(actOf(day)).toMatchObject({ id, key });
    expect(actOf(11)).toEqual({ id: 3, key: 'noche_larga', from: 11, to: 17 });
  });

  it('los actos cubren los 30 días sin huecos ni solapes', () => {
    const list = defaultConfig.balance.acts.list;
    expect(list[0]!.from).toBe(1);
    expect(list.at(-1)!.to).toBe(defaultConfig.balance.days);
    list.slice(1).forEach((a, i) => expect(a.from).toBe(list[i]!.to + 1));
  });

  it('acto 1: aire y comida ≥ 60 (progreso y cumplido)', () => {
    const ok = actGoalStatus(game({ lifeSupport: 70, food: 65 }));
    expect(ok).toMatchObject({ act: 1, key: 'llegada', value: 65, target: 60, met: true, progress: 1, pending: true });
    const low = actGoalStatus(game({ lifeSupport: 70, food: 30 }));
    expect(low).toMatchObject({ met: false, value: 30 });
    expect(low.progress).toBeCloseTo(0.5);
    expect(low.vars).toMatchObject({ air: 70, food: 30 });
  });

  it('acto 2: batería ≥ 80 % de la capacidad', () => {
    const s = game({ day: 8, battery: cmd.batteryCapacity * 0.8 });
    expect(actGoalStatus(s)).toMatchObject({ act: 2, met: true, value: 80, target: 80 });
    expect(actGoalStatus({ ...s, battery: cmd.batteryCapacity * 0.4 })).toMatchObject({ met: false, value: 40 });
  });

  it('acto 3: ningún apagón en el acto; un apagón deja el progreso en 0', () => {
    const snap = (day: number, blackout: boolean) => ({
      day, battery: 0, lifeSupport: 50, food: 50, dose: 0, solar: 0, wasted: 0, blackout, sheltered: false, plan: EMPTY_PLAN,
    });
    const clean = game({ day: 14, history: [snap(11, false), snap(12, false), snap(13, false)] });
    expect(actGoalStatus(clean)).toMatchObject({ act: 3, met: true });
    expect(actGoalStatus(clean).progress).toBeCloseTo(3 / 7);
    const bad = game({ day: 14, history: [snap(11, false), snap(12, true), snap(13, false)] });
    expect(actGoalStatus(bad)).toMatchObject({ met: false, progress: 0, value: 1 });
    // Un apagón de otro acto no cuenta.
    expect(actGoalStatus(game({ day: 14, history: [snap(9, true)] })).met).toBe(true);
  });

  it('acto 4: aire, comida y batería (%) ≥ 50', () => {
    const s = game({ day: 20, lifeSupport: 80, food: 80, battery: cmd.batteryCapacity * 0.5 });
    expect(actGoalStatus(s)).toMatchObject({ act: 4, met: true, target: 50 });
    expect(actGoalStatus({ ...s, battery: 10 }).met).toBe(false);
  });

  it('al cerrar el acto 1 el motor guarda si se cumplió y lo anota en el log', () => {
    const met = runDay(game({ day: 5, ...ALL, lifeSupport: 90, food: 90 }), SAFE);
    expect(met.actsMet).toEqual([1]);
    expect(met.log.some((l) => l.key === 'log.act.met' && l.type === 'achievement' && l.vars?.act === 1)).toBe(true);

    const missed = runDay(game({ day: 5, ...ALL, lifeSupport: 90, food: 50 }), EMPTY_PLAN);
    expect(missed.actsMet).toEqual([]);
    expect(missed.log.some((l) => l.key === 'log.act.missed' && l.type === 'info')).toBe(true);
    expect(missed.phase).toBe('planning'); // sin castigo
    expect(missed.day).toBe(6);
  });

  it('no se cierra ningún acto a mitad de acto', () => {
    const s = runDay(game({ day: 3, ...ALL }), SAFE);
    expect(s.actsMet).toEqual([]);
    expect(s.log.some((l) => l.key.startsWith('log.act.'))).toBe(false);
  });

  it('acto 5: llegar al día 30 vivo lo cumple; una derrota ese día, no', () => {
    const history = Array.from({ length: 29 }, (_, i) => ({
      day: i + 1, battery: 50, lifeSupport: 50, food: 50, dose: 0, solar: 0, wasted: 0, blackout: false, sheltered: false, plan: EMPTY_PLAN,
    }));
    const won = runDay(game({ day: 30, ...ALL, history, lifeSupport: 90, food: 90 }), SAFE);
    expect(won.result?.outcome).toBe('win');
    expect(won.actsMet).toEqual([5]);
    const lost = runDay(game({ day: 30, ...ALL, history, food: 2 }), EMPTY_PLAN);
    expect(lost.result?.outcome).toBe('loss');
    expect(lost.actsMet).toEqual([]);
  });
});

describe('desbloqueos', () => {
  it('al inicio solo están el reciclador y el invernadero', () => {
    const s = createGame(1, 'comandante');
    expect(s.unlocked).toEqual(['recycler', 'greenhouse']);
    expect(isUnlocked(s, 'recycler')).toBe(true);
    expect(isUnlocked(s, 'workshop')).toBe(false);
    expect(isUnlocked(s, 'shield')).toBe(false);
    expect(maxEnergyFor(s, 'shield')).toBe(0);
    expect(maxEnergyFor(s, 'recycler')).toBe(defaultConfig.balance.modules.recycler.maxEnergy);
  });

  it('un módulo bloqueado no recibe energía: validatePlan, fitPlan y previewDay', () => {
    const s = game();
    expect(validatePlan(s, { ...EMPTY_PLAN, shield: 5 }, defaultConfig).errors).toContain('plan.error.over_max.shield');
    expect(validatePlan(s, { ...EMPTY_PLAN, workshop: 10 }, defaultConfig).ok).toBe(false);
    const fitted = fitPlan(s, { recycler: 10, greenhouse: 10, shield: 20, workshop: 15 }, ['workshop', 'shield', 'recycler', 'greenhouse']);
    expect(fitted).toEqual({ recycler: 10, greenhouse: 10, shield: 0, workshop: 0 });
    // previewDay trata la energía pedida a un módulo bloqueado como 0.
    expect(previewDay(s, { ...EMPTY_PLAN, shield: 20 })).toEqual(previewDay(s, EMPTY_PLAN));
    expect(() => runDay(s, { ...EMPTY_PLAN, shield: 5 })).toThrow();
  });

  it('el Taller (y el rover) se desbloquean al empezar el día 4, con su log', () => {
    const d3 = runDay(game({ day: 2 }), SAFE);
    expect(d3.unlocked).not.toContain('workshop');
    const d4 = runDay(d3, SAFE);
    expect(d4.day).toBe(4);
    expect(d4.unlocked).toContain('workshop');
    expect(d4.log.filter((l) => l.key === 'log.unlock')).toEqual([
      { day: 4, type: 'achievement', key: 'log.unlock', vars: { module: 'workshop' } },
    ]);
    // No se anota dos veces.
    expect(runDay(d4, { ...SAFE, workshop: 0 }).log.filter((l) => l.key === 'log.unlock')).toHaveLength(1);
  });

  it('la primera tormenta desbloquea el blindaje y el refugio funciona', () => {
    const storm: ScheduledEvent = { day: 2, kind: 'storm', payload: { level: 'S2' } };
    const s = runDay(game({}, [storm]), SAFE);
    expect(s.phase).toBe('event');
    expect(s.unlocked).toContain('shield');
    expect(s.log.some((l) => l.key === 'log.unlock' && l.vars?.module === 'shield')).toBe(true);
    expect(s.pendingEvent?.options.map((o) => o.id)).toEqual(['shelter', 'work']);
    const sheltered = resolveEvent(s, 'shelter');
    expect(sheltered.shelterToday).toBe(true);
    // El plan de ese día ya puede usar el blindaje.
    expect(validatePlan(sheltered, { ...EMPTY_PLAN, shield: 10 }, defaultConfig).ok).toBe(true);
  });
});

describe('polvo y cosecha', () => {
  const dust: ScheduledEvent = { day: 2, kind: 'dust' };
  const toDust = (patch: Partial<GameState> = {}): GameState => runDay(game({ ...ALL, ...patch }, [dust]), SAFE);

  it('el polvo reduce la producción solar con dustSolarFactor', () => {
    const clean = game();
    const dirty = game({ dust: true });
    const factor = defaultConfig.balance.effects.dustSolarFactor;
    expect(factor).toBe(0.85);
    const solarClean = getEnergyBudget(clean).solar;
    expect(getEnergyBudget(dirty).solar).toBeCloseTo(solarClean * factor, 1);
    expect(getEnergyBudget(dirty).solar).toBeLessThan(solarClean);
    expect(clean.dust).toBe(false);
  });

  it('el evento activa el polvo y ofrece limpiar o inclinar', () => {
    const s = toDust();
    expect(s.phase).toBe('event');
    expect(s.dust).toBe(true);
    expect(s.pendingEvent?.options).toEqual([{ id: 'clean' }, { id: 'tilt' }]);
    expect(s.log.some((l) => l.key === 'log.dust')).toBe(true);
  });

  it('limpiar con el Taller con energía quita el polvo al cerrar el día', () => {
    const s = resolveEvent(toDust(), 'clean');
    expect(s.cleanToday).toBe(true);
    expect(s.dust).toBe(true); // hoy todavía produce menos
    const after = runDay(s, { ...EMPTY_PLAN, workshop: 10 });
    expect(after.dust).toBe(false);
    expect(after.cleanToday).toBe(false);
    expect(after.log.some((l) => l.key === 'log.dust.cleaned')).toBe(true);
  });

  it('si el Taller no tuvo energía, la limpieza falla y sigue el polvo', () => {
    const after = runDay(resolveEvent(toDust(), 'clean'), EMPTY_PLAN);
    expect(after.dust).toBe(true);
    expect(after.cleanToday).toBe(false);
    expect(after.log.some((l) => l.key === 'log.dust.failed')).toBe(true);
  });

  it('inclinar es gratis, el polvo sigue y se puede limpiar otro día', () => {
    const tilted = resolveEvent(toDust(), 'tilt');
    expect(tilted.cleanToday).toBe(false);
    const next = runDay(tilted, EMPTY_PLAN);
    expect(next.dust).toBe(true);
    const asked = setCleanToday(next, true);
    expect(asked.cleanToday).toBe(true);
    expect(runDay(asked, { ...EMPTY_PLAN, workshop: 10 }).dust).toBe(false);
    expect(setCleanToday(asked, false).cleanToday).toBe(false);
  });

  it('setCleanToday exige polvo y Taller desbloqueado', () => {
    expect(() => setCleanToday(game(ALL), true)).toThrow();
    expect(() => setCleanToday(game({ dust: true }), true)).toThrow(); // taller bloqueado
  });

  it('"limpiar" se deshabilita si el Taller está averiado o no hay energía', () => {
    const s = game({ ...ALL, battery: 0, day: 13 });
    expect(getEventOptions(s, { kind: 'dust' })[0]).toEqual({ id: 'clean', disabledReason: 'event.reason.workshop_energy' });
    const broken = game({ ...ALL, modules: { ...game().modules, workshop: { broken: true } } });
    expect(getEventOptions(broken, { kind: 'dust' })[0]!.disabledReason).toBe('event.reason.workshop_broken');
  });

  it('el día 4 se puede limpiar ese mismo día (Taller desbloqueado al empezar el día 4)', () => {
    for (const difficulty of ['cadete', 'comandante'] as const) {
      for (let seed = 1; seed <= 100; seed++) {
        let s = createGame(seed, difficulty);
        for (let guard = 0; guard < 10 && !(s.phase === 'event' && s.pendingEvent?.kind === 'dust'); guard++) {
          s = s.phase === 'event'
            ? resolveEvent(s, s.pendingEvent!.options.find((o) => !o.disabledReason)!.id)
            : runDay(s, prudent.plan(s, defaultConfig));
        }
        expect(s.day).toBe(4);
        expect(s.pendingEvent?.options[0]).toEqual({ id: 'clean' });
      }
    }
  });

  it('cosecha extra del día 3: suma comida y no necesita decidir', () => {
    const s = runDay(game({ ...ALL, food: 50 }, [{ day: 2, kind: 'harvest' }]), EMPTY_PLAN);
    expect(s.pendingEvent?.options).toEqual([{ id: 'ok' }]);
    const after = resolveEvent(s, 'ok');
    expect(after.food).toBe(s.food + defaultConfig.balance.effects.harvestFood);
    expect(after.log.some((l) => l.key === 'log.harvest')).toBe(true);
  });

  it('GameState nace en versión 2', () => {
    expect(createGame(1, 'cadete').version).toBe(2);
  });
});
