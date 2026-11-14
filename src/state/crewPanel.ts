// Estado del panel de tripulación: abierto o cerrado, y a quién se miró de cerca.
import { signal } from '@preact/signals';
import type { CrewId } from '../data/crew';

export const crewOpen = signal(false);
/** Tripulante resaltado (la cámara está en su módulo). */
export const crewFocus = signal<CrewId | null>(null);

export function openCrew(): void {
  crewOpen.value = true;
}
export function toggleCrew(): void {
  crewOpen.value = !crewOpen.value;
}
