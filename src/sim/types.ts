// Contrato de datos del motor. Fuente: docs/specs/01-motor-simulacion.md
// REGLA: este archivo no importa nada de DOM, Three ni Preact.

export type Difficulty = 'cadete' | 'comandante';
export type ModuleId = 'recycler' | 'greenhouse' | 'shield' | 'workshop';
export const MODULE_IDS: readonly ModuleId[] = ['recycler', 'greenhouse', 'shield', 'workshop'];

export type DataStatus = 'simulated' | 'game_balance' | 'verified';

/** Energía asignada a cada módulo en un día. */
export type Plan = Record<ModuleId, number>;

export type EventKind =
  | 'storm'
  | 'breakdown'
  | 'ice'
  | 'night_warning'
  | 'harvest'
  | 'earth_message'
  | 'micro_fault'
  | 'supplies';

export interface ScheduledEvent {
  day: number;
  kind: EventKind;
  /** Datos propios del evento: nivel de tormenta, módulo averiado, etc. */
  payload?: Record<string, unknown>;
}

export interface EventOption {
  id: string;
  /** Clave i18n de por qué no se puede elegir. */
  disabledReason?: string;
}

export interface PendingEvent extends ScheduledEvent {
  options: EventOption[];
}

export type StormLevel = 'S1' | 'S2' | 'S3' | 'S4';

export interface StormData {
  id: string;
  level: StormLevel;
  /** Fecha real del evento (AAAA-MM-DD) o null si es simulado. */
  date: string | null;
  classType: string | null;
  link?: string | null;
}

export interface StormsFile {
  simulated: boolean;
  version: number;
  status: DataStatus;
  source_id: string;
  storms: StormData[];
}

/** Efecto que llega en un día futuro (por ejemplo, el agua del rover). */
export interface PendingEffect {
  day: number;
  kind: 'rover_water';
  amount: number;
}

/** Resultado previsto de un día. Los tres primeros son cambios; `battery` es el valor final. */
export interface DayPreview {
  lifeSupport: number;
  food: number;
  dose: number;
  battery: number;
  wasted: number;
  blackout: boolean;
}

export type LossCause = 'radiation' | 'life_support' | 'food';

export interface DaySnapshot {
  day: number;
  battery: number;
  lifeSupport: number;
  food: number;
  dose: number;
  solar: number;
  wasted: number;
  blackout: boolean;
  sheltered: boolean;
  plan: Plan;
}

export interface LogEntry {
  day: number;
  type: 'info' | 'warning' | 'event' | 'decision' | 'achievement';
  /** Clave i18n + variables. El motor nunca guarda texto ya traducido. */
  key: string;
  vars?: Record<string, string | number>;
}

export interface GameResult {
  outcome: 'win' | 'loss';
  causes: LossCause[];
  day: number;
  stars: 0 | 1 | 2 | 3;
  badges: string[];
}

export interface GameState {
  version: 1;
  seed: number;
  difficulty: Difficulty;
  /** 1..30: día que se está planificando. */
  day: number;
  phase: 'planning' | 'event' | 'outcome' | 'ended';
  battery: number;
  lifeSupport: number;
  food: number;
  dose: number;
  modules: Record<ModuleId, { broken: boolean; brokenSinceDay?: number }>;
  roverAvailable: boolean;
  shelterToday: boolean;
  /** Tormenta que golpea hoy (ya se eligió refugio o no). */
  stormToday: StormLevel | null;
  /** Módulo que se intentará reparar hoy (requiere taller con energía suficiente). */
  repairToday: ModuleId | null;
  /** El rover saldrá hoy (requiere taller con energía suficiente). */
  roverSendToday: boolean;
  pendingEffects: PendingEffect[];
  pendingEvent: PendingEvent | null;
  scheduledEvents: ScheduledEvent[];
  history: DaySnapshot[];
  log: LogEntry[];
  lastPlan: Plan | null;
  result: GameResult | null;
}

export interface DifficultyBalance {
  crew: number;
  batteryCapacity: number;
  batteryStart: number;
  lifeSupportStart: number;
  foodStart: number;
  solarMax: number;
  baseConsumption: number;
  doseLimit: number;
  doseBaseDaily: number;
  minorEventChance: number;
  nightLightBonus: number;
  stormCount: number;
}

export interface Balance {
  simulated: boolean;
  version: number;
  days: number;
  difficulty: Record<Difficulty, DifficultyBalance>;
  modules: Record<ModuleId, { maxEnergy: number }>;
  effects: {
    recyclerLifeSupport: number;
    greenhouseFood: number;
    greenhouseWaterCost: number;
    shieldReduction: number;
    workshopMinEnergy: number;
    blackoutLifeSupportPenalty: number;
    shelterDoseFactor: number;
    roverLifeSupport: number;
  };
  crewConsumption: { lifeSupportPerPerson: number; foodPerPerson: number };
  stormDose: Record<StormLevel, number>;
  roverDelayChance: Record<Difficulty, number>;
  stars: { two: number; three: number };
  events: {
    stormWindows: [number, number][];
    breakdownWindow: [number, number];
    iceWindow: [number, number];
    nightWarningDay: number;
    brokenReminderDays: number;
  };
}

export interface LightSequence {
  simulated: boolean;
  version: number;
  /** 30 valores de 0 a 1. Índice 0 = día 1. */
  light: number[];
  /** Días (1..30) que cuentan como noche lunar. */
  nightDays: number[];
}

export interface GameConfig {
  balance: Balance;
  light: LightSequence;
  storms: StormData[];
}

export interface EnergyBudget {
  solar: number;
  base: number;
  /** batería + solar − base, nunca menor que 0. */
  available: number;
  /** true si el valor sin limitar era negativo (apagón parcial). */
  blackout: boolean;
}
