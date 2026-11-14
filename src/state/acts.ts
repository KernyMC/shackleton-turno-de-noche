// Actos de la partida en la interfaz: la tarjeta de acto, los avisos cortos (meta cumplida o no,
// módulo desbloqueado, motivo por el que paró el avance rápido) y el destello de una columna nueva.
// Solo observa el store; el motor ya decidió todo (src/sim/acts.ts). Un solo aviso a la vez:
// los demás esperan su turno y nunca se montan encima de un evento, de la guía o del día que acaba.
import { effect, signal } from '@preact/signals';
import { actOf } from '../sim/acts';
import type { StopReason } from '../sim/fastForward';
import type { ModuleId } from '../sim/types';
import { readyScreen } from './loading';
import { dayDone, entrySig, freshEntries, milestone, reacting } from './rewards';
import { ffStop, fastForwarding, game, gameId, resolving, screen } from './store';
import { gameMode } from './mode';
import { onboardingOpen, tutorialEnd, tutorialStep } from './tutorial';

/** Cuánto dura la tarjeta de acto (se cierra antes con un toque). */
export const ACT_CARD_MS = 4500;
export const TOAST_MS = { met: 2500, missed: 2500, unlock: 3000, stop: 4000 } as const;
/** Espera tras la pantalla de carga antes de enseñar la primera tarjeta. */
const SETTLE_MS = 1300;
/** Pausa entre un aviso y el siguiente. */
const GAP_MS = 350;

export type ToastKind = keyof typeof TOAST_MS;
export interface Toast {
  key: number;
  kind: ToastKind;
  /** Acto (met/missed). */
  act?: number;
  module?: ModuleId;
  reason?: StopReason;
  /** Día en que paró el avance rápido: el aviso se retira si el jugador ya pasó a otro día. */
  day?: number;
}
export interface ActCardInfo {
  key: number;
  act: number;
}

/** Tarjeta de acto a pantalla completa (null = ninguna). */
export const actCard = signal<ActCardInfo | null>(null);
/** Aviso compacto visible ahora (null = ninguno). */
export const toast = signal<Toast | null>(null);
/** Columna que se acaba de desbloquear: hace un destello una vez. */
export const unlockFlash = signal<{ key: number; module: ModuleId } | null>(null);
/** Se incrementa para despertar al planificador de turnos. */
const tick = signal(0);
const poke = (): void => void (tick.value = tick.peek() + 1);

type Item = { type: 'card'; act: number } | { type: 'toast'; toast: Omit<Toast, 'key'> };
let queue: Item[] = [];
let counter = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;
let gapUntil = 0;
let shownActs = new Set<number>();
let seenLog = new Set<string>();
let lastGame = -1;
let lastAct = 0;

const settled = signal(false);

function clearTimer(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

function enqueue(item: Item, front = false): void {
  if (front) queue.unshift(item);
  else queue.push(item);
  poke();
}

/** Cierra lo que se esté mostrando (un toque, Enter, Esc o Espacio en la tarjeta). */
export function dismissActCard(): void {
  clearTimer();
  actCard.value = null;
  gapUntil = Date.now() + GAP_MS;
  poke();
}

export function dismissToast(): void {
  clearTimer();
  toast.value = null;
  gapUntil = Date.now() + GAP_MS;
  poke();
}

/** Vuelve a leer la tarjeta del acto actual (la pastilla del objetivo). Va por delante de la cola. */
export function showActCardNow(act: number): void {
  clearTimer();
  toast.value = null;
  actCard.value = { key: ++counter, act };
  timer = setTimeout(dismissActCard, ACT_CARD_MS);
}

function show(item: Item): void {
  clearTimer();
  if (item.type === 'card') {
    actCard.value = { key: ++counter, act: item.act };
    timer = setTimeout(dismissActCard, ACT_CARD_MS);
  } else {
    toast.value = { ...item.toast, key: ++counter };
    if (item.toast.kind === 'unlock' && item.toast.module) {
      unlockFlash.value = { key: counter, module: item.toast.module };
      if (flashTimer !== null) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => (unlockFlash.value = null), 3500);
    }
    timer = setTimeout(dismissToast, TOAST_MS[item.toast.kind]);
  }
}

function reset(): void {
  clearTimer();
  queue = [];
  poke();
  actCard.value = null;
  toast.value = null;
  unlockFlash.value = null;
  shownActs = new Set();
  seenLog = new Set();
  lastAct = 0;
}

