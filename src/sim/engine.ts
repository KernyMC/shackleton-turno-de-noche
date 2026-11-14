// Motor puro y determinista. Sin DOM, sin Three, sin Preact, sin Math.random.
// Todas las funciones devuelven un estado NUEVO; nunca mutan el que reciben.
// Reglas: docs/specs/01-motor-simulacion.md y 00-documento-original.md §4–6.

import { actGoalMet, actOf, isLastDayOfAct, isUnlocked, maxEnergyFor } from './acts';
import { defaultConfig } from './config';
import { scheduleEvents } from './events';
import type { ScheduleOptions } from './events';
import { createRng } from './rng';
import { computeResult, lossCauses } from './scoring';
import { MODULE_IDS } from './types';
import type {
  DayPreview,
  DaySnapshot,
  Difficulty,
  EnergyBudget,
  EventOption,
  GameConfig,
  GameState,
  LogEntry,
  ModuleId,
  PendingEvent,
  Plan,
  StormLevel,
} from './types';

export const EMPTY_PLAN: Plan = { recycler: 0, greenhouse: 0, shield: 0, workshop: 0 };
const MAX_LOG = 100;

/** Redondeo a 2 decimales para que los valores no acumulen ruido de coma flotante. */
const r2 = (n: number): number => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

export function createGame(
  seed: number,
  difficulty: Difficulty,
  cfg: GameConfig = defaultConfig,
  options: ScheduleOptions = {},
): GameState {
  const d = cfg.balance.difficulty[difficulty];
  return {
    version: 3,
    seed,
    difficulty,
    day: 1,
    phase: 'planning',
    battery: d.batteryStart,
    lifeSupport: d.lifeSupportStart,
    food: d.foodStart,
    dose: 0,
    modules: {
      recycler: { broken: false },
      greenhouse: { broken: false },
      shield: { broken: false },
      workshop: { broken: false },
    },
    roverAvailable: true,
    shelterToday: false,
    stormToday: null,
    repairToday: null,
    roverSendToday: false,
    dust: false,
    cleanToday: false,
    unlocked: [...cfg.balance.acts.unlocks.initial],
    actsMet: [],
    pendingEffects: [],
    pendingEvent: null,
    scheduledEvents: scheduleEvents(seed, difficulty, cfg, options),
    history: [],
    log: [],
    lastPlan: null,
    challenges: {},
    mods: { daily: [], doseFactor: 1, warningsOffUntil: 0 },
    result: null,
  };
}

/** Luz (0..1) de un día, con el bono de noche de la dificultad. */
export function getLight(day: number, difficulty: Difficulty, cfg: GameConfig = defaultConfig): number {
  const raw = cfg.light.light[day - 1];
  if (raw === undefined) throw new Error(`Día fuera de rango: ${day}`);
  const bonus = cfg.balance.difficulty[difficulty].nightLightBonus;
  if (bonus > 0 && cfg.light.nightDays.includes(day)) return Math.min(0.1, raw + bonus);
  return raw;
}

export function getEnergyBudget(state: GameState, cfg: GameConfig = defaultConfig): EnergyBudget {
  const d = cfg.balance.difficulty[state.difficulty];
  const dustFactor = state.dust ? cfg.balance.effects.dustSolarFactor : 1;
  const solar = r2(d.solarMax * getLight(state.day, state.difficulty, cfg) * dustFactor);
  const raw = state.battery + solar - d.baseConsumption;
  return { solar, base: d.baseConsumption, available: r2(Math.max(0, raw)), blackout: raw < 0 };
}

export interface PlanValidation {
  ok: boolean;
  /** Claves i18n de cada problema encontrado. */
  errors: string[];
}

export function validatePlan(
  state: GameState,
  plan: Plan,
  cfg: GameConfig = defaultConfig,
): PlanValidation {
  const errors: string[] = [];
  let total = 0;
  for (const id of MODULE_IDS) {
    const value = plan[id];
    if (!Number.isFinite(value) || value < 0) errors.push(`plan.error.negative.${id}`);
    // Un módulo bloqueado tiene máximo 0.
    if (value > maxEnergyFor(state, id, cfg)) errors.push(`plan.error.over_max.${id}`);
    if (state.modules[id].broken && value > 0) errors.push(`plan.error.broken.${id}`);
    total += value;
  }
  // Tolerancia mínima por decimales de la producción solar.
  if (total > getEnergyBudget(state, cfg).available + 1e-9) errors.push('plan.error.over_budget');
  return { ok: errors.length === 0, errors };
}

