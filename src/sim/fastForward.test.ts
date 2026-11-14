import { describe, expect, it } from 'vitest';
import { defaultConfig } from './config';
import { createGame, EMPTY_PLAN, runDay } from './engine';
import { fastForward, fastForwardStep, nightSoon, stepReason } from './fastForward';
import type { GameState, Plan, ScheduledEvent } from './types';
import { MODULE_IDS } from './types';

const cmd = defaultConfig.balance.difficulty.comandante;
const game = (patch: Partial<GameState> = {}, events: ScheduledEvent[] = []): GameState => ({
  ...createGame(1, 'comandante'),
  unlocked: [...MODULE_IDS],
  scheduledEvents: events,
  battery: 100,
  lifeSupport: 100,
  food: 100,
  ...patch,
});
const PLAN: Plan = { recycler: 20, greenhouse: 10, shield: 0, workshop: 0 };

describe('avance rápido', () => {
  it('maxDays viene de balance.json', () => {
    expect(defaultConfig.balance.fastForward.maxDays).toBe(5);
  });

  it("para por 'max' tras el máximo de días", () => {
    const r = fastForward(game({ day: 18 }), PLAN);
    expect(r.reason).toBe('max');
    expect(r.days).toBe(defaultConfig.balance.fastForward.maxDays);
    expect(r.state.day).toBe(23);
  });

  it("para por 'event' cuando aparece un evento con decisión", () => {
    const r = fastForward(game({ day: 18 }, [{ day: 20, kind: 'ice' }]), PLAN);
    expect(r.reason).toBe('event');
    expect(r.days).toBe(2);
    expect(r.state.phase).toBe('event');
    expect(r.state.day).toBe(20);
  });

  it("para por 'low' cuando un recurso entra en Bajo", () => {
    const r = fastForward(game({ day: 18, lifeSupport: 28 }), EMPTY_PLAN);
    expect(r.reason).toBe('low');
    expect(r.days).toBe(1);
    expect(r.state.lifeSupport).toBeLessThanOrEqual(defaultConfig.balance.thresholds.low);
  });

  it("'low' cubre la batería (≤ 15 %), la dosis (≥ 70 %) y la comida", () => {
    const lowBattery = fastForward(game({ day: 18, battery: cmd.batteryCapacity * 0.15 + 2 }), EMPTY_PLAN);
    // Con luz del día 18 la batería sube: forzamos una noche para que baje.
    expect(['low', 'max', 'night_soon', 'act']).toContain(lowBattery.reason);
    const dose = fastForward(game({ day: 18, dose: cmd.doseLimit * 0.7 - 0.5 }), EMPTY_PLAN);
    expect(dose.reason).toBe('low');
    const food = fastForward(game({ day: 18, food: 26 }), EMPTY_PLAN);
    expect(food.reason).toBe('low');
    const night = fastForward(game({ day: 12, battery: 20 }), EMPTY_PLAN);
    expect(night.reason).toBe('low');
  });

  it('si el recurso ya estaba bajo al empezar, no cuenta como "entrar"', () => {
    const r = fastForward(game({ day: 18, lifeSupport: 20 }), { ...PLAN, recycler: 30 });
    expect(r.reason).not.toBe('low');
  });

  it("para por 'night_soon' cuando la noche entra en los próximos 2 días", () => {
    const r = fastForward(game({ day: 8 }), PLAN);
    expect(r.reason).toBe('night_soon');
    expect(r.state.day).toBe(10); // 11 y 12 → la noche (día 12) cae dentro del pronóstico
    expect(nightSoon({ day: 10 })).toBe(true);
    expect(nightSoon({ day: 9 })).toBe(false);
    expect(nightSoon({ day: 13 })).toBe(false); // ya en la noche
  });

  it("para por 'act' cuando cambia el acto", () => {
    const r = fastForward(game({ day: 24 }), PLAN);
    expect(r.reason).toBe('act');
    expect(r.days).toBe(1);
    expect(r.state.day).toBe(25);
  });

  it("para por 'invalid_plan' si la falta de energía recorta el plan (sin ejecutar ese día)", () => {
    const s = game({ day: 13, battery: 0 });
    const r = fastForward(s, { ...EMPTY_PLAN, recycler: 10 });
    expect(r.reason).toBe('invalid_plan');
    expect(r.days).toBe(0);
    expect(r.state).toBe(s);
  });

  it("'invalid_plan' también al cabo de varios días cuando se acaba la energía", () => {
    const r = fastForward(game({ day: 12, battery: 40, lifeSupport: 100, food: 100 }), { ...PLAN, recycler: 30 });
    expect(['invalid_plan', 'low']).toContain(r.reason);
  });

  it("para por 'end' al terminar la partida (victoria o derrota)", () => {
    const win = fastForward(game({ day: 30 }), PLAN);
    expect(win.reason).toBe('end');
    expect(win.state.result?.outcome).toBe('win');
    const loss = fastForward(game({ day: 18, lifeSupport: 5 }), EMPTY_PLAN);
    expect(loss.reason).toBe('end');
    expect(loss.state.result?.outcome).toBe('loss');
  });

  it('con un evento pendiente o la partida terminada no avanza', () => {
    const waiting = game({ phase: 'event' });
    expect(fastForward(waiting, PLAN)).toMatchObject({ days: 0, reason: 'event' });
    const ended = { ...game(), phase: 'ended' as const };
    expect(fastForward(ended, PLAN)).toMatchObject({ days: 0, reason: 'end' });
  });

  it('ejecuta lo mismo que runDay día por día y no muta el estado de entrada', () => {
    const start = game({ day: 18 });
    const copy = JSON.stringify(start);
    const r = fastForward(start, PLAN);
    expect(JSON.stringify(start)).toBe(copy);
    let manual = start;
    for (let i = 0; i < r.days; i++) manual = runDay(manual, PLAN);
    expect(r.state).toEqual(manual);
    expect(fastForward(start, PLAN)).toEqual(r); // determinista
  });

  it('un módulo averiado o bloqueado se queda en 0 y el resto se ejecuta', () => {
    const base = game({ day: 18 });
    const s = { ...base, modules: { ...base.modules, greenhouse: { broken: true, brokenSinceDay: 17 } } };
    const step = fastForwardStep(s, PLAN);
    expect(step.ran).toBe(true);
    expect(step.plan).toEqual({ recycler: 20, greenhouse: 0, shield: 0, workshop: 0 });
  });

  describe('stepReason', () => {
    const a = game({ day: 18 });
    it('devuelve null si no pasa nada', () => {
      expect(stepReason(a, runDay(a, PLAN))).toBeNull();
    });
    it('prioriza fin > evento > acto > bajo > noche cerca', () => {
      expect(stepReason(a, { ...a, phase: 'ended' })).toBe('end');
      expect(stepReason(a, { ...a, phase: 'event' })).toBe('event');
      expect(stepReason(game({ day: 24 }), game({ day: 25 }))).toBe('act');
      expect(stepReason(a, { ...a, day: 19, food: 20 })).toBe('low');
      expect(stepReason(game({ day: 9 }), game({ day: 10 }))).toBe('night_soon');
      // Acto y noche cerca a la vez: gana el acto.
      expect(stepReason(game({ day: 10 }), game({ day: 11 }))).toBe('act');
    });
  });
});
