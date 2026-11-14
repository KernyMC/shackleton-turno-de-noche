// Guía del juego (público de 7–12 años). Hay dos usos:
//  - Modo TUTORIAL (mode.ts): 5 días guiados del acto 1. Un tripulante con nombre y cara dice qué
//    tocar, un concepto cada vez, y cada paso avanza solo cuando el jugador lo hace. La guía mira
//    el estado de la partida, así que nunca se queda atrás aunque el jugador se adelante.
//  - Modo NORMAL: sin burbujas. Solo la presentación de 6 tarjetas, una vez, y se puede saltar.
// Solo observa el store; no cambia reglas.

import { effect, signal } from '@preact/signals';
import { resourceLevels } from '../sim/thresholds';
import type { GameState, ModuleId } from '../sim/types';
import { defaultConfig } from '../sim/config';
import { focusModule, game, gameId, plan, screen, tabletOpen } from './store';
import { clearTutorialDone, gameMode, markTutorialDone, TUTORIAL_DAYS, TUTORIAL_SEED, tutorialDone } from './mode';

export type TutorialStep =
  | 'welcome' // presentación (6 tarjetas en normal, 3 en tutorial)
  | 'pick_recycler'
  | 'power_recycler'
  | 'greenhouse' // tocar y dar energía al invernadero en un solo paso
  | 'execute' // mirar el sello y pasar el día 1
  | 'd2_flow' // día 2: Sol, batería y para repartir
  | 'd2_pass'
  | 'd3_harvest' // día 3: cosecha extra (evento con «ok»)
  | 'd3_forecast' // día 3: pronóstico de Sol
  | 'd3_pass'
  | 'd4_dust' // día 4: polvo, dos opciones
  | 'd4_workshop' // día 4: se abrió el Taller
  | 'd4_pass'
  | 'd5_goal' // día 5: la meta del acto
  | 'd5_pass';

const ORDER: TutorialStep[] = [
  'welcome',
  'pick_recycler',
  'power_recycler',
  'greenhouse',
  'execute',
  'd2_flow',
  'd2_pass',
  'd3_harvest',
  'd3_forecast',
  'd3_pass',
  'd4_dust',
  'd4_workshop',
  'd4_pass',
  'd5_goal',
  'd5_pass',
];
/** Pasos que esperan a que el jugador pulse «¡Entendido!». */
const MANUAL: ReadonlySet<TutorialStep> = new Set(['welcome', 'd2_flow', 'd3_forecast', 'd4_workshop', 'd5_goal']);
/** Pasos de la burbuja, en orden (para el texto «paso N de M»). */
export const BUBBLE_STEPS: readonly TutorialStep[] = ORDER.slice(1);
const INTRO_KEY = 'halosur:tutorial:intro:v1';
/** Energía mínima que pide la guía para dar un paso por hecho. */
export const TUTORIAL_MIN = { recycler: 20, greenhouse: 15 } as const;

export const tutorialStep = signal<TutorialStep | null>(null);
/** La leyenda "¿Cómo se juega?" está abierta. */
export const helpOpen = signal(false);
/** La presentación se abre otra vez, en modo repaso (desde la ayuda). */
export const onboardingOpen = signal(false);
/** El tutorial terminó (o se saltó): sale la tarjeta «¡Tutorial completado!». */
export const tutorialEnd = signal(false);
/** Módulo que la guía señala porque aire o comida están en Bajo (solo en el tutorial). */
export const tutorialWarn = signal<ModuleId | null>(null);
/** La guía nunca se completó al empezar esta partida: los primeros días van sin atajos. */
export const firstRun = signal(false);