/**
 * Ajusta un plan deseado a lo que hoy es posible, dando prioridad en el orden indicado.
 * Respeta máximos, bloqueos, averías y energía disponible; siempre devuelve enteros.
 */
export function fitPlan(
  state: GameState,
  desired: Plan,
  order: readonly ModuleId[],
  cfg: GameConfig = defaultConfig,
): Plan {
  const fitted: Plan = { ...EMPTY_PLAN };
  let left = Math.floor(getEnergyBudget(state, cfg).available + 1e-9);
  for (const id of order) {
    if (state.modules[id].broken) continue;
    const value = Math.max(0, Math.min(Math.round(desired[id]), maxEnergyFor(state, id, cfg), left));
    fitted[id] = value;
    left -= value;
  }
  return fitted;
}

/** Dosis extra (mSv) de una tormenta según si la tripulación se refugia. */
export function getStormDose(level: StormLevel, sheltered: boolean, cfg: GameConfig = defaultConfig): number {
  const full = cfg.balance.stormDose[level];
  return r2(sheltered ? full * cfg.balance.effects.shelterDoseFactor : full);
}

/** ¿El taller recibe energía suficiente y hay alguien para usarlo? */
function workshopActive(state: GameState, plan: Plan, cfg: GameConfig): boolean {
  return (
    !state.shelterToday &&
    !state.modules.workshop.broken &&
    plan.workshop >= cfg.balance.effects.workshopMinEnergy
  );
}

interface DayMath {
  budget: EnergyBudget;
  battery: number;
  wasted: number;
  lifeSupport: number;
  food: number;
  dose: number;
}

/** Cuentas de un día (pasos 2–8 de §4.6). Compartidas por previewDay y runDay. */
function computeDay(state: GameState, plan: Plan, cfg: GameConfig): DayMath {
  const d = cfg.balance.difficulty[state.difficulty];
  const fx = cfg.balance.effects;
  const budget = getEnergyBudget(state, cfg);

  // Un módulo bloqueado no recibe energía (máximo 0), pida lo que pida el plan.
  const usable: Plan = { ...plan };
  for (const id of MODULE_IDS) if (!state.unlocked.includes(id)) usable[id] = 0;
  plan = usable;

  const total = MODULE_IDS.reduce((sum, id) => sum + plan[id], 0);
  const left = budget.available - total;
  const battery = r2(Math.min(d.batteryCapacity, left));
  const wasted = r2(Math.max(0, left - d.batteryCapacity));

  const eff = (id: ModuleId): number =>
    state.modules[id].broken ? 0 : plan[id] / cfg.balance.modules[id].maxEnergy;
  const eRecycler = eff('recycler'); // automático: funciona aunque haya refugio
  const eGreenhouse = state.shelterToday ? 0 : eff('greenhouse');
  const eShield = eff('shield');

  let lifeSupport =
    state.lifeSupport +
    fx.recyclerLifeSupport * eRecycler -
    fx.greenhouseWaterCost * eGreenhouse -
    cfg.balance.crewConsumption.lifeSupportPerPerson * d.crew -
    (budget.blackout ? fx.blackoutLifeSupportPenalty : 0);
  for (const m of state.mods.daily) if (m.untilDay >= state.day) lifeSupport += m.amount;
  const food =
    state.food + fx.greenhouseFood * eGreenhouse - cfg.balance.crewConsumption.foodPerPerson * d.crew;
  const dose =
    state.dose +
    (d.doseBaseDaily * (1 - fx.shieldReduction * eShield) +
      (state.stormToday ? getStormDose(state.stormToday, state.shelterToday, cfg) : 0)) *
      state.mods.doseFactor;

  for (const effect of state.pendingEffects) {
    if (effect.day === state.day && effect.kind === 'rover_water') lifeSupport += effect.amount;
  }

  return {
    budget,
    battery,
    wasted,
    lifeSupport: r2(clamp(lifeSupport, 0, 100)),
    food: r2(clamp(food, 0, 100)),
    dose: r2(dose),
  };
}

