import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../sim/config';
import { validatePlan } from '../sim/engine';
import type { GameState } from '../sim/types';
import {
  applyPreset,
  budget,
  chooseEventOption,
  cancelFastForward,
  executeDay,
  ffDays,
  ffStop,
  FF_MS,
  fastForwarding,
  game,
  QUIET_RESOLVE_MS,
  requestClean,
  resolveMs,
  startFastForward,
  plan,
  preview,
  requestRepair,
  resolving,
  RESOLVE_MS,
  restart,
  rewindTo,
  dayStates,
  screen,
  setPlanValue,
  startGame,
  tabletOpen,
  toggleTablet,
} from './store';

const g = (): GameState => game.value!;
/** Ejecuta el día y deja pasar la animación. */
const day = (): void => {
  executeDay();
  vi.advanceTimersByTime(RESOLVE_MS);
};

beforeEach(() => {
  vi.useFakeTimers();
  startGame('comandante', 1);
});
afterEach(() => vi.useRealTimers());

describe('plan', () => {
  it('empieza vacío y con vista previa', () => {
    expect(plan.value).toEqual({ recycler: 0, greenhouse: 0, shield: 0, workshop: 0 });
    expect(preview.value?.battery).toBeGreaterThan(0);
    expect(screen.value).toBe('game');
  });

  it('setPlanValue limita al máximo del módulo', () => {
    expect(setPlanValue('recycler', 999)).toBe(false);
    expect(plan.value.recycler).toBe(defaultConfig.balance.modules.recycler.maxEnergy);
  });

  it('setPlanValue se detiene en la energía disponible y avisa', () => {
    game.value = { ...g(), battery: 0, day: 10 }; // poca energía: 70 × 0,4 − 10 = 18
    expect(Math.floor(budget.value!.available)).toBe(18);
    expect(setPlanValue('recycler', 15)).toBe(false);
    expect(setPlanValue('greenhouse', 20)).toBe(true);
    expect(plan.value).toMatchObject({ recycler: 15, greenhouse: 3 });
    expect(validatePlan(g(), plan.value).ok).toBe(true);
  });

  it('setPlanValue ignora un módulo averiado', () => {
    game.value = { ...g(), modules: { ...g().modules, shield: { broken: true } } };
    setPlanValue('shield', 10);
    expect(plan.value.shield).toBe(0);
  });

  it('presets: ahorro, cero y repetir con ajuste', () => {
    applyPreset('saving');
    expect(plan.value).toEqual({ recycler: 30, greenhouse: 0, shield: 0, workshop: 0 });
    applyPreset('zero');
    expect(plan.value.recycler).toBe(0);

    setPlanValue('recycler', 30);
    setPlanValue('greenhouse', 25);
    day();
    expect(applyPreset('repeat')).toBe(false);
    expect(plan.value).toMatchObject({ recycler: 30, greenhouse: 25 });

    game.value = { ...g(), battery: 0, day: 10 };
    expect(applyPreset('repeat')).toBe(true); // ya no alcanza: prioriza el reciclador
    expect(plan.value).toMatchObject({ recycler: 18, greenhouse: 0 });
  });
});

describe('executeDay', () => {
  it('publica el día nuevo al terminar la animación', () => {
    expect(executeDay()).toBe(true);
    expect(resolving.value).toBe(true);
    expect(g().day).toBe(1);
    vi.advanceTimersByTime(RESOLVE_MS);
    expect(resolving.value).toBe(false);
    expect(g().day).toBe(2);
    expect(plan.value.recycler).toBe(0);
  });

  it('doble llamada avanza un solo día', () => {
    expect(executeDay()).toBe(true);
    expect(executeDay()).toBe(false);
    vi.advanceTimersByTime(RESOLVE_MS * 3);
    expect(g().day).toBe(2);
    expect(g().history).toHaveLength(1);
  });

  it('no se puede ejecutar con un evento pendiente', () => {
    while (g().phase === 'planning') day();
    expect(g().phase).toBe('event');
    expect(executeDay()).toBe(false);
  });
});

