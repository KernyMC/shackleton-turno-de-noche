// Guía de la primera partida (público de 7–12 años). El tutorial ES el día 1: un tripulante con
// nombre y cara dice qué tocar, un concepto cada vez, y cada paso avanza solo cuando el jugador
// lo hace. La noche se explica el día 2; tormentas y antena, cuando llegan. Se puede saltar.
// Solo observa el store; no cambia reglas.

import { effect, signal } from '@preact/signals';
import type { ModuleId } from '../sim/types';
import { focusModule, game, plan, screen, tabletOpen } from './store';

export type TutorialStep =
  | 'welcome' // tarjeta de bienvenida
  | 'pick_recycler'
  | 'power_recycler'
  | 'greenhouse' // tocar y dar energía al invernadero en un solo paso
  | 'execute' // mirar el sello y pasar el día
  | 'night'; // día 2: se confirma con un botón

const ORDER: TutorialStep[] = [
  'welcome',
  'pick_recycler',
  'power_recycler',
  'greenhouse',
  'execute',
  'night',
];
/** Pasos que esperan a que el jugador pulse "Entendido". */
const MANUAL: ReadonlySet<TutorialStep> = new Set(['welcome', 'night']);
const STORAGE_KEY = 'halosur:tutorial:v1';
/** Energía mínima que pide la guía para dar un paso por hecho. */
export const TUTORIAL_MIN = { recycler: 20, greenhouse: 15 } as const;

export const tutorialStep = signal<TutorialStep | null>(null);
/** La leyenda "¿Cómo se juega?" está abierta. */
export const helpOpen = signal(false);
/** La presentación de 6 tarjetas se abre otra vez, en modo repaso (desde la ayuda). */
export const onboardingOpen = signal(false);

/** Pistas breves de los días 2 y 3: no bloquean, salen una sola vez cada una. */
export type HintId = 'day2' | 'day3';
export const contextHint = signal<HintId | null>(null);
const HINTS_KEY = 'halosur:tutorial:hints:v1';
const SKIPPED_KEY = 'halosur:tutorial:skipped:v1';
/** Respaldo en memoria por si el almacenamiento está bloqueado. */
const hintsShownMem = new Set<HintId>();
let skippedMem = false;

function hintShown(id: HintId): boolean {
  if (hintsShownMem.has(id)) return true;
  try {
    return (localStorage.getItem(HINTS_KEY) ?? '').split(',').includes(id);
  } catch {
    return false;
  }
}
function markHintShown(id: HintId): void {
  hintsShownMem.add(id);
  try {
    localStorage.setItem(HINTS_KEY, [...hintsShownMem].join(','));
  } catch {
    // Almacenamiento bloqueado: queda el respaldo en memoria.
  }
}
function wasSkipped(): boolean {
  if (skippedMem) return true;
  try {
    return localStorage.getItem(SKIPPED_KEY) === '1';
  } catch {
    return false;
  }
}
function markSkipped(): void {
  skippedMem = true;
  try {
    localStorage.setItem(SKIPPED_KEY, '1');
  } catch {
    // Sin almacenamiento, vale el respaldo en memoria.
  }
}

/** Cierra la pista que se está mostrando (ya quedó anotada como vista). */
export function dismissHint(): void {
  contextHint.value = null;
}

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

/** El jugador confirmó un paso manual (bienvenida o aviso de noche). */
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
  markSkipped();
  finish();
}

/** Vuelve a mostrar la guía en la próxima partida (desde ajustes o la ayuda). */
export function resetTutorial(): void {
  hintsShownMem.clear();
  skippedMem = false;
  contextHint.value = null;
  try {
    localStorage.removeItem(HINTS_KEY);
    localStorage.removeItem(SKIPPED_KEY);
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
    case 'greenhouse':
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
    case 'greenhouse':
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
      if (screen.value !== 'game') {
        lastSeed = null;
        contextHint.value = null;
      }
      return;
    }
    // Partida nueva en el día 1: empieza la guía si nunca se completó.
    if (g.seed !== lastSeed) {
      lastSeed = g.seed;
      contextHint.value = null;
      tutorialStep.value = g.day === 1 && g.history.length === 0 && !seen() ? 'welcome' : null;
      return;
    }
    // Si la partida terminó o se fue muy lejos, la guía se retira sola. El aviso de noche es del
    // día 2: al llegar al 3 le cede el sitio a la pista del pronóstico.
    let step = current;
    if (step && (g.phase === 'ended' || g.day > 3 || (step === 'night' && g.day >= 3))) {
      finish();
      step = null;
    }
    // Pistas de los días 2 y 3, solo cuando la guía ya no está y si no se saltó.
    if (!step) {
      const id: HintId | null = g.phase === 'ended' || wasSkipped() ? null : g.day === 2 ? 'day2' : g.day === 3 ? 'day3' : null;
      const showing = contextHint.peek();
      if (id !== showing) {
        if (id && !hintShown(id)) {
          markHintShown(id);
          contextHint.value = id;
          // El sello del pronóstico vive en el panel: se abre para que la pista tenga algo que señalar.
          if (id === 'day3') tabletOpen.value = true;
        } else if (showing) contextHint.value = null;
      }
    }
    if (!step) return;
    while (step && !MANUAL.has(step) && done(step)) step = next(step);
    if (step !== current) {
      if (step) tutorialStep.value = step;
      else finish();
    }
  });
}
