// Registro de minijuegos: un componente por ChallengeId. Si un reto aún no tiene componente,
// el modal lo salta o lo da por parcial sin colgar el juego.
import type { ComponentType } from 'preact';
import type { ChallengeEffect, ChallengeId, ChallengeParams, Difficulty } from '../../sim/types';
import { RoverIce } from './RoverIce';
import { RegolithTrench } from './RegolithTrench';
import { RelayDocking } from './RelayDocking';
import { SolarRadar } from './SolarRadar';
import { RoboticArm } from './RoboticArm';
import { BiomedCheck } from './BiomedCheck';
import { HullSeals } from './HullSeals';
import { CommCables } from './CommCables';
import { Micrometeorites } from './Micrometeorites';
import { SuperStorm } from './SuperStorm';

export interface ChallengeGameProps {
  params: ChallengeParams;
  assist: number;
  difficulty: Difficulty;
  /** Efectos extra de cada elección que el minijuego ofrece (def.options), para mostrar su consecuencia real. */
  options?: Record<string, ChallengeEffect[]>;
  /** score 0..1; optionId = elección hecha dentro del minijuego (clave de def.options). */
  onDone: (score: number, optionId?: string) => void;
}

export const registry: Record<ChallengeId, ComponentType<ChallengeGameProps> | undefined> = {
  day02_rover_ice: RoverIce,
  day04_solar_radar: SolarRadar,
  day06_hull_seals: HullSeals,
  day08_comm_cables: CommCables,
  day12_robotic_arm: RoboticArm,
  day14_biomed_check: BiomedCheck,
  day16_regolith_trench: RegolithTrench,
  day18_micrometeorites: Micrometeorites,
  day24_super_storm: SuperStorm,
  day30_relay_docking: RelayDocking,
};
