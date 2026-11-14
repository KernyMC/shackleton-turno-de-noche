import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resourceLevels } from '../sim/thresholds';
import { defaultConfig } from '../sim/config';
import { chooseEventOption, executeDay, exitToMenu, game, interact, RESOLVE_MS, setPlanValue, startGame, tabletOpen } from './store';
import { gameMode, startNormal, startTutorial, TUTORIAL_DAYS, TUTORIAL_SEED, tutorialDone } from './mode';
import {
  ackTutorial,
  firstRun,
  onboardingOpen,
  resetTutorial,
  skipTutorial,
  startTutorialWatcher,
  TUTORIAL_MIN,
  tutorialEnd,
  tutorialStep,
  tutorialWarn,
} from './tutorial';

let stop: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  gameMode.value = 'normal';
  resetTutorial();
  onboardingOpen.value = false;
  exitToMenu();
  stop = startTutorialWatcher();
});
afterEach(() => {
  stop();
  vi.useRealTimers();
});

/** Ejecuta el día y deja pasar la animación. */
const pass = (): void => {
  executeDay();
  vi.advanceTimersByTime(RESOLVE_MS);
};

describe('modo Tutorial', () => {
  it('usa Cadete con la semilla fija y empieza con la presentación', () => {
    startTutorial();
    expect(gameMode.value).toBe('tutorial');
    expect(game.value?.seed).toBe(TUTORIAL_SEED);
    expect(game.value?.difficulty).toBe('cadete');
    expect(tutorialStep.value).toBe('welcome');
  });

  it('cada paso avanza con la acción del jugador, del día 1 al final del día 5', () => {
    startTutorial();
    ackTutorial();
    expect(tutorialStep.value).toBe('pick_recycler');
    expect(tabletOpen.value).toBe(true);

    interact('recycler');
    expect(tutorialStep.value).toBe('power_recycler');
    setPlanValue('recycler', TUTORIAL_MIN.recycler - 1);
    expect(tutorialStep.value).toBe('power_recycler');
    setPlanValue('recycler', TUTORIAL_MIN.recycler);
    expect(tutorialStep.value).toBe('greenhouse');
    setPlanValue('greenhouse', TUTORIAL_MIN.greenhouse);
    expect(tutorialStep.value).toBe('execute');
    pass(); // día 2

    expect(game.value?.day).toBe(2);
    expect(tutorialStep.value).toBe('d2_flow');
    ackTutorial();
    expect(tutorialStep.value).toBe('d2_pass');
    pass(); // día 3: cosecha (evento)

    expect(game.value?.phase).toBe('event');
    expect(game.value?.pendingEvent?.kind).toBe('harvest');
    expect(tutorialStep.value).toBe('d3_harvest');
    expect(chooseEventOption('ok')).toBe(true);
    expect(tutorialStep.value).toBe('d3_forecast');
    ackTutorial();
    expect(tutorialStep.value).toBe('d3_pass');
    pass(); // día 4: polvo con dos opciones

    expect(game.value?.pendingEvent?.kind).toBe('dust');
    expect(game.value?.pendingEvent?.options.length).toBe(2);
    expect(tutorialStep.value).toBe('d4_dust');
    expect(chooseEventOption('tilt')).toBe(true);
    expect(tutorialStep.value).toBe('d4_workshop');
    ackTutorial();
    expect(tutorialStep.value).toBe('d4_pass');
    pass(); // día 5

    expect(game.value?.day).toBe(5);
    expect(tutorialStep.value).toBe('d5_goal');
    ackTutorial();
    expect(tutorialStep.value).toBe('d5_pass');
    expect(tutorialEnd.value).toBe(false);
    pass(); // se cierra el día 5: fin del tutorial, sin pasar al acto 2

    expect(tutorialStep.value).toBeNull();
    expect(tutorialEnd.value).toBe(true);
    expect(tutorialDone()).toBe(true);
    expect(game.value?.day).toBe(TUTORIAL_DAYS + 1);
  });

  it('con la semilla fija y una jugada guiada, el acto 1 se cumple y aire y comida no bajan de Bajo', () => {
    startTutorial();
    ackTutorial();
    for (let i = 0; i < 40 && !tutorialEnd.value; i++) {
      const g = game.value!;
      if (g.phase === 'event') chooseEventOption(g.pendingEvent!.options.find((o) => !o.disabledReason)!.id);
      else {
        setPlanValue('recycler', TUTORIAL_MIN.recycler);
        setPlanValue('greenhouse', TUTORIAL_MIN.greenhouse);
        pass();
      }
      expect(tutorialWarn.value).toBeNull();
    }
    expect(tutorialEnd.value).toBe(true);
    const g = game.value!;
    const levels = resourceLevels(g, defaultConfig);
    expect(levels.lifeSupport).toBe(0);
    expect(levels.food).toBe(0);
    // El objetivo del acto 1 se evaluó al cerrar el día 5.
    expect(g.log.some((e) => e.key === 'log.act.met')).toBe(true);
  });

  it('si el jugador se adelanta, la guía lo alcanza (no se queda en un paso viejo)', () => {
    startTutorial();
    ackTutorial();
    setPlanValue('recycler', 30);
    setPlanValue('greenhouse', 25);
    pass();
    expect(tutorialStep.value).toBe('d2_flow');
    pass(); // pasa el día 2 sin pulsar «Entendido»
    expect(tutorialStep.value).toBe('d3_harvest');
  });

  it('si aire o comida bajan, la guía avisa y señala el módulo', () => {
    startTutorial();
    ackTutorial();
    const g = game.value!;
    game.value = { ...g, lifeSupport: 20 };
    expect(tutorialWarn.value).toBe('recycler');
    game.value = { ...g, lifeSupport: 80, food: 20 };
    expect(tutorialWarn.value).toBe('greenhouse');
    game.value = { ...g, lifeSupport: 80, food: 80 };
    expect(tutorialWarn.value).toBeNull();
  });

  it('«Saltar la guía» lleva a la tarjeta final y no se puede volver a la guía', () => {
    startTutorial();
    skipTutorial();
    expect(tutorialStep.value).toBeNull();
    expect(tutorialEnd.value).toBe(true);
    pass();
    expect(tutorialStep.value).toBeNull();
  });

  it('al salir al menú la guía se limpia, y repetir el tutorial vuelve a empezar', () => {
    startTutorial();
    ackTutorial();
    exitToMenu();
    expect(tutorialStep.value).toBeNull();
    startTutorial();
    expect(tutorialStep.value).toBe('welcome');
    skipTutorial();
    startTutorial(); // misma semilla otra vez
    expect(tutorialEnd.value).toBe(false);
    expect(tutorialStep.value).toBe('welcome');
  });

  it('una partida con otra semilla no es el tutorial', () => {
    gameMode.value = 'tutorial';
    startGame('cadete', 99);
    expect(gameMode.value).toBe('normal');
  });
});

describe('modo normal', () => {
  it('sin haber hecho el tutorial, la presentación sale una vez y se puede saltar', () => {
    startNormal('cadete');
    expect(gameMode.value).toBe('normal');
    expect(firstRun.value).toBe(true);
    expect(tutorialStep.value).toBe('welcome');
    skipTutorial();
    expect(tutorialStep.value).toBeNull();
    expect(tutorialEnd.value).toBe(false);
    startNormal('cadete');
    expect(tutorialStep.value).toBeNull();
  });

  it('nunca hay burbujas paso a paso: tocar y jugar no activa ningún paso', () => {
    startNormal('comandante');
    ackTutorial();
    expect(tutorialStep.value).toBeNull();
    interact('recycler');
    setPlanValue('recycler', 30);
    expect(tutorialStep.value).toBeNull();
    pass();
    pass();
    expect(tutorialStep.value).toBeNull();
    expect(tutorialEnd.value).toBe(false);
  });

  it('con el tutorial completado no sale ni la presentación', () => {
    startTutorial();
    skipTutorial();
    startNormal('cadete');
    expect(tutorialStep.value).toBeNull();
  });
});
