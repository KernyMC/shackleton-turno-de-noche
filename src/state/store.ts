// Estado global de la app (signals). Es el ÚNICO puente entre motor, interfaz y escena:
// la interfaz y la escena leen estos signals y llaman a estas acciones; nunca tocan el motor.
// Contrato: docs/specs/03-interfaz-y-estado.md.

import { computed, signal } from '@preact/signals';
import { defaultConfig } from '../sim/config';
import {
  createGame,
  EMPTY_PLAN,
  getEnergyBudget,
  previewDay,
  resolveEvent,
  runDay,
  setRepairToday,
  validatePlan,
} from '../sim/engine';
import { MODULE_IDS } from '../sim/types';
import type { DayPreview, Difficulty, GameState, ModuleId, Plan } from '../sim/types';
import { liveStorm } from './spaceWeather';

export type Screen = 'menu' | 'game' | 'debrief';
/** Cosas del mundo con las que se puede interactuar. */
export type TargetId = ModuleId | 'shelter' | 'rover';
export type Preset = 'repeat' | 'saving' | 'zero';

/** Duración de la animación de resolución del día (ms). */
export const RESOLVE_MS = 1500;

const NAME_KEY = 'halosur:commander:v1';
function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
/** Nombre que escribió la comandante (vacío = usar "Comandante"). Máximo 20 caracteres. */
export const commanderName = signal<string>(loadName());
export function setCommanderName(value: string): void {
  const clean = value.replace(/\s+/g, ' ').trimStart().slice(0, 20);
  commanderName.value = clean;
  try {
    localStorage.setItem(NAME_KEY, clean);
  } catch {
    // Sin almacenamiento: el nombre dura solo esta sesión.
  }
}

export const screen = signal<Screen>('menu');
export const game = signal<GameState | null>(null);
/** Plan en edición del día actual. Siempre es válido para `game`. */
export const plan = signal<Plan>(EMPTY_PLAN);
/** true mientras se anima la resolución del día; bloquea ejecutar de nuevo. */
export const resolving = signal(false);
/** Resultado del último día ejecutado, para el resumen. */
export const lastOutcome = signal<{ day: number; preview: DayPreview } | null>(null);
/** Estado al empezar cada día jugado (en memoria): permite volver atrás desde el debrief. */
export const dayStates = signal<GameState[]>([]);
/** Objetivo frente al que está el jugador (lo escribe la escena, lo lee la interfaz). */
export const nearTarget = signal<TargetId | null>(null);
/** Módulo que el jugador tocó en la maqueta: la tablet enfoca su slider. */
export const focusModule = signal<ModuleId | null>(null);
/** La cámara mira al cielo. */
export const skyView = signal(false);
/** La tablet de muñeca está abierta. */
export const tabletOpen = signal(false);
/** Recursos reales de NASA que la escena logró cargar (para las fichas de fuente). */
export const realAssets = signal<{ terrain: 'real' | 'procedural' | null; models: string[] }>({ terrain: null, models: [] });

export const budget = computed(() => (game.value ? getEnergyBudget(game.value) : null));
export const preview = computed(() => {
  const g = game.value;
  return g && g.phase === 'planning' ? previewDay(g, plan.value) : null;
});

let resolveTimer: ReturnType<typeof setTimeout> | null = null;

