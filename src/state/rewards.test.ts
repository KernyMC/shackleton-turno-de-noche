import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectHarvest, dayNote, earned, floats, harvest, milestone, startRewardsWatcher, xp } from './rewards';
import { executeDay, game, RESOLVE_MS, rewindTo, setPlanValue, startGame } from './store';

let stop: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  startGame('cadete', 21);
  stop = startRewardsWatcher();
});
afterEach(() => {
  stop();
  vi.useRealTimers();
});

const day = (): void => {
  executeDay();
  vi.advanceTimersByTime(RESOLVE_MS);
};

describe('recompensas', () => {
  it('cada día da números por módulo, una frase de la tripulación y XP', () => {
    setPlanValue('recycler', 30);
    setPlanValue('greenhouse', 25);
    day();
    expect(floats.value.map((f) => f.module)).toEqual(['recycler', 'greenhouse']);
    expect(floats.value[0]!.text).toBe('+14');
    expect(dayNote.value).toMatchObject({ day: 1 });
    expect(xp.value).toBe(10);
  });

  it('la cosecha aparece si el invernadero produjo y da el hito una sola vez', () => {
    setPlanValue('greenhouse', 25);
    day();
    expect(harvest.value).not.toBeNull();
    collectHarvest(true);
    expect(harvest.value).toBeNull();
    expect(milestone.value).toBe('first_harvest');
    expect(xp.value).toBe(25);
    setPlanValue('greenhouse', 25);
    day();
    collectHarvest(false);
    expect(earned.value.filter((m) => m === 'first_harvest')).toHaveLength(1);
  });

  it('sin invernadero no hay cosecha', () => {
    setPlanValue('recycler', 30);
    day();
    expect(harvest.value).toBeNull();
  });

  it('volver a un día no repite recompensas', () => {
    day();
    day();
    const before = xp.value;
    rewindTo(1);
    expect(game.value!.day).toBe(1);
    expect(xp.value).toBe(before);
  });
});