/**
 * Observa la partida. Se llama una vez al montar la app; devuelve cómo detenerlo.
 * Tres cosas: (1) detecta actos nuevos, entradas nuevas del registro y paradas del avance rápido y
 * las pone en cola; (2) decide cuándo hay sitio para el siguiente; (3) lo muestra y lo retira solo.
 */
export function startActsWatcher(): () => void {
  // La pantalla de carga se retira ~1,3 s después de que la escena avise: hasta entonces no se muestra nada.
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  const stopSettle = effect(() => {
    const ok = screen.value === 'game' && readyScreen.value === 'game';
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = null;
    if (!ok) {
      settled.value = false;
      return;
    }
    settleTimer = setTimeout(() => (settled.value = true), SETTLE_MS);
  });

  const stopDetect = effect(() => {
    const g = game.value;
    const id = gameId.value;
    if (!g || screen.value !== 'game') {
      if (screen.value === 'menu') lastGame = -1;
      return;
    }
    if (id !== lastGame) {
      lastGame = id;
      reset();
      seenLog = new Set(g.log.map(entrySig));
    }
    // Un aviso de parada deja de valer cuando el jugador ya decidió y el día cambió.
    const shown = toast.peek();
    if (shown?.kind === 'stop' && shown.day !== g.day) dismissToast();
    queue = queue.filter((q) => !(q.type === 'toast' && q.toast.kind === 'stop' && q.toast.day !== g.day));
    // Entradas nuevas del registro: meta cumplida o no, módulos desbloqueados.
    for (const e of freshEntries(g.log, seenLog, ['log.act.met', 'log.act.missed', 'log.unlock'])) {
      if (e.key === 'log.act.met') enqueue({ type: 'toast', toast: { kind: 'met', act: Number(e.vars?.act) } });
      else if (e.key === 'log.act.missed') enqueue({ type: 'toast', toast: { kind: 'missed', act: Number(e.vars?.act) } });
      else enqueue({ type: 'toast', toast: { kind: 'unlock', module: e.vars?.module as ModuleId } });
    }
    // Acto nuevo (solo hacia delante): una tarjeta por acto y partida. Volver atrás no la repite.
    const act = actOf(g.day).id;
    // En el tutorial no hay tarjeta de acto: la guía ya cuenta la meta del acto 1.
    if (act > lastAct && !shownActs.has(act)) {
      shownActs.add(act);
      if (gameMode.peek() !== 'tutorial') enqueue({ type: 'card', act });
    }
    lastAct = Math.max(lastAct, act);
  });

  // Por qué paró el avance rápido. 'end' va al debrief; 'act' ya lo cuenta la tarjeta del acto.
  const stopStop = effect(() => {
    const s = ffStop.value;
    if (!s || s.reason === 'end' || s.reason === 'act') return;
    enqueue({ type: 'toast', toast: { kind: 'stop', reason: s.reason, day: s.day } }, true); // explica por qué se detuvo: va primero
  });

  // Planificador de turnos: un aviso a la vez, solo cuando no estorba.
  let ffHold = false;
  const stopPump = effect(() => {
    void tick.value;
    // Al terminar el avance rápido, la razón de la parada llega unos instantes después: se espera un poco.
    if (fastForwarding.value) ffHold = true;
    else if (ffHold) {
      ffHold = false;
      const t0 = setTimeout(poke, 60);
      return () => clearTimeout(t0);
    }
    const g = game.value;
    const busy = actCard.value !== null || toast.value !== null;
    const blocked =
      !g ||
      !settled.value ||
      resolving.value ||
      fastForwarding.value ||
      reacting.value ||
      dayDone.value !== null ||
      milestone.value !== null ||
      tutorialEnd.value ||
      g.phase === 'ended';
    if (busy || blocked || queue.length === 0) return;
    const wait = gapUntil - Date.now();
    if (wait > 0) {
      const t0 = setTimeout(poke, wait);
      return () => clearTimeout(t0);
    }
    // La tarjeta de acto espera a que no haya evento pendiente ni guía ni presentación; los avisos cortos no.
    const cardBlocked = g.phase === 'event' || tutorialStep.value === 'welcome' || onboardingOpen.value;
    const idx = queue.findIndex((item) => item.type === 'toast' || !cardBlocked);
    if (idx < 0) return;
    const [item] = queue.splice(idx, 1);
    if (item) show(item);
  });

  return () => {
    if (settleTimer !== null) clearTimeout(settleTimer);
    clearTimer();
    stopSettle();
    stopDetect();
    stopStop();
    stopPump();
  };
}