function cancelResolve(): void {
  if (resolveTimer !== null) clearTimeout(resolveTimer);
  resolveTimer = null;
  resolving.value = false;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function seedFromUrl(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('seed');
  const seed = raw === null ? NaN : Number(raw);
  return Number.isFinite(seed) ? seed >>> 0 : null;
}

const planTotal = (p: Plan): number => MODULE_IDS.reduce((sum, id) => sum + p[id], 0);

/**
 * Ajusta un plan deseado a lo que hoy es posible, dando prioridad en el orden indicado.
 * Respeta máximos, averías y energía disponible; siempre devuelve enteros.
 */
function fitPlan(g: GameState, desired: Plan, order: readonly ModuleId[]): Plan {
  const fitted: Plan = { ...EMPTY_PLAN };
  let left = Math.floor(getEnergyBudget(g).available + 1e-9);
  for (const id of order) {
    if (g.modules[id].broken) continue;
    const value = Math.max(0, Math.min(Math.round(desired[id]), defaultConfig.balance.modules[id].maxEnergy, left));
    fitted[id] = value;
    left -= value;
  }
  return fitted;
}

const samePlan = (a: Plan, b: Plan): boolean => MODULE_IDS.every((id) => a[id] === b[id]);

/** Si hoy hay reparación o salida del rover, reserva la energía mínima del taller. */
function reserveWorkshop(g: GameState): void {
  if (g.repairToday === null && !g.roverSendToday) return;
  const min = defaultConfig.balance.effects.workshopMinEnergy;
  const desired = { ...plan.value, workshop: Math.max(plan.value.workshop, min) };
  plan.value = fitPlan(g, desired, ['workshop', 'recycler', 'shield', 'greenhouse']);
}

export function startGame(difficulty: Difficulty, seed?: number): void {
  cancelResolve();
  // Si hoy el Sol está activo (NASA DONKI en vivo), la primera tormenta es ese evento real.
  const firstStorm = liveStorm();
  game.value = createGame(seed ?? seedFromUrl() ?? Date.now() >>> 0, difficulty, undefined, firstStorm ? { firstStorm } : {});
  dayStates.value = [game.value];
  plan.value = EMPTY_PLAN;
  lastOutcome.value = null;
  tabletOpen.value = false;
  screen.value = 'game';
}

/**
 * Vuelve al inicio de un día ya jugado, con la misma partida (misma semilla y eventos).
 * Sirve para aprender del error: se llama desde el debrief. Devuelve true si se pudo.
 */
export function rewindTo(day: number): boolean {
  const target = dayStates.value.find((s) => s.day === day);
  if (!target) return false;
  cancelResolve();
  dayStates.value = dayStates.value.filter((s) => s.day <= day);
  game.value = target;
  plan.value = EMPTY_PLAN;
  lastOutcome.value = null;
  focusModule.value = null;
  tabletOpen.value = target.phase === 'event';
  screen.value = 'game';
  return true;
}

/** Nueva partida con la misma dificultad y otra semilla. */
export function restart(): void {
  const g = game.value;
  if (g) startGame(g.difficulty, (g.seed + 1) >>> 0);
}

export function exitToMenu(): void {
  cancelResolve();
  screen.value = 'menu';
  tabletOpen.value = false;
}

export function toggleTablet(): void {
  // Con un evento que exige decisión, la tablet no se cierra.
  if (tabletOpen.value && game.value?.phase === 'event') return;
  tabletOpen.value = !tabletOpen.value;
}

/**
 * Cambia la energía de un módulo. Nunca deja un plan inválido: el valor se detiene en el
 * máximo posible. Devuelve true si hubo que recortarlo por falta de energía.
 */
export function setPlanValue(id: ModuleId, value: number): boolean {
  const g = game.value;
  if (!g || g.phase !== 'planning' || resolving.value || g.modules[id].broken) return false;
  const wanted = Math.max(0, Math.min(Math.round(value), defaultConfig.balance.modules[id].maxEnergy));
  const others = planTotal(plan.value) - plan.value[id];
  const room = Math.max(0, Math.floor(getEnergyBudget(g).available - others + 1e-9));
  const final = Math.min(wanted, room);
  if (final !== plan.value[id]) plan.value = { ...plan.value, [id]: final };
  return final < wanted;
}

/** Aplica un plan rápido. Devuelve true si hubo que ajustarlo a la energía de hoy. */
export function applyPreset(preset: Preset): boolean {
  const g = game.value;
  if (!g || g.phase !== 'planning' || resolving.value) return false;
  let desired: Plan = EMPTY_PLAN;
  if (preset === 'saving') {
    desired = { ...EMPTY_PLAN, recycler: defaultConfig.balance.modules.recycler.maxEnergy };
  } else if (preset === 'repeat') {
    if (!g.lastPlan) return false;
    desired = g.lastPlan;
  }
  const fitted = fitPlan(g, desired, ['recycler', 'shield', 'greenhouse', 'workshop']);
  plan.value = fitted;
  reserveWorkshop(g);
  return !samePlan(fitted, desired);
}

/**
 * Ejecuta el día con el plan actual. Ignora llamadas repetidas mientras se resuelve.
 * El estado nuevo se publica al terminar la animación. Devuelve true si el día arrancó.
 */
export function executeDay(): boolean {
  const g = game.value;
  if (!g || resolving.value || g.phase !== 'planning') return false;
  const current = plan.value;
  if (!validatePlan(g, current).ok) return false;

  const next = runDay(g, current);
  lastOutcome.value = { day: g.day, preview: previewDay(g, current) };
  resolving.value = true;

  const finish = (): void => {
    resolveTimer = null;
    game.value = next;
    plan.value = EMPTY_PLAN;
    resolving.value = false;
    if (next.phase !== 'ended') dayStates.value = [...dayStates.value, next];
    if (next.phase === 'ended') {
      tabletOpen.value = false;
      screen.value = 'debrief';
    } else if (next.phase === 'event') {
      tabletOpen.value = true; // el evento se decide en la tablet
    }
  };
  if (prefersReducedMotion()) finish();
  else resolveTimer = setTimeout(finish, RESOLVE_MS);
  return true;
}

/** Decide el evento pendiente. Se aplica una sola vez. Devuelve true si se aplicó. */
export function chooseEventOption(optionId: string): boolean {
  const g = game.value;
  if (!g || g.phase !== 'event' || !g.pendingEvent) return false;
  const option = g.pendingEvent.options.find((o) => o.id === optionId);
  if (!option || option.disabledReason) return false;
  const next = resolveEvent(g, optionId);
  game.value = next;
  reserveWorkshop(next);
  return true;
}

/** Pide reparar hoy un módulo averiado (o cancela con null). */
export function requestRepair(id: ModuleId | null): boolean {
  const g = game.value;
  if (!g || g.phase !== 'planning' || resolving.value) return false;
  if (id !== null && !g.modules[id].broken) return false;
  const next = setRepairToday(g, id);
  game.value = next;
  reserveWorkshop(next);
  return true;
}

/** La escena avisa de que el jugador usó algo del mundo. La tarea B-05 le dará más significado. */
export function interact(target: TargetId): void {
  if (target !== 'shelter' && target !== 'rover') focusModule.value = target;
  tabletOpen.value = true;
}

// Solo en desarrollo: acceso desde la consola del navegador para probar sin interfaz.
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  (window as unknown as Record<string, unknown>).__store = {
    screen, game, plan, resolving, lastOutcome, dayStates, rewindTo, nearTarget, tabletOpen, focusModule, budget, preview, realAssets,
    startGame, restart, exitToMenu, toggleTablet, setPlanValue, applyPreset, executeDay,
    chooseEventOption, requestRepair, interact,
  };
}