describe('eventos', () => {
  const untilEvent = (kind: string): void => {
    for (let i = 0; i < 40 && g().pendingEvent?.kind !== kind; i++) {
      if (g().phase === 'event') chooseEventOption(g().pendingEvent!.options.at(-1)!.id);
      else {
        applyPreset('saving');
        setPlanValue('greenhouse', 25);
        day();
      }
    }
    expect(g().pendingEvent?.kind).toBe(kind);
  };

  it('abre la tablet y no deja cerrarla hasta decidir', () => {
    untilEvent('storm');
    expect(tabletOpen.value).toBe(true);
    toggleTablet();
    expect(tabletOpen.value).toBe(true);
  });

  it('la opción se aplica una sola vez', () => {
    untilEvent('storm');
    expect(chooseEventOption('shelter')).toBe(true);
    expect(chooseEventOption('shelter')).toBe(false);
    expect(g()).toMatchObject({ phase: 'planning', shelterToday: true });
  });

  it('reparar hoy reserva 10 de energía para el taller', () => {
    untilEvent('breakdown');
    const module = g().pendingEvent!.payload!.module as 'greenhouse';
    expect(chooseEventOption('repair')).toBe(true);
    expect(plan.value.workshop).toBe(10);
    day();
    expect(g().modules[module].broken).toBe(false);
  });

  it('se puede pedir la reparación otro día', () => {
    untilEvent('breakdown');
    const module = g().pendingEvent!.payload!.module as 'greenhouse';
    chooseEventOption('later');
    day();
    if (g().phase === 'event') chooseEventOption(g().pendingEvent!.options.at(-1)!.id);
    expect(requestRepair(module)).toBe(true);
    expect(plan.value.workshop).toBe(10);
    day();
    expect(g().modules[module].broken).toBe(false);
  });
});

describe('volver a un día', () => {
  it('restaura el estado del inicio de ese día y permite jugarlo distinto', () => {
    setPlanValue('recycler', 30);
    day();
    const day2 = g();
    day();
    chooseEventOption('ok'); // día 3: cosecha extra
    day();
    expect(g().day).toBe(4);
    expect(dayStates.value.map((s) => s.day)).toEqual([1, 2, 3, 4]);

    expect(rewindTo(2)).toBe(true);
    expect(g()).toEqual(day2);
    expect(dayStates.value.map((s) => s.day)).toEqual([1, 2]);
    expect(plan.value.recycler).toBe(0);

    setPlanValue('greenhouse', 25);
    day();
    expect(g().day).toBe(3);
    expect(g().history[1]!.plan.greenhouse).toBe(25);
  });

  it('desde el debrief vuelve al juego; un día no jugado no existe', () => {
    for (let i = 0; i < 80 && screen.value === 'game'; i++) {
      if (g().phase === 'event') chooseEventOption(g().pendingEvent!.options.at(-1)!.id);
      else day();
    }
    expect(screen.value).toBe('debrief');
    const lostOn = g().result!.day;
    expect(rewindTo(lostOn + 1)).toBe(false);
    expect(rewindTo(Math.max(1, lostOn - 2))).toBe(true);
    expect(screen.value).toBe('game');
    expect(g().result).toBeNull();
  });
});

describe('partida completa', () => {
  it('llega al debrief y se puede reiniciar', () => {
    for (let i = 0; i < 80 && screen.value === 'game'; i++) {
      if (g().phase === 'event') chooseEventOption(g().pendingEvent!.options.at(-1)!.id);
      else day(); // plan vacío: la misión se aborta
    }
    expect(screen.value).toBe('debrief');
    expect(g().result?.outcome).toBe('loss');

    restart();
    expect(screen.value).toBe('game');
    expect(g()).toMatchObject({ day: 1, difficulty: 'comandante', seed: 2 });
  });
});

describe('versión de partida', () => {
  it('startGame crea una partida de versión 2', () => {
    expect(g().version).toBe(2);
    expect(g().unlocked).toEqual(['recycler', 'greenhouse']);
  });
});

