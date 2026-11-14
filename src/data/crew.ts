// La tripulación: cuatro personajes ORIGINALES, cada uno ligado a un módulo.
// Nombres, colores, íconos y fotos viven en crew.json (el equipo cambia SOLO ese archivo).
// Los roles y las frases viven en i18n (claves `crew.<id>.role`, `.quote`, `.good`, `.worried`).

import { signal } from '@preact/signals';
import type { ModuleId } from '../sim/types';
import type { IconName } from '../components/icons';
import data from './crew.json';

export type CrewId = 'valeria' | 'mateo' | 'amaru' | 'lucia';

export interface CrewMember {
  id: CrewId;
  /** Nombre corto ("Valeria"). */
  name: string;
  /** Nombre completo. */
  fullName: string;
  /** Módulo que cuida. */
  module: ModuleId;
  /** Color de su traje (franjas, parches). */
  color: number;
  /** El mismo color para CSS. */
  css: string;
  /** Ícono de su rol. */
  roleIcon: IconName;
  /** Ruta de su foto (opcional). */
  photo: string | null;
}

interface RawMember {
  id: CrewId;
  name: string;
  fullName: string;
  module: ModuleId;
  color: string;
  roleIcon: IconName;
  photo?: string | null;
}

export const CREW: CrewMember[] = (data.members as RawMember[]).map((m) => ({
  id: m.id,
  name: m.name,
  fullName: m.fullName,
  module: m.module,
  color: parseInt(m.color.slice(1), 16),
  css: m.color,
  roleIcon: m.roleIcon,
  photo: m.photo ?? null,
}));

export const crewById = (id: CrewId): CrewMember => CREW.find((c) => c.id === id)!;

/** Nombre corto de un tripulante. */
export const crewName = (id: CrewId): string => crewById(id).name;
/** Nombre completo de un tripulante. */
export const crewFullName = (id: CrewId): string => crewById(id).fullName;

/** Fotos disponibles (id → ruta). Vacío si no hay ninguna: entonces se usa el retrato SVG. */
export const crewPhotos = signal<Partial<Record<CrewId, string>>>({});

/** Lee public/optional-assets.json (lista `crew`) para no pedir fotos que no existen. */
export async function loadCrewPhotos(): Promise<void> {
  try {
    const res = await fetch('/optional-assets.json');
    if (!res.ok) return;
    const j = (await res.json()) as { crew?: unknown };
    if (!Array.isArray(j.crew)) return;
    const found: Partial<Record<CrewId, string>> = {};
    for (const id of j.crew) {
      const m = CREW.find((c) => c.id === id);
      if (m) found[m.id] = m.photo ?? `/crew/${m.id}.png`;
    }
    crewPhotos.value = found;
  } catch {
    /* sin red o sin archivo: retratos SVG */
  }
}

if (typeof window !== 'undefined') void loadCrewPhotos();
