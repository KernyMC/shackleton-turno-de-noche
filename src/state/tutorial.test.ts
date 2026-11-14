import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeDay, exitToMenu, interact, RESOLVE_MS, setPlanValue, startGame, tabletOpen } from './store';
import { ackTutorial, skipTutorial, startTutorialWatcher, TUTORIAL_MIN, tutorialStep } from './tutorial';

let stop: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  exitToMenu();
  stop = startTutorialWatcher();
});
afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe('guía de la primera partida', () => {
  it('avanza sola con cada acción del jugador, del saludo al día 2', () => {
    startGame('cadete', 11);
    expect(tutorialStep.value).toBe('welcome');

    ackTutorial();
    expect(tutorialStep.value).toBe('pick_recycler');
    expect(tabletOpen.value).toBe(true);

    interact('recycler');
    expect(tutorialStep.value).toBe('power_recycler');
    setPlanValue('recycler', TUTORIAL_MIN.recycler - 1);
    expect(tutorialStep.value).toBe('power_recycler');
    setPlanValue('recycler', TUTORIAL_MIN.recycler);
    expect(tutorialStep.value).toBe('pick_greenhouse');

    interact('greenhouse');
    expect(tutorialStep.value).toBe('power_greenhouse');
    setPlanValue('greenhouse', TUTORIAL_MIN.greenhouse);
    expect(tutorialStep.value).toBe('verdict');

    ackTutorial();
    expect(tutorialStep.value).toBe('execute');
    executeDay();
    vi.advanceTimersByTime(RESOLVE_MS);
    expect(tutorialStep.value).toBe('night');

    ackTutorial();
    expect(tutorialStep.value).toBeNull();
  });

  it('se salta varios pasos si el jugador ya los hizo', () => {
    startGame('cadete', 12);
    ackTutorial();
    interact('greenhouse'); // va directo al invernadero: el paso del reciclador sigue esperando
    expect(tutorialStep.value).toBe('pick_recycler');
    interact('recycler');
    setPlanValue('recycler', 30);
    expect(tutorialStep.value).toBe('pick_greenhouse');
  });

  it('se puede saltar y nunca impide jugar', () => {
    startGame('cadete', 13);
    skipTutorial();
    expect(tutorialStep.value).toBeNull();
    expect(executeDay()).toBe(true);
  });

  it('ejecutar el día sin seguir la guía la retira al llegar al día 3', () => {
    startGame('cadete', 14);
    ackTutorial();
    for (let i = 0; i < 2; i++) {
      executeDay();
      vi.advanceTimersByTime(RESOLVE_MS);
    }
    expect(tutorialStep.value).toBeNull();
  });
});
