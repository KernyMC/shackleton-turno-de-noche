// Estado global de la app (signals). La UI y la escena SOLO leen de aquí y llaman a estas acciones.
// Contrato completo: docs/specs/03-interfaz-y-estado.md. Tareas: docs/tasks/C-interfaz.md.

import { signal } from '@preact/signals';
import { createGame } from '../sim/engine';
import type { Difficulty, GameState, ModuleId } from '../sim/types';

export type Screen = 'menu' | 'game';

export const screen = signal<Screen>('menu');
export const game = signal<GameState | null>(null);
/** Módulo frente al que está el jugador (lo escribe la escena, lo lee la UI). */
export const nearModule = signal<ModuleId | null>(null);
/** La tablet de muñeca (planificador) está abierta. */
export const tabletOpen = signal(false);

export function startGame(difficulty: Difficulty, seed: number = Date.now() >>> 0): void {
  game.value = createGame(seed, difficulty);
  tabletOpen.value = false;
  screen.value = 'game';
}

export function exitToMenu(): void {
  screen.value = 'menu';
  tabletOpen.value = false;
}

export function toggleTablet(): void {
  tabletOpen.value = !tabletOpen.value;
}