/** Vista previa del día: mismos números que runDay, sin cambiar nada. */
export function previewDay(state: GameState, plan: Plan, cfg: GameConfig = defaultConfig): DayPreview {
  const m = computeDay(state, plan, cfg);
  return {
    lifeSupport: r2(m.lifeSupport - state.lifeSupport),
    food: r2(m.food - state.food),
    dose: r2(m.dose - state.dose),
    battery: m.battery,
    wasted: m.wasted,
    blackout: m.budget.blackout,
  };
}

/** Opciones del evento pendiente, con la razón si alguna no se puede elegir. */
export function getEventOptions(
  state: GameState,
  event: Pick<PendingEvent, 'kind'>,
  cfg: GameConfig = defaultConfig,
): EventOption[] {
  const workshopReason = (): string | undefined => {
    if (state.modules.workshop.broken) return 'event.reason.workshop_broken';
    if (!isUnlocked(state, 'workshop')) return 'event.reason.workshop_energy';
    if (getEnergyBudget(state, cfg).available < cfg.balance.effects.workshopMinEnergy) {
      return 'event.reason.workshop_energy';
    }
    return undefined;
  };
  const option = (id: string, disabledReason?: string): EventOption =>
    disabledReason ? { id, disabledReason } : { id };

  switch (event.kind) {
    case 'storm':
      return [option('shelter'), option('work')];
    case 'breakdown':
      return [option('repair', workshopReason()), option('later')];
    case 'dust':
      return [option('clean', workshopReason()), option('tilt')];
    case 'ice': {
      const noTime = state.day >= cfg.balance.days ? 'event.reason.no_time' : undefined;
      return [option('send', noTime ?? workshopReason()), option('skip')];
    }
    default:
      return [option('ok')];
  }
}

/** Desbloquea los módulos indicados que aún estén bloqueados, con una entrada de log cada uno. */
function unlockModules(state: GameState, ids: readonly ModuleId[]): GameState {
  const fresh = ids.filter((id) => !state.unlocked.includes(id));
  if (fresh.length === 0) return state;
  return {
    ...state,
    unlocked: [...state.unlocked, ...fresh],
    log: pushLog(
      state.log,
      ...fresh.map((module): LogEntry => ({ day: state.day, type: 'achievement', key: 'log.unlock', vars: { module } })),
    ),
  };
}

/** Desbloqueos por día (balance.json → acts.unlocks.byDay) al empezar `state.day`. */
function applyDayUnlocks(state: GameState, cfg: GameConfig): GameState {
  const due = MODULE_IDS.filter((id) => {
    const from = cfg.balance.acts.unlocks.byDay[id];
    return from !== undefined && state.day >= from;
  });
  return unlockModules(state, due);
}

/** Abre el evento programado para el día actual, si lo hay. */
function openEventForToday(state: GameState, cfg: GameConfig): GameState {
  const scheduled = state.scheduledEvents.find((e) => e.day === state.day);
  if (!scheduled) return state;

  let next = state;
  let event = scheduled;
  if (scheduled.kind === 'storm') {
    // La primera tormenta desbloquea el blindaje; el refugio funciona esté o no desbloqueado.
    next = unlockModules(state, cfg.balance.acts.unlocks.onFirstStorm);
  }
  if (scheduled.kind === 'dust') {
    next = {
      ...state,
      dust: true,
      log: pushLog(state.log, { day: state.day, type: 'event', key: 'log.dust' }),
    };
  }
  if (scheduled.kind === 'breakdown') {
    // Si el módulo previsto ya está roto, se elige otro; si no queda ninguno, no hay avería.
    const wanted = scheduled.payload?.module as ModuleId;
    const candidates: ModuleId[] = [wanted, 'greenhouse', 'shield', 'recycler'];
    const target = candidates.find((id) => !state.modules[id].broken);
    if (!target || (target === 'recycler' && wanted !== 'recycler')) return state;
    event = { ...scheduled, payload: { module: target } };
    next = {
      ...state,
      modules: { ...state.modules, [target]: { broken: true, brokenSinceDay: state.day } },
      log: pushLog(state.log, { day: state.day, type: 'event', key: 'log.breakdown', vars: { module: target } }),
    };
  }
  return {
    ...next,
    phase: 'event',
    pendingEvent: { ...event, options: getEventOptions(next, event, cfg) },
  };
}

function pushLog(log: LogEntry[], ...entries: LogEntry[]): LogEntry[] {
  return [...log, ...entries].slice(-MAX_LOG);
}

