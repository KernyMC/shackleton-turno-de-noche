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
  | 'supplies'
  | 'dust';

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
  /** Clase de la fulguración o velocidad de la CME, tal como la da DONKI. */
  classType: string | null;
  link?: string | null;
  /** Tipo de evento DONKI (solo datos reales). */
  type?: 'FLR' | 'CME' | 'SEP';
  /** De dónde salió: histórico de DONKI, consulta en vivo de hoy o ejemplo simulado. */
  origin?: 'real' | 'live' | 'sample';
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
  /** Versión del formato de partida. 2 = actos, desbloqueos y polvo (mejoras v4). */
  version: 2;
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
  /** Polvo lunar sobre los paneles: mientras sea true la producción solar se reduce. */
  dust: boolean;
  /** Se limpiarán los paneles hoy con el rover (requiere taller con energía suficiente). */
  cleanToday: boolean;
  /** Módulos ya desbloqueados: los demás no reciben energía. */
  unlocked: ModuleId[];
  /** Ids (1..5) de los actos cuyo objetivo se cumplió al cerrarse. */
  actsMet: number[];
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
    /** Multiplicador de la producción solar mientras hay polvo en los paneles. */
    dustSolarFactor: number;
    /** Comida que da la cosecha extra del día 3. */
    harvestFood: number;
  };
  crewConsumption: { lifeSupportPerPerson: number; foodPerPerson: number };
  stormDose: Record<StormLevel, number>;
  roverDelayChance: Record<Difficulty, number>;
  stars: { two: number; three: number };
  events: EventsBalance;
  acts: ActsBalance;
  /** Umbrales de "Bajo" y "Crítico" (los mismos que usa el HUD). */
  thresholds: {
    low: number;
    critical: number;
    /** Fracción del límite de dosis desde la que se avisa (precaución). */
    doseCaution: number;
    doseDanger: number;
    /** Fracción de la capacidad de batería por debajo de la cual es "Baja". */
    batteryLow: number;
  };
  fastForward: {
    maxDays: number;
    /** Días de pronóstico en los que, si entra la noche, se detiene el avance rápido. */
    nightLookahead: number;
  };
}

export type ActGoalType = 'air_food' | 'battery_pct' | 'no_blackout' | 'all_min' | 'reach_day';

export interface ActDef {
  id: number;
  /** Nombre corto (clave para i18n: act.<key>). */
  key: string;
  from: number;
  to: number;
  goal: { type: ActGoalType; target: number };
}

export interface ActsBalance {
  list: ActDef[];
  unlocks: {
    initial: ModuleId[];
    /** Módulo → día en que se desbloquea al empezar ese día. */
    byDay: Partial<Record<ModuleId, number>>;
    /** Módulos que se desbloquean el día en que aparece la primera tormenta. */
    onFirstStorm: ModuleId[];
  };
}

export interface StormSlot {
  window: [number, number];
  /** Rango de nivel S1..S4 (en número) por dificultad; null = esa dificultad no tiene esta tormenta. */
  levels: Record<Difficulty, [number, number] | null>;
}

export interface BreakdownSlot {
  window: [number, number];
  /** Probabilidad (0..1) de que ocurra, por dificultad. Se decide por semilla. */
  chance: Record<Difficulty, number>;
}

export interface EventsBalance {
  /** Días de antelación con que la antena (Taller encendido) avisa de una tormenta. */
  warningDays: number;
  brokenReminderDays: number;
  /** Eventos de día fijo (cosecha, polvo, aviso de noche). */
  fixed: { kind: EventKind; day: number }[];
  iceWindow: [number, number];
  storms: StormSlot[];
  breakdowns: BreakdownSlot[];
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
