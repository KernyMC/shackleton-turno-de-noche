// Conecta los sonidos con lo que pasa en la partida, sin tocar las reglas: observa el store.
//   - cada bloque de energía que se pone o se quita: un clic (más agudo cuanto más lleno)
//   - una tormenta solar: alarma; una avería: zumbido descendente
import { effect } from '@preact/signals';
import { defaultConfig } from '../sim/config';
import { game, plan, resolving } from '../state/store';
import {
  playBreakdown, playDayDone, playEnergyFlow, playRepairClank, playRepairDone, playRepairShuank, playStormAlarm, playTick,
} from './sfx';

export function startSoundWatcher(): () => void {
  let lastTotal: number | null = null;
  let lastDay = -1;
  let lastEvent: string | null = null;
  const maxTotal = Object.values(defaultConfig.balance.modules).reduce((a, m) => a + m.maxEnergy, 0);

  const stopPlan = effect(() => {
    const p = plan.value;
    const g = game.value;
    const total = Object.values(p).reduce((a, b) => a + b, 0);
    // Un día nuevo (o una partida nueva) reinicia el plan: eso no suena.
    if (!g || g.day !== lastDay || lastTotal === null) {
      lastDay = g?.day ?? -1;
      lastTotal = total;
      return;
    }
    if (total !== lastTotal) playTick(total / maxTotal);
    lastTotal = total;
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