/** Aplica la decisión del jugador sobre el evento pendiente. */
export function resolveEvent(
  state: GameState,
  optionId: string,
  cfg: GameConfig = defaultConfig,
): GameState {
  const event = state.pendingEvent;
  if (state.phase !== 'event' || !event) throw new Error('No hay evento pendiente');
  const option = event.options.find((o) => o.id === optionId);
  if (!option) throw new Error(`Opción desconocida: ${optionId}`);
  if (option.disabledReason) throw new Error(`Opción no disponible: ${option.disabledReason}`);

  const day = state.day;
  const decision = (key: string, vars?: LogEntry['vars']): LogEntry =>
    vars ? { day, type: 'decision', key, vars } : { day, type: 'decision', key };
  let next: GameState = { ...state, phase: 'planning', pendingEvent: null };

  switch (event.kind) {
    case 'storm': {
      const level = event.payload?.level as StormLevel;
      const sheltered = optionId === 'shelter';
      next = {
        ...next,
        stormToday: level,
        shelterToday: sheltered,
        log: pushLog(
          state.log,
          decision(sheltered ? 'log.storm.shelter' : 'log.storm.work', {
            level,
            dose: getStormDose(level, sheltered, cfg),
          }),
        ),
      };
      break;
    }
    case 'breakdown': {
      const module = event.payload?.module as ModuleId;
      next = {
        ...next,
        repairToday: optionId === 'repair' ? module : null,
        log: pushLog(state.log, decision(optionId === 'repair' ? 'log.repair.today' : 'log.repair.later', { module })),
      };
      break;
    }
    case 'ice':
      next = {
        ...next,
        roverSendToday: optionId === 'send',
        log: pushLog(state.log, decision(optionId === 'send' ? 'log.rover.send' : 'log.rover.skip')),
      };
      break;
    case 'dust':
      next = {
        ...next,
        cleanToday: optionId === 'clean',
        log: pushLog(state.log, decision(optionId === 'clean' ? 'log.dust.clean' : 'log.dust.tilt')),
      };
      break;
    case 'harvest': {
      const amount = cfg.balance.effects.harvestFood;
      next = {
        ...next,
        food: r2(clamp(state.food + amount, 0, 100)),
        log: pushLog(state.log, { day, type: 'event', key: 'log.harvest', vars: { amount } }),
      };
      break;
    }
    default:
      next = { ...next, log: pushLog(state.log, { day, type: 'event', key: `log.${event.kind}` }) };
  }
  return next;
}

/** Pide (o cancela, con null) reparar un módulo roto hoy. Se usa en días posteriores a la avería. */
export function setRepairToday(state: GameState, module: ModuleId | null): GameState {
  if (state.phase !== 'planning') throw new Error('Solo se puede pedir una reparación al planificar');
  if (module && !state.modules[module].broken) throw new Error(`${module} no está averiado`);
  return { ...state, repairToday: module };
}

/** Pide (o cancela) limpiar hoy el polvo de los paneles con el rover. Requiere polvo y el Taller desbloqueado. */
export function setCleanToday(state: GameState, on: boolean): GameState {
  if (state.phase !== 'planning') throw new Error('Solo se puede pedir la limpieza al planificar');
  if (on && !state.dust) throw new Error('Los paneles no tienen polvo');
  if (on && !isUnlocked(state, 'workshop')) throw new Error('El Taller aún está bloqueado');
  return { ...state, cleanToday: on };
}

/** Cierra el acto si `day` es su último día: guarda si se cumplió el objetivo y lo anota en el log. */
function closeActIfDue(state: GameState, day: number, cfg: GameConfig): GameState {
  if (!isLastDayOfAct(day, cfg)) return state;
  const act = actOf(day, cfg);
  const met = actGoalMet(state, act.id, cfg);
  const entry: LogEntry = {
    day,
    type: met ? 'achievement' : 'info',
    key: met ? 'log.act.met' : 'log.act.missed',
    vars: { act: act.id, name: act.key },
  };
  return {
    ...state,
    actsMet: met ? [...state.actsMet, act.id] : state.actsMet,
    log: pushLog(state.log, entry),
  };
}

