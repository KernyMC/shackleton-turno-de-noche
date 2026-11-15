// Práctica de minijuegos desde la portada (sin partida). Solo guarda si la lista está abierta.
import { signal } from '@preact/signals';

export const practiceOpen = signal(false);
/** Reto que se está practicando ahora (lo lee la música para elegir pista). */
export const practiceChallenge = signal<string | null>(null);