let introMem = false;
function introSeen(): boolean {
  if (introMem) return true;
  try {
    return localStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}
function markIntroSeen(): void {
  introMem = true;
  try {
    localStorage.setItem(INTRO_KEY, '1');
  } catch {
    // Sin almacenamiento vale el respaldo en memoria.
  }
}

/** ¿La partida en curso es el tutorial? */
export function isTutorial(): boolean {
  return gameMode.peek() === 'tutorial';
}

const idx = (s: TutorialStep): number => ORDER.indexOf(s);
function next(step: TutorialStep): TutorialStep | null {
  return ORDER[idx(step) + 1] ?? null;
}

function completeTutorial(): void {
  tutorialStep.value = null;
  tutorialWarn.value = null;
  tutorialEnd.value = true;
  markTutorialDone();
}

/** El jugador confirmó un paso manual. */
export function ackTutorial(): void {
  const step = tutorialStep.value;
  if (!step || !MANUAL.has(step)) return;
  if (!isTutorial()) {
    markIntroSeen();
    tutorialStep.value = null;
    return;
  }
  const following = next(step);
  if (!following) return completeTutorial();
  tutorialStep.value = following;
  // Tras la presentación se abre el panel para que el primer paso esté a la vista.
  if (step === 'welcome') tabletOpen.value = true;
}

/** Salta la guía. En el tutorial lleva a la tarjeta final; en normal solo cierra la presentación. */
export function skipTutorial(): void {
  if (isTutorial()) return completeTutorial();
  markIntroSeen();
  tutorialStep.value = null;
}

/** Vuelve a mostrar la presentación y marca el tutorial como no completado. */
export function resetTutorial(): void {
  introMem = false;
  tutorialEnd.value = false;
  tutorialWarn.value = null;
  clearTutorialDone();
  try {
    localStorage.removeItem(INTRO_KEY);
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}

/** Módulo que la guía quiere que el jugador toque o ajuste ahora. */
export function tutorialTarget(): ModuleId | null {
  switch (tutorialStep.value) {
    case 'pick_recycler':
    case 'power_recycler':
      return 'recycler';
    case 'greenhouse':
      return 'greenhouse';
    case 'd4_workshop':
      return 'workshop';
    default:
      return null;
  }
}

/** ¿El jugador ya hizo lo que pide este paso? */
function done(step: TutorialStep, g: GameState): boolean {
  switch (step) {
    case 'pick_recycler':
      return tabletOpen.value && focusModule.value === 'recycler';
    case 'power_recycler':
      return plan.value.recycler >= TUTORIAL_MIN.recycler;
    case 'greenhouse':
      return plan.value.greenhouse >= TUTORIAL_MIN.greenhouse;
    case 'execute':
      return g.day > 1;
    case 'd2_pass':
      return g.day > 2;
    case 'd3_harvest':
      return g.phase !== 'event';
    case 'd3_pass':
      return g.day > 3;
    case 'd4_dust':
      return g.phase !== 'event';
    case 'd4_pass':
      return g.day > 4;
    case 'd5_pass':
      return g.day > TUTORIAL_DAYS;
    default:
      return false; // los manuales avanzan con ackTutorial
  }
}

/** Paso mínimo en el que debe estar la guía según el día y la fase: si el jugador se adelanta, la guía lo alcanza. */
function floorFor(g: GameState): TutorialStep | null {
  switch (g.day) {
    case 2:
      return 'd2_flow';
    case 3:
      return g.phase === 'event' ? 'd3_harvest' : 'd3_forecast';
    case 4:
      return g.phase === 'event' ? 'd4_dust' : 'd4_workshop';
    case 5:
      return 'd5_goal';
    default:
      return null;
  }
}

let lastId = -1;

/** Arranca la observación. Se llama una vez al montar la app. Devuelve cómo detenerla. */
export function startTutorialWatcher(): () => void {
  return effect(() => {
    const g = game.value;
    const id = gameId.value;
    // Se leen siempre todos los signals que deciden el avance, para que el efecto quede suscrito
    // a ellos aunque esta pasada termine antes de usarlos.
    const current = tutorialStep.value;
    void plan.value;
    void focusModule.value;
    void tabletOpen.value;
    if (screen.value !== 'game' || !g) {
      if (screen.value !== 'game') {
        lastId = -1;
        if (tutorialStep.peek() !== null) tutorialStep.value = null;
        if (tutorialEnd.peek()) tutorialEnd.value = false;
        if (tutorialWarn.peek() !== null) tutorialWarn.value = null;
      }
      return;
    }
    // Partida nueva: decide qué guía toca.
    if (id !== lastId) {
      lastId = id;
      // El modo tutorial solo vale con su semilla: si la partida es otra (p. ej. «Otra vez»), es normal.
      if (gameMode.peek() === 'tutorial' && g.seed !== TUTORIAL_SEED) gameMode.value = 'normal';
      firstRun.value = !tutorialDone();
      tutorialEnd.value = false;
      tutorialWarn.value = null;
      const fresh = g.day === 1 && g.history.length === 0;
      if (!fresh) tutorialStep.value = null;
      else if (isTutorial()) tutorialStep.value = 'welcome';
      else tutorialStep.value = !tutorialDone() && !introSeen() ? 'welcome' : null;
      return;
    }
    if (!isTutorial()) {
      // En normal no hay pasos: si la partida ya terminó, la presentación se retira.
      if (current && g.phase === 'ended') tutorialStep.value = null;
      return;
    }
    if (tutorialEnd.peek()) return;
    if (g.phase === 'ended' || g.day > TUTORIAL_DAYS) return completeTutorial();
    if (!current) return;

    let step: TutorialStep = current;
    const floor = floorFor(g);
    if (floor && idx(floor) > idx(step)) step = floor;
    while (!MANUAL.has(step) && done(step, g)) {
      const following = next(step);
      if (!following) return completeTutorial();
      step = following;
    }
    // Los pasos que señalan el panel lo necesitan abierto.
    if (step !== current && (step === 'd2_flow' || step === 'd3_forecast' || step === 'd5_goal')) tabletOpen.value = true;
    if (step !== current) tutorialStep.value = step;

    // Red de seguridad: en el tutorial no se puede perder; si aire o comida bajan, la guía avisa.
    const levels = resourceLevels(g, defaultConfig);
    const warn: ModuleId | null = levels.lifeSupport > 0 ? 'recycler' : levels.food > 0 ? 'greenhouse' : null;
    if (warn !== tutorialWarn.peek()) tutorialWarn.value = warn;
  });
}
