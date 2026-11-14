// Puente mínimo entre la escena 3D y la interfaz: dónde está cada módulo en la pantalla y cómo
// llevar la cámara a uno. La escena lo rellena al montarse; la interfaz lo usa para colocar números
// flotantes y burbujas, y para el botón "Ir al módulo" de los avisos.
import type { ModuleId } from '../sim/types';

export interface ScreenPoint {
  x: number;
  y: number;
}

export const sceneBridge: {
  project: ((id: ModuleId) => ScreenPoint | null) | null;
  /** Acerca la cámara a un módulo (o vuelve al centro con null). Sin escena 3D no hace nada. */
  centerOn: ((id: ModuleId | null) => void) | null;
} = { project: null, centerOn: null };
