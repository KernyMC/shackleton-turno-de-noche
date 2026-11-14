// Modo de juego: el tutorial (5 días guiados del acto 1, sin perder) o la partida normal.
// El tutorial es una partida en Cadete con una semilla fija; el resto lo cuenta tutorial.ts.
// Los eventos del acto 1 caen en días fijos (cosecha el 3, polvo el 4) con cualquier semilla;
// esta se eligió porque en ella una jugada razonable llega al día 6 con aire y comida sobre 60.
import { signal } from '@preact/signals';
import type { Difficulty } from '../sim/types';
import { challengesEnabled, startGame } from './store';

export type GameMode = 'tutorial' | 'normal';
/** Opciones de la pantalla de tripulación. */
export type MenuMode = 'tutorial' | Difficulty;

export const TUTORIAL_SEED = 4242;
/** Último día del tutorial (fin del acto 1). */
export const TUTORIAL_DAYS = 5;

export const gameMode = signal<GameMode>('normal');
/** Opción elegida en el menú (null = la que toque por defecto). La ayuda puede fijarla en 'tutorial'. */
export const menuMode = signal<MenuMode | null>(null);

const DONE_KEY = 'halosur:tutorial:v1';
let doneMem = false;

/** ¿El jugador ya completó (o saltó) el tutorial alguna vez? */
export function tutorialDone(): boolean {
  if (doneMem) return true;
  try {
    return localStorage.getItem(DONE_KEY) === 'done';
  } catch {
    return false;
  }
}
export function markTutorialDone(): void {
  doneMem = true;
  try {
    localStorage.setItem(DONE_KEY, 'done');
  } catch {
    // Sin almacenamiento, vale el respaldo en memoria.
  }
}
/** Solo para pruebas y para "ver la guía otra vez". */
export function clearTutorialDone(): void {
  doneMem = false;
  try {
    localStorage.removeItem(DONE_KEY);
  } catch {
    // Nada que borrar.
  }
}

/** Empieza el tutorial: Cadete con la semilla fija. */
export function startTutorial(): void {
  gameMode.value = 'tutorial';
  challengesEnabled.value = false;
  startGame('cadete', TUTORIAL_SEED);
}

/** Empieza una partida normal. */
export function startNormal(difficulty: Difficulty): void {
  gameMode.value = 'normal';
  challengesEnabled.value = true;
  startGame(difficulty);
}
