import { describe, expect, it } from 'vitest';
import { antennaOn, stormWarning } from './comms';
import { defaultConfig } from './config';
import { createGame } from './engine';
import type { GameState } from './types';

const min = defaultConfig.balance.effects.workshopMinEnergy;
const warn = defaultConfig.balance.events.warningDays;

function stormDay(s: GameState): number {
  return s.scheduledEvents.find((e) => e.kind === 'storm')!.day;
}
function at(day: number, workshop: number, extra: Partial<GameState> = {}): GameState {
  const base = createGame(42, 'cadete');
  return {
    ...base,
    day,
    lastPlan: { recycler: 0, greenhouse: 0, shield: 0, workshop },
    ...extra,
  };
}

describe('antena y aviso de tormenta', () => {
  const d = stormDay(createGame(42, 'cadete'));

  it('con antena avisa de la tormenta dentro de la ventana', () => {
    const w = stormWarning(at(d - 1, min))!;
    expect(w.day).toBe(d);
    expect(w.inDays).toBe(1);
    expect(w.level).toMatch(/^S[1-4]$/);
    expect(stormWarning(at(d - warn, min))!.inDays).toBe(warn);
  });

  it('sin antena no avisa', () => {
    expect(stormWarning(at(d - 1, min - 1))).toBeNull();
    expect(stormWarning(at(d - 1, 0, { lastPlan: null }))).toBeNull();
    expect(antennaOn(at(d - 1, min))).toBe(true);
  });

  it('con el Taller averiado no hay antena', () => {
    const s = at(d - 1, min);
    const broken = { ...s, modules: { ...s.modules, workshop: { broken: true, brokenSinceDay: 1 } } };
    expect(stormWarning(broken)).toBeNull();
  });

  it('fuera de la ventana no avisa (muy pronto, el día de la tormenta o pasada)', () => {
    expect(stormWarning(at(d - warn - 1, min))).toBeNull();
    expect(stormWarning(at(d, min))?.day).not.toBe(d);
    expect(stormWarning(at(d + 1, min))?.day).not.toBe(d);
  });

  it('es determinista y no muta el estado', () => {
    const s = at(d - 1, min);
    const copy = JSON.stringify(s);
    expect(stormWarning(s)).toEqual(stormWarning(s));
    expect(JSON.stringify(s)).toBe(copy);
  });
});
