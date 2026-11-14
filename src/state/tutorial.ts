// Guía de la primera partida. El tutorial ES el día 1: Control de Misión dice qué tocar y cada
// paso avanza solo cuando el jugador lo hace. Nunca bloquea el juego y se puede saltar.
// Solo observa el store; no cambia reglas.

import { effect, signal } from '@preact/signals';
import type { ModuleId } from '../sim/types';
import { focusModule, game, plan, screen, tabletOpen } from './store';

export type TutorialStep =
  | 'welcome' // tarjeta de bienvenida
  | 'pick_recycler'
  | 'power_recycler'
  | 'pick_greenhouse'
  | 'power_greenhouse'
  | 'verdict' // se confirma con un botón
  | 'execute'
  | 'night'; // día 2: se confirma con un botón

const ORDER: TutorialStep[] = [
  'welcome',
  'pick_recycler',
  'power_recycler',
  'pick_greenhouse',
  'power_greenhouse',
  'verdict',
  'execute',
  'night',
];
/** Pasos que esperan a que el jugador pulse "Entendido". */
const MANUAL: ReadonlySet<TutorialStep> = new Set(['welcome', 'verdict', 'night']);
const STORAGE_KEY = 'halosur:tutorial:v1';
/** Energía mínima que pide la guía para dar un paso por hecho. */
export const TUTORIAL_MIN = { recycler: 20, greenhouse: 15 } as const;

export const tutorialStep = signal<TutorialStep | null>(null);
/** La leyenda "¿Cómo se juega?" está abierta. */
export const helpOpen = signal(false);

function seen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'done';
  } catch {
    return false; // sin almacenamiento, la guía se muestra cada vez
  }
}
function markSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'done');
  } catch {
    // Almacenamiento bloqueado: no pasa nada.
  }
}

function next(step: TutorialStep): TutorialStep | null {
  return ORDER[ORDER.indexOf(step) + 1] ?? null;
}

function finish(): void {
  tutorialStep.value = null;
  markSeen();
}

/** El jugador confirmó un paso manual (bienvenida, veredicto, aviso de noche). */
export function ackTutorial(): void {
  const step = tutorialStep.value;
  if (!step || !MANUAL.has(step)) return;
  const following = next(step);
  if (!following) return finish();
  tutorialStep.value = following;
  // Tras la bienvenida se abre el panel para que el primer paso esté a la vista.
  if (step === 'welcome') tabletOpen.value = true;
}

export function skipTutorial(): void {
  finish();
}

/** Vuelve a mostrar la guía en la próxima partida (desde ajustes o la ayuda). */
export function resetTutorial(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
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
    case 'pick_greenhouse':
    case 'power_greenhouse':
      return 'greenhouse';
    default:
      return null;
  }
}

/** ¿El jugador ya hizo lo que pide este paso? */
function done(step: TutorialStep): boolean {
  const g = game.value;
  if (!g) return false;
  switch (step) {
    case 'pick_recycler':
      return tabletOpen.value && focusModule.value === 'recycler';
    case 'power_recycler':
      return plan.value.recycler >= TUTORIAL_MIN.recycler;
    case 'pick_greenhouse':
      return focusModule.value === 'greenhouse';
    case 'power_greenhouse':
      return plan.value.greenhouse >= TUTORIAL_MIN.greenhouse;
    case 'execute':
      return g.day > 1;
    default:
      return false; // los manuales avanzan con ackTutorial
  }
}

let lastSeed: number | null = null;

/** Arranca la observación. Se llama una vez al montar la app. Devuelve cómo detenerla. */
export function startTutorialWatcher(): () => void {
  return effect(() => {
    const g = game.value;
    // Se leen siempre todos los signals que deciden el avance, para que el efecto quede suscrito
    // a ellos aunque esta pasada termine antes de usarlos.
    const current = tutorialStep.value;
    void plan.value;
    void focusModule.value;
    void tabletOpen.value;
    if (screen.value !== 'game' || !g) {
      if (screen.value !== 'game') lastSeed = null;
      return;
    }
    // Partida nueva en el día 1: empieza la guía si nunca se completó.
    if (g.seed !== lastSeed) {
      lastSeed = g.seed;
      tutorialStep.value = g.day === 1 && g.history.length === 0 && !seen() ? 'welcome' : null;
      return;
    }
    // Si la partida terminó o se fue muy lejos, la guía se retira sola.
    if (current && (g.phase === 'ended' || g.day > 2)) return finish();

    let step = current;
    while (step && !MANUAL.has(step) && done(step)) step = next(step);
    if (step !== current) {
      if (step) tutorialStep.value = step;
      else finish();
    }
  });
}
