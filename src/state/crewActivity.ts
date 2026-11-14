// Qué está haciendo cada tripulante ahora. Función pura: solo lee el estado del juego.
// Devuelve una clave i18n (`crew.act.*`) y sus variables; el texto vive en i18n.
import { crewById } from '../data/crew';
import type { CrewId } from '../data/crew';
import { isUnlocked } from '../sim/acts';
import type { GameState } from '../sim/types';

export interface CrewActivity {
  key: string;
  /** Variables de la frase; `module` es un id de módulo (el componente lo traduce). */
  vars?: { module: string };
  /** true si es algo especial (no su tarea normal). */
  special: boolean;
}

export function crewActivity(g: GameState, id: CrewId): CrewActivity {
  const member = crewById(id);
  const mod = member.module;
  const stormShelter = g.stormToday !== null && g.shelterToday;
  if (stormShelter) return { key: 'crew.act.shelter', special: true };
  if (!isUnlocked(g, mod)) return { key: 'crew.act.locked', special: true };
  if (id === 'lucia' && g.repairToday) return { key: 'crew.act.repairing', vars: { module: g.repairToday }, special: true };
  const roverOut = g.roverSendToday || g.pendingEffects.some((e) => e.kind === 'rover_water');
  if (id === 'lucia' && roverOut) return { key: 'crew.act.rover', special: true };
  if (g.modules[mod].broken) return { key: 'crew.act.waiting', special: true };
  const last = g.history[g.history.length - 1];
  if (last && last.plan[mod] <= 0) return { key: 'crew.act.noenergy', vars: { module: mod }, special: true };
  return { key: `crew.act.${id}`, special: false };
}
