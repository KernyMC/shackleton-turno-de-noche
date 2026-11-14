// Recompensas visibles, sin trampas de tiempo ni monedas: cada día completado da una frase de la
// tripulación, la cosecha se puede recoger (o se recoge sola), y los hitos se celebran.
// Solo observa el store; no cambia reglas del juego.

import { effect, signal } from '@preact/signals';
import { CREW } from '../data/crew';
import type { CrewId } from '../data/crew';
import { defaultConfig } from '../sim/config';
import type { DaySnapshot, GameState, LogEntry, ModuleId } from '../sim/types';
import { fastForwarding, game, gameId, screen } from './store';

export type MilestoneId = 'first_harvest' | 'first_night' | 'storm_safe';

export interface FloatItem {
  key: number;
  module: ModuleId;
  /** Ícono del recurso y número a mostrar. */
  icon: 'life_support' | 'food' | 'dose' | 'check';
  text: string;
  /** Zona del HUD hacia la que viaja. */
  target: 'vitals' | 'dose' | 'none';
}

export interface DayNote {
  key: number;
  day: number;
  crew: CrewId;
  phrase: string; // clave i18n
  mood: 'happy' | 'worried';
}

/** Puntos de experiencia: solo un número visual. */
export const xp = signal(0);
export const floats = signal<FloatItem[]>([]);
export const harvest = signal<{ key: number; amount: number } | null>(null);
export const dayNote = signal<DayNote | null>(null);
export const milestone = signal<MilestoneId | null>(null);
/** Día recién completado (para el aviso "ahora planifica el siguiente"). */
export const dayDone = signal<{ key: number; day: number } | null>(null);
export const earned = signal<MilestoneId[]>([]);
/** Tras ejecutar un día, la base reacciona unos instantes antes de volver al panel. */
export const reacting = signal(false);
/** Duración de la reacción (números que salen de los módulos y voz de la tripulación). */
export const REACT_MS = 1900;
let reactTimer: ReturnType<typeof setTimeout> | null = null;

let counter = 0;

/** Firma de una entrada del registro: sirve para no repetir un aviso al volver atrás en el tiempo. */
export function entrySig(e: LogEntry): string {
  return `${e.day}|${e.key}|${e.vars ? JSON.stringify(e.vars) : ''}`;
}

/** Entradas del registro que empiezan por `prefix`, que aún no están en `seen`. Las anota como vistas. */
export function freshEntries(log: readonly LogEntry[], seen: Set<string>, prefixes: readonly string[]): LogEntry[] {
  const fresh: LogEntry[] = [];
  for (const e of log) {
    if (!prefixes.some((p) => e.key === p || e.key.startsWith(p + '.'))) continue;
    const sig = entrySig(e);
    if (seen.has(sig)) continue;
    seen.add(sig);
    fresh.push(e);
  }
  return fresh;
}

/** Lo que aportó cada módulo en un día (solo para mostrar; el motor ya lo aplicó). */
export function dayYields(snap: DaySnapshot, broken: Record<ModuleId, boolean>, difficulty: GameState['difficulty']): FloatItem[] {
  const b = defaultConfig.balance;
  const fx = b.effects;
  const e = (id: ModuleId): number => (broken[id] ? 0 : snap.plan[id] / b.modules[id].maxEnergy);
  const items: FloatItem[] = [];
  const r1 = (n: number): string => (Math.round(n * 10) / 10).toString();
  if (e('recycler') > 0) items.push({ key: ++counter, module: 'recycler', icon: 'life_support', text: `+${r1(fx.recyclerLifeSupport * e('recycler'))}`, target: 'vitals' });
  if (e('greenhouse') > 0 && !snap.sheltered) items.push({ key: ++counter, module: 'greenhouse', icon: 'food', text: `+${r1(fx.greenhouseFood * e('greenhouse'))}`, target: 'vitals' });
  if (e('shield') > 0) {
    const saved = b.difficulty[difficulty].doseBaseDaily * fx.shieldReduction * e('shield');
    items.push({ key: ++counter, module: 'shield', icon: 'dose', text: `−${r1(saved)}`, target: 'dose' });
  }
  return items;
}

/** Ánimo de cada tripulante de 0 a 100, según el recurso que cuida. */
export function moodOf(g: GameState): Record<CrewId, number> {
  const d = defaultConfig.balance.difficulty[g.difficulty];
  return {
    valeria: g.lifeSupport,
    mateo: g.food,
    amaru: 100 - (g.dose / d.doseLimit) * 100,
    lucia: Object.values(g.modules).some((m) => m.broken) ? 0 : (g.battery / d.batteryCapacity) * 100,
  };
}

/** Gesto del retrato a partir del ánimo. */
export function faceOf(value: number): 'happy' | 'neutral' | 'worried' {
  if (value > 50) return 'happy';
  if (value > 25) return 'neutral';
  return 'worried';
}