describe('ritmo del día', () => {
  it('un día tranquilo se resuelve en QUIET_RESOLVE_MS y uno con tormenta en RESOLVE_MS', () => {
    const quiet = { ...g(), battery: 100, lifeSupport: 90, food: 90 };
    expect(resolveMs(quiet)).toBe(QUIET_RESOLVE_MS);
    expect(QUIET_RESOLVE_MS).toBeLessThan(RESOLVE_MS);
    expect(resolveMs({ ...quiet, stormToday: 'S2' })).toBe(RESOLVE_MS);
    expect(resolveMs({ ...quiet, repairToday: 'greenhouse' })).toBe(RESOLVE_MS);
    expect(resolveMs({ ...quiet, food: 20 })).toBe(RESOLVE_MS);
  });

  it('executeDay publica el estado tras la duración del ritmo', () => {
    game.value = { ...g(), battery: 100, lifeSupport: 90, food: 90 };
    setPlanValue('recycler', 20);
    executeDay();
    vi.advanceTimersByTime(QUIET_RESOLVE_MS - 1);
    expect(g().day).toBe(1);
    vi.advanceTimersByTime(1);
    expect(g().day).toBe(2);
  });
});

describe('avance rápido', () => {
  const safe = (): void => {
    game.value = { ...g(), battery: 100, lifeSupport: 100, food: 100 };
    setPlanValue('recycler', 20);
  };

  it('avanza un día cada FF_MS, publica cada estado y se detiene en el evento', () => {
    safe();
    expect(startFastForward()).toBe(true);
    expect(fastForwarding.value).toBe(true);
    expect(g().day).toBe(2); // el primer día se resuelve al empezar
    expect(ffDays.value).toBe(1);
    vi.advanceTimersByTime(FF_MS);
    expect(g().day).toBe(3);
    expect(g().phase).toBe('event'); // cosecha del día 3
    expect(fastForwarding.value).toBe(false);
    expect(ffStop.value).toEqual({ reason: 'event', day: 3 });
    expect(tabletOpen.value).toBe(true);
    expect(dayStates.value.map((s) => s.day)).toEqual([1, 2, 3]);
  });

  it('no se puede iniciar con un evento pendiente ni con un plan inválido', () => {
    safe();
    startFastForward();
    vi.advanceTimersByTime(FF_MS);
    expect(g().phase).toBe('event');
    expect(startFastForward()).toBe(false);
    chooseEventOption('ok');
    plan.value = { recycler: 0, greenhouse: 0, shield: 99, workshop: 0 };
    expect(startFastForward()).toBe(false);
  });

  it('cancelFastForward lo detiene y los demás controles se bloquean mientras corre', () => {
    safe();
    startFastForward();
    expect(setPlanValue('recycler', 5)).toBe(false);
    expect(applyPreset('saving')).toBe(false);
    expect(executeDay()).toBe(false);
    cancelFastForward();
    expect(fastForwarding.value).toBe(false);
    const day = g().day;
    vi.advanceTimersByTime(FF_MS * 3);
    expect(g().day).toBe(day);
    expect(ffStop.value).toBeNull();
  });

  it('con reducir movimiento es instantáneo', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }), location: { search: '' } });
    try {
      safe();
      expect(startFastForward()).toBe(true);
      expect(fastForwarding.value).toBe(false);
      expect(g().phase).toBe('event');
      expect(ffStop.value?.reason).toBe('event');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('limpiar paneles', () => {
  it('requestClean exige polvo y reserva la energía del Taller', () => {
    expect(requestClean(true)).toBe(false); // sin polvo
    game.value = { ...g(), day: 5, dust: true, unlocked: ['recycler', 'greenhouse', 'workshop'], battery: 100 };
    expect(requestClean(true)).toBe(true);
    expect(g().cleanToday).toBe(true);
    expect(plan.value.workshop).toBe(defaultConfig.balance.effects.workshopMinEnergy);
    expect(requestClean(false)).toBe(true);
    expect(g().cleanToday).toBe(false);
  });
});
