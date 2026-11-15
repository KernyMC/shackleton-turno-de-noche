// Conecta los sonidos con lo que pasa en la partida, sin tocar las reglas: observa el store.
//   - cada bloque de energía que se pone (+): burbuja que sube; que se quita (−): burbuja que baja;
//     la nota sigue a lo llena que está la barra de ese módulo, y al llenarla suena un destello
//   - una tormenta solar: alarma; una avería: zumbido descendente
import { effect } from '@preact/signals';
import { maxEnergyFor } from '../sim/acts';
import { defaultConfig } from '../sim/config';
import { MODULE_IDS } from '../sim/types';
import type { Plan } from '../sim/types';
import { game, plan, resolving } from '../state/store';
import {
  playBreakdown, playDayDone, playEnergyFlow, playFull, playMinus, playPlus, playRepairClank, playRepairDone, playRepairShuank, playStormAlarm,
} from './sfx';

export function startSoundWatcher(): () => void {
  let lastPlan: Plan | null = null;
  let lastDay = -1;
  let lastEvent: string | null = null;

  const stopPlan = effect(() => {
    const p = plan.value;
    const g = game.value;
    // Un día nuevo (o una partida nueva) reinicia el plan: eso no suena.
    if (!g || g.day !== lastDay || lastPlan === null) {
      lastDay = g?.day ?? -1;
      lastPlan = p;
      return;
    }
    // Un plan rápido cambia varios módulos a la vez: suena solo el que más cambió.
    let id = MODULE_IDS[0]!;
    let delta = 0;
    for (const m of MODULE_IDS) {
      const d = p[m] - lastPlan[m];
      if (Math.abs(d) > Math.abs(delta)) {
        id = m;
        delta = d;
      }
    }
    if (delta !== 0) {
      const max = maxEnergyFor(g, id, defaultConfig);
      const fill = max > 0 ? p[id] / max : 0;
      if (delta > 0) {
        playPlus(fill);
        if (max > 0 && p[id] >= max) playFull();
      } else playMinus(fill);
    }
    lastPlan = p;
  });

  const stopEvents = effect(() => {
    const g = game.value;
    const ev = g?.phase === 'event' ? g.pendingEvent : null;
    const id = ev ? `${g!.day}-${ev.kind}` : null;
    if (id && id !== lastEvent) {
      if (ev!.kind === 'breakdown') playBreakdown();
      else if (ev!.kind === 'storm') playStormAlarm();
      else playDayDone();
    }
    lastEvent = id;
  });

  // Al pasar el día: energía fluyendo; si había reparación, clank, clank, shuank.
  // El éxito se conoce cuando el estado nuevo se publica (entrada log.repair.done de ese día).
  const timers: ReturnType<typeof setTimeout>[] = [];
  let repairDay: number | null = null;
  let repairFrom: unknown = null;
  const later = (fn: () => void, ms: number): void => {
    timers.push(setTimeout(fn, ms));
  };
  let wasResolving = false;
  const stopResolve = effect(() => {
    const r = resolving.value;
    const g = game.peek();
    if (r && !wasResolving) {
      playEnergyFlow();
      if (g?.repairToday) {
        repairDay = g.day;
        repairFrom = g;
        later(playRepairClank, 0);
        later(playRepairClank, 350);
        later(playRepairShuank, 700);
      }
    }
    wasResolving = r;
  });
  const stopRepairDone = effect(() => {
    const g = game.value;
    if (repairDay !== null && g && g !== repairFrom) {
      if (g.log.some((l) => l.day === repairDay && l.key === 'log.repair.done')) playRepairDone();
      repairDay = null;
    }
  });

  return () => {
    timers.forEach(clearTimeout);
    stopResolve();
    stopRepairDone();
    stopPlan();
    stopEvents();
  };
}
