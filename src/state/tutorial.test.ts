import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeDay, exitToMenu, interact, RESOLVE_MS, setPlanValue, startGame, tabletOpen } from './store';
import {
  ackTutorial,
  contextHint,
  dismissHint,
  onboardingOpen,
  resetTutorial,
  skipTutorial,
  startTutorialWatcher,
  TUTORIAL_MIN,
  tutorialStep,
} from './tutorial';

let stop: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  resetTutorial();
  onboardingOpen.value = false;
  exitToMenu();
  stop = startTutorialWatcher();
});
afterEach(() => {
  stop();
  vi.useRealTimers();
});

/** Sigue la guía del día 1 y pasa al día 2: queda el aviso de noche. */
function reachNight(): void {
  ackTutorial();
  interact('recycler');
  setPlanValue('recycler', TUTORIAL_MIN.recycler);
  setPlanValue('greenhouse', TUTORIAL_MIN.greenhouse);
  executeDay();
  vi.advanceTimersByTime(RESOLVE_MS);
}

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
    expect(tutorialStep.value).toBe('greenhouse');

    interact('greenhouse');
    expect(tutorialStep.value).toBe('greenhouse');
    setPlanValue('greenhouse', TUTORIAL_MIN.greenhouse);
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
    expect(tutorialStep.value).toBe('greenhouse');
  });

  it('se puede saltar y nunca impide jugar', () => {
    startGame('cadete', 13);
    skipTutorial();
    expect(tutorialStep.value).toBeNull();
    expect(executeDay()).toBe(true);
  });

  it('ejecutar el día sin seguir la guía la retira: el aviso de noche cede en el día 3 y todo en el 4', () => {
    startGame('cadete', 14);
    reachNight(); // día 2
    expect(tutorialStep.value).toBe('night');
    executeDay();
    vi.advanceTimersByTime(RESOLVE_MS); // día 3
    expect(tutorialStep.value).toBeNull();
  });

  it('la presentación se puede reabrir en modo repaso sin tocar el tutorial', () => {
    startGame('cadete', 15);
    expect(onboardingOpen.value).toBe(false);
    onboardingOpen.value = true;
    expect(tutorialStep.value).toBe('welcome');
    onboardingOpen.value = false;
    expect(tutorialStep.value).toBe('welcome');
  });
});

describe('pistas de los días 2 y 3', () => {
  const pass = (): void => {
    executeDay();
    vi.advanceTimersByTime(RESOLVE_MS);
  };

  it('salen una sola vez cada una, tras el aviso de noche, y se cierran con un toque', () => {
    startGame('cadete', 21);
    reachNight(); // día 2: primero habla el aviso de noche
    expect(tutorialStep.value).toBe('night');
    expect(contextHint.value).toBeNull();
    ackTutorial();
    expect(contextHint.value).toBe('day2');
    dismissHint();
    expect(contextHint.value).toBeNull();
    pass(); // día 3
    expect(contextHint.value).toBe('day3');
    dismissHint();
    pass(); // día 4: nada más
    expect(contextHint.value).toBeNull();
  });

  it('no se repiten en otra partida', () => {
    startGame('cadete', 22);
    reachNight();
    ackTutorial();
    expect(contextHint.value).toBe('day2');
    dismissHint();
    exitToMenu();
    startGame('cadete', 23);
    pass();
    expect(contextHint.value).toBeNull();
  });

  it('si el jugador saltó la guía no aparecen', () => {
    startGame('cadete', 24);
    skipTutorial();
    pass();
    expect(contextHint.value).toBeNull();
    pass();
    expect(contextHint.value).toBeNull();
  });
});
