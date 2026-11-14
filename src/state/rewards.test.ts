import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '../sim/types';
import { collectHarvest, dayNote, earned, emotionOf, floats, freshEntries, harvest, milestone, moodOfEmotion, planEmotion, startRewardsWatcher, xp } from './rewards';
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

  it('freshEntries devuelve cada entrada una sola vez, aunque se vuelva atrás', () => {
    const met: LogEntry = { day: 5, type: 'achievement', key: 'log.act.met', vars: { act: 1, name: 'llegada' } };
    const unlock: LogEntry = { day: 4, type: 'achievement', key: 'log.unlock', vars: { module: 'workshop' } };
    const other: LogEntry = { day: 4, type: 'info', key: 'log.something' };
    const seen = new Set<string>();
    expect(freshEntries([unlock, other, met], seen, ['log.act.met', 'log.unlock'])).toEqual([unlock, met]);
    expect(freshEntries([unlock, other, met], seen, ['log.act.met', 'log.unlock'])).toEqual([]);
    // Un acto distinto sí es nuevo.
    const met2: LogEntry = { ...met, day: 10, vars: { act: 2, name: 'sol_despierta' } };
    expect(freshEntries([unlock, met, met2], seen, ['log.act.met', 'log.unlock'])).toEqual([met2]);
  });
});

describe('caritas del HUD', () => {
  it('cinco emociones según el ánimo y coherentes con faceOf', () => {
    expect([95, 70, 40, 20, 5].map(emotionOf)).toEqual(['joy', 'happy', 'calm', 'worried', 'scared']);
    expect(moodOfEmotion(emotionOf(51))).toBe('happy');
    expect(moodOfEmotion(emotionOf(26))).toBe('neutral');
    expect(moodOfEmotion(emotionOf(25))).toBe('worried');
  });

  it('el plan que deja el recurso crítico asusta y el bajo preocupa', () => {
    expect(planEmotion('joy', -30, 2)).toBe('scared');
    expect(planEmotion('joy', -30, 1)).toBe('worried');
    expect(planEmotion('scared', -5, 1)).toBe('scared');
  });

  it('un plan bueno sonríe un paso más y nunca deja a nadie peor que tranquilo si el recurso queda bien', () => {
    expect(planEmotion('calm', 8, 0)).toBe('happy');
    expect(planEmotion('happy', 8, 0)).toBe('joy');
    expect(planEmotion('joy', 8, 0)).toBe('joy');
    expect(planEmotion('worried', 8, 0)).toBe('calm');
    expect(planEmotion('happy', -2, 0)).toBe('happy');
  });
});
