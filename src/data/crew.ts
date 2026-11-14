// La tripulación: cuatro personajes ORIGINALES (no personas reales), cada uno ligado a un módulo.
// Nombres, roles y frases viven en i18n (claves `crew.<id>.*`) para poder cambiarlos sin tocar código.

import type { ModuleId } from '../sim/types';

export type CrewId = 'valeria' | 'mateo' | 'amaru' | 'lucia';

export interface CrewMember {
  id: CrewId;
  /** Módulo que cuida. */
  module: ModuleId;
  /** Color de su traje (franjas, parches). */
  color: number;
  /** El mismo color para CSS. */
  css: string;
}

export const CREW: CrewMember[] = [
  { id: 'valeria', module: 'recycler', color: 0x4fd1e0, css: '#4fd1e0' },
  { id: 'mateo', module: 'greenhouse', color: 0x7ccf6a, css: '#7ccf6a' },
  { id: 'amaru', module: 'shield', color: 0xffb347, css: '#ffb347' },
  { id: 'lucia', module: 'workshop', color: 0xff7a3d, css: '#ff7a3d' },
];

export const crewById = (id: CrewId): CrewMember => CREW.find((c) => c.id === id)!;
