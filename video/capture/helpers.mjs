// Ayudas dentro de la página (solo en `npm run dev`: usan window.__store y los módulos de Vite).
import { wait } from './lib.mjs';

/** Carga la jugadora «prudente» del propio motor en window.__auto. */
export async function installAuto(page) {
  await page.evaluate(async () => {
    const { prudent } = await import('/src/sim/strategies.ts');
    const { defaultConfig } = await import('/src/sim/config.ts');
    window.__auto = { prudent, cfg: defaultConfig };
  });
}

/** Pone el plan de la prudente para el día actual (sin pasar el día). */
export async function autoPlan(page) {
  await page.evaluate(() => {
    const s = window.__store;
    const { prudent, cfg } = window.__auto;
    s.plan.value = prudent.plan(s.game.value, cfg);
  });
}

/**
 * Juega días hasta que se cumpla `until(state)` (evaluado en la página) o acabe la partida.
 * Resuelve retos como «perfect» y eventos con la elección de la prudente, salvo `stopOnEvent`.
 */
export async function advance(page, untilSrc, { stopOnEvent = false, stopOnChallenge = false, max = 40 } = {}) {
  for (let i = 0; i < max; i++) {
    const r = await page.evaluate(
      ({ untilSrc, stopOnEvent, stopOnChallenge }) => {
        const s = window.__store;
        const { prudent, cfg } = window.__auto;
        const g = s.game.value;
        if (!g) return 'nogame';
        if (s.resolving.value) return 'busy';
        const until = new Function('g', `return (${untilSrc})`);
        if (until(g)) return 'done';
        if (g.phase === 'ended') return 'ended';
        if (s.activeChallenge.value) {
          if (stopOnChallenge) return 'challenge';
          s.completeChallenge('perfect');
          return 'step';
        }
        if (g.phase === 'event') {
          if (stopOnEvent) return 'event';
          s.chooseEventOption(prudent.choose(g, cfg));
          return 'step';
        }
        if (g.phase === 'planning') {
          s.plan.value = prudent.plan(g, cfg);
          s.executeDay();
          return 'step';
        }
        return 'busy';
      },
      { untilSrc, stopOnEvent, stopOnChallenge },
    );
    if (r === 'done' || r === 'ended' || r === 'event' || r === 'challenge' || r === 'nogame') return r;
    await wait(r === 'busy' ? 250 : 400);
    i -= r === 'busy' ? 0.9 : 0;
  }
  return 'max';
}

export async function state(page) {
  return page.evaluate(() => {
    const s = window.__store;
    const g = s.game.value;
    return g && { day: g.day, phase: g.phase, ev: g.pendingEvent?.kind ?? g.pendingEvent?.id ?? null, chl: s.activeChallenge.value?.def.id ?? null, screen: s.screen.value, result: g.result };
  });
}