/** Resuelve el día actual con el plan dado (orden exacto de §4.6). */
export function runDay(state: GameState, plan: Plan, cfg: GameConfig = defaultConfig): GameState {
  if (state.phase !== 'planning') throw new Error(`No se puede ejecutar el día en fase "${state.phase}"`);
  const validation = validatePlan(state, plan, cfg);
  if (!validation.ok) throw new Error(`Plan inválido: ${validation.errors.join(', ')}`);

  const d = cfg.balance.difficulty[state.difficulty];
  const fx = cfg.balance.effects;
  const day = state.day;
  const m = computeDay(state, plan, cfg);
  const entries: LogEntry[] = [];
  const add = (type: LogEntry['type'], key: string, vars?: LogEntry['vars']): void => {
    entries.push(vars ? { day, type, key, vars } : { day, type, key });
  };

  if (m.budget.blackout) add('warning', 'log.blackout');
  if (m.wasted > 0) add('info', 'log.wasted', { amount: m.wasted });
  if (state.pendingEffects.some((e) => e.day === day)) add('event', 'log.rover.arrived', { amount: fx.roverLifeSupport });

  // Taller: reparación y salida del rover.
  const workshop = workshopActive(state, plan, cfg);
  let modules = state.modules;
  if (state.repairToday) {
    if (workshop) {
      modules = { ...modules, [state.repairToday]: { broken: false } };
      add('achievement', 'log.repair.done', { module: state.repairToday });
    } else {
      add('warning', 'log.repair.failed', { module: state.repairToday });
    }
  }
  let pendingEffects = state.pendingEffects.filter((e) => e.day > day);
  let roverAvailable = pendingEffects.length === 0;
  if (state.roverSendToday) {
    if (workshop) {
      const delayed =
        createRng((state.seed ^ Math.imul(day, 0x9e3779b1)) >>> 0).next() <
        cfg.balance.roverDelayChance[state.difficulty];
      pendingEffects = [
        ...pendingEffects,
        { day: day + (delayed ? 2 : 1), kind: 'rover_water', amount: fx.roverLifeSupport },
      ];
      roverAvailable = false;
      add('event', delayed ? 'log.rover.delayed' : 'log.rover.departed');
    } else {
      add('warning', 'log.rover.failed');
    }
  }
  let dust = state.dust;
  if (state.cleanToday) {
    if (workshop && dust) {
      dust = false;
      add('achievement', 'log.dust.cleaned');
    } else if (dust) {
      add('warning', 'log.dust.failed');
    }
  }
  for (const id of MODULE_IDS) {
    const since = modules[id].brokenSinceDay;
    if (modules[id].broken && since !== undefined && day - since === cfg.balance.events.brokenReminderDays) {
      add('warning', 'log.broken_reminder', { module: id });
    }
  }
  const th = cfg.balance.thresholds;
  if (m.lifeSupport <= th.critical) add('warning', 'log.critical.life_support');
  else if (m.lifeSupport <= th.low) add('warning', 'log.low.life_support');
  if (m.food <= th.critical) add('warning', 'log.critical.food');
  else if (m.food <= th.low) add('warning', 'log.low.food');
  if (m.dose >= d.doseLimit * th.doseDanger) add('warning', 'log.dose.danger');
  else if (m.dose >= d.doseLimit * th.doseCaution) add('warning', 'log.dose.caution');

  const snapshot: DaySnapshot = {
    day,
    battery: m.battery,
    lifeSupport: m.lifeSupport,
    food: m.food,
    dose: m.dose,
    solar: m.budget.solar,
    wasted: m.wasted,
    blackout: m.budget.blackout,
    sheltered: state.shelterToday,
    plan: { ...plan },
  };

  const resolved: GameState = {
    ...state,
    battery: m.battery,
    lifeSupport: m.lifeSupport,
    food: m.food,
    dose: m.dose,
    modules,
    dust,
    cleanToday: false,
    roverAvailable,
    pendingEffects,
    history: [...state.history, snapshot],
    log: pushLog(state.log, ...entries),
    lastPlan: { ...plan },
    shelterToday: false,
    stormToday: null,
    repairToday: null,
    roverSendToday: false,
  };

  // La derrota se evalúa al final del día; en el día 30 la derrota gana a la victoria.
  const causes = lossCauses(m, d.doseLimit);
  if (causes.length > 0 || day >= cfg.balance.days) {
    const ended: GameState = { ...resolved, phase: 'ended', result: computeResult(resolved, causes, cfg) };
    return causes.length > 0 ? ended : closeActIfDue(ended, day, cfg);
  }
  const closed = closeActIfDue(resolved, day, cfg);
  return openEventForToday(applyDayUnlocks({ ...closed, day: day + 1 }, cfg), cfg);
}
