// Puente mínimo entre la escena 3D y la interfaz: dónde está cada módulo en la pantalla.
// La escena lo rellena al montarse; la interfaz lo usa para colocar números flotantes y burbujas.
import type { ModuleId } from '../sim/types';

export interface ScreenPoint {
  x: number;
  y: number;
}

export const sceneBridge: { project: ((id: ModuleId) => ScreenPoint | null) | null } = { project: null };