/** Hitos ganados durante el avance rápido: se muestran al detenerse. */
let deferred: MilestoneId[] = [];

function celebrate(id: MilestoneId): void {
  if (earned.value.includes(id)) return;
  earned.value = [...earned.value, id];
  if (fastForwarding.peek()) deferred.push(id);
  else milestone.value = id;
}

/** La cosecha se recoge sola tras este tiempo: tocarla es un extra, nunca una obligación. */
const HARVEST_MS = 2600;
let harvestTimer: ReturnType<typeof setTimeout> | null = null;

/** Muestra la ficha de cosecha y programa su recogida automática. */
function offerHarvest(amount: number): void {
  if (harvestTimer) clearTimeout(harvestTimer);
  harvest.value = { key: ++counter, amount };
  harvestTimer = setTimeout(() => collectHarvest(false), HARVEST_MS);
}

/** El jugador toca la burbuja de cosecha (o se recoge sola). */
export function collectHarvest(byPlayer: boolean): void {
  if (harvestTimer) clearTimeout(harvestTimer);
  harvestTimer = null;
  const h = harvest.value;
  if (!h) return;
  harvest.value = null;
  xp.value += byPlayer ? 15 : 5;
  celebrate('first_harvest');
}

export function dismissMilestone(): void {
  milestone.value = null;
}

let lastGame = -1;
let lastDays = 0;

/** Observa las partidas. Se llama una vez al montar la app; devuelve cómo detenerlo. */
export function startRewardsWatcher(): () => void {
  // Al detenerse el avance rápido salen los hitos que se ganaron mientras corría (uno a la vez).
  const stopFlush = effect(() => {
    if (fastForwarding.value || deferred.length === 0) return;
    const [first] = deferred;
    deferred = [];
    if (first && screen.peek() === 'game') milestone.value = first;
  });
  const stopMain = effect(() => {
    const g = game.value;
    if (!g || screen.value === 'menu') return;
    if (gameId.value !== lastGame) {
      lastGame = gameId.value;
      lastDays = g.history.length;
      xp.value = 0;
      earned.value = [];
      floats.value = [];
      harvest.value = null;
      dayNote.value = null;
      dayDone.value = null;
      reacting.value = false;
      deferred = [];
      return;
    }
    const days = g.history.length;
    if (days <= lastDays) {
      lastDays = days; // volvió atrás (reintento): no se repiten recompensas
      return;
    }
    lastDays = days;
    const snap = g.history[days - 1]!;
    const broken = Object.fromEntries(Object.entries(g.modules).map(([id, m]) => [id, m.broken])) as Record<ModuleId, boolean>;

    // Avance rápido: sin números flotantes, cosecha, voz ni aviso de día (serían un parpadeo
    // continuo). Los hitos que se ganen se guardan y salen al detenerse.
    if (fastForwarding.peek()) {
      floats.value = [];
      harvest.value = null;
      dayNote.value = null;
      dayDone.value = null;
      xp.value += 10;
      const lastNightFF = Math.max(...defaultConfig.light.nightDays);
      if (snap.day === lastNightFF && g.phase !== 'ended') celebrate('first_night');
      if (snap.sheltered && g.result?.outcome !== 'loss') celebrate('storm_safe');
      return;
    }

    floats.value = dayYields(snap, broken, g.difficulty);
    dayDone.value = g.phase === 'ended' ? null : { key: ++counter, day: snap.day };
    xp.value += 10;
    reacting.value = true;
    if (reactTimer) clearTimeout(reactTimer);
    reactTimer = setTimeout(() => (reacting.value = false), REACT_MS);

    const greenhouseWorked = snap.plan.greenhouse > 0 && !snap.sheltered && !broken.greenhouse;
    if (greenhouseWorked) offerHarvest(snap.plan.greenhouse);

    // Voz del día: habla quien está preocupado; si todos están bien, se turnan y un día de cada
    // dos hay silencio (una voz que habla siempre se vuelve ruido).
    const moods = moodOf(g);
    const worst = (Object.entries(moods) as [CrewId, number][]).sort((a, b) => a[1] - b[1])[0]!;
    if (worst[1] <= 25) {
      dayNote.value = { key: ++counter, day: snap.day, crew: worst[0], phrase: `crew.${worst[0]}.worried`, mood: 'worried' };
    } else if (snap.day % 2 === 1) {
      const speaker = CREW[snap.day % CREW.length]!.id;
      dayNote.value = { key: ++counter, day: snap.day, crew: speaker, phrase: `crew.${speaker}.good`, mood: 'happy' };
    } else {
      dayNote.value = null;
    }

    // Hitos.
    const lastNight = Math.max(...defaultConfig.light.nightDays);
    if (snap.day === lastNight && g.phase !== 'ended') celebrate('first_night');
    if (snap.sheltered && g.result?.outcome !== 'loss') celebrate('storm_safe');
  });
  return () => {
    stopFlush();
    stopMain();
  };
}
