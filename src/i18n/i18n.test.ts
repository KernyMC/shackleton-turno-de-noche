// Guardián de textos: ninguna clave puede faltar en español o en inglés.
// Existe porque una vez se subió un evento del motor sin sus textos y en pantalla salió
// "event.dust.title". Si este test falla, AÑADE el texto; no lo silencies.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../sim/config';
import { createGame, getEventOptions, resolveEvent, runDay } from '../sim/engine';
import { allRecycler, prudent, randomPlayer } from '../sim/strategies';
import { MODULE_IDS } from '../sim/types';
import type { Difficulty, GameState } from '../sim/types';
import en from './en.json';
import es from './es.json';

const ES = es as Record<string, string>;
const EN = en as Record<string, string>;
const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** Juega partidas con varias estrategias y junta todo lo que el motor puede pedir que se muestre. */
function engineKeys(): { logs: Set<string>; events: Set<string>; reasons: Set<string> } {
  const logs = new Set<string>();
  const events = new Set<string>();
  const reasons = new Set<string>();
  const note = (state: GameState): void => {
    for (const entry of state.log) logs.add(entry.key);
    const ev = state.pendingEvent;
    if (state.phase === 'event' && ev) {
      events.add(`event.${ev.kind}.title`);
      events.add(`event.${ev.kind}.text`);
      for (const option of getEventOptions(state, ev)) {
        events.add(`event.${ev.kind}.option.${option.id}`);
        if (option.disabledReason) reasons.add(option.disabledReason);
      }
    }
  };
  for (const difficulty of ['cadete', 'comandante'] as Difficulty[]) {
    for (const strategy of [prudent, allRecycler, randomPlayer]) {
      for (let seed = 1; seed <= 40; seed++) {
        let state = createGame(seed, difficulty);
        note(state);
        for (let guard = 0; guard < 500 && state.phase !== 'ended'; guard++) {
          if (state.phase === 'event') {
            // Alterna la opción elegida para recorrer las dos ramas de cada evento.
            const options = getEventOptions(state, state.pendingEvent!).filter((o) => !o.disabledReason);
            const pick = options[(seed + guard) % options.length] ?? options[0];
            state = resolveEvent(state, pick ? pick.id : strategy.choose(state, defaultConfig));
          } else {
            state = runDay(state, strategy.plan(state, defaultConfig));
          }
          note(state);
        }
      }
    }
  }
  return { logs, events, reasons };
}

describe('textos (i18n)', () => {
  it('español e inglés tienen exactamente las mismas claves', () => {
    const onlyEs = Object.keys(ES).filter((k) => !(k in EN));
    const onlyEn = Object.keys(EN).filter((k) => !(k in ES));
    expect({ soloEnEs: onlyEs, soloEnEn: onlyEn }).toEqual({ soloEnEs: [], soloEnEn: [] });
  });

  it('ningún texto está vacío y las variables {así} coinciden en los dos idiomas', () => {
    const problems: string[] = [];
    for (const key of Object.keys(ES)) {
      if (!ES[key]?.trim() || !EN[key]?.trim()) problems.push(`vacío: ${key}`);
      else if (placeholders(ES[key]!).join() !== placeholders(EN[key]!).join()) problems.push(`variables distintas: ${key}`);
    }
    expect(problems).toEqual([]);
  });

  it('toda clave escrita en el código con t("…") existe', () => {
    const missing = new Set<string>();
    for (const file of sourceFiles('src')) {
      const code = readFileSync(file, 'utf8');
      for (const m of code.matchAll(/\bt\(\s*'([a-z0-9_.]+)'|\bt\(\s*"([a-z0-9_.]+)"/gi)) {
        const key = (m[1] ?? m[2])!;
        if (key.includes('.') && !(key in ES)) missing.add(`${key}  ←  ${file.replace(/\\/g, '/')}`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('todo evento, opción, aviso y línea de bitácora que genera el motor tiene texto', () => {
    const { logs, events, reasons } = engineKeys();
    const missing = [...logs, ...events, ...reasons].filter((key) => !(key in ES) || !(key in EN));
    expect(missing).toEqual([]);
    // Si el motor deja de generar eventos, este test no estaría probando nada.
    expect(events.size).toBeGreaterThan(10);
    expect(logs.size).toBeGreaterThan(8);
  });

  it('módulos, tripulación y actos tienen sus textos', () => {
    const needed = [
      ...MODULE_IDS.flatMap((id) => [`module.${id}`, `module.${id}.what`]),
      ...['valeria', 'mateo', 'amaru', 'lucia'].flatMap((id) => [`crew.${id}.role`, `crew.${id}.good`, `crew.${id}.worried`, `crew.act.${id}`]),
      ...defaultConfig.balance.acts.list.flatMap((act) => [`act.${act.id}.name`, `act.${act.id}.goal`, `act.${act.id}.pill`]),
      ...['event', 'low', 'night_soon', 'invalid_plan', 'max'].map((r) => `ff.stopped.${r}`),
    ];
    expect(needed.filter((key) => !(key in ES) || !(key in EN))).toEqual([]);
  });
});
