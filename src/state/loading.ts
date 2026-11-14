// Pantalla de carga entre pantallas: sabe qué pantalla ya tiene su maqueta 3D dibujada.
// La escena (Scene, Menu) avisa cuando ha pintado sus primeros fotogramas; la UI (Loader) solo lo lee.
import { signal } from '@preact/signals';
import type { Screen } from './store';

/** Pantalla cuya escena ya está lista para verse (null mientras carga o sin escena montada). */
export const readyScreen = signal<Screen | null>(null);

/** Marca la pantalla como lista tras dos fotogramas, para que el lienzo ya muestre algo. */
export function markReady(target: Screen): () => void {
  let raf = 0;
  if (typeof requestAnimationFrame === 'undefined') {
    readyScreen.value = target;
    return () => {};
  }
  raf = requestAnimationFrame(() => {
    raf = requestAnimationFrame(() => (readyScreen.value = target));
  });
  return () => cancelAnimationFrame(raf);
}

/** Al desmontar una escena: deja de estar lista (solo si era ella). */
export function clearReady(target: Screen): void {
  if (readyScreen.value === target) readyScreen.value = null;
}
