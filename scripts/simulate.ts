// Corre muchas partidas automáticas para medir el balance. Uso: npm run simulate [-- 1000]
// Objetivos (docs/tasks/A-motor.md, A-05): prudente ≥ 70 % en Comandante y ≥ 90 % en Cadete;
// todo-al-reciclador ≤ 10 % en Comandante; aleatoria ≤ 25 %. Además: la prudente no pierde antes del día 6
// (acto 1 fácil) y se informa de cuántos objetivos de acto cumple en promedio (de 5).
// Las estrategias respetan los desbloqueos (módulos bloqueados = 0 de energía).

import { existsSync, readFileSync } from 'node:fs';
import { buildConfig } from '../src/sim/config';
import { allRecycler, playGame, prudent, randomPlayer } from '../src/sim/strategies';
import type { Difficulty } from '../src/sim/types';

const games = Number(process.argv[2] ?? 1000);
// Fuera de Vite no hay import.meta.glob: se lee storms_real.json a mano, igual que lo usa el juego.
const realPath = 'public/data/storms_real.json';
const cfg = buildConfig(existsSync(realPath) ? JSON.parse(readFileSync(realPath, 'utf8')) : null);
console.log(`Tormentas: ${cfg.stormSource.file} (${cfg.storms.length})`);
const rows: Record<string, string | number>[] = [];

for (const difficulty of ['cadete', 'comandante'] as Difficulty[]) {
  for (const strategy of [allRecycler, prudent, randomPlayer]) {
    let wins = 0;
    let lossDays = 0;
    const stars = [0, 0, 0, 0];
    const causes: Record<string, number> = {};
    let actsMet = 0;
    let earlyLosses = 0;
    for (let seed = 1; seed <= games; seed++) {
      const final = playGame(seed, difficulty, strategy, cfg);
      const result = final.result!;
      actsMet += final.actsMet.length;
      if (result.outcome === 'loss' && result.day < 6) earlyLosses++;
      stars[result.stars]!++;
      if (result.outcome === 'win') wins++;
      else {
        lossDays += result.day;
        const main = result.causes[0]!;
        causes[main] = (causes[main] ?? 0) + 1;
      }
    }
    const losses = games - wins;
    rows.push({
      dificultad: difficulty,
      estrategia: strategy.name,
      'victorias %': Math.round((wins / games) * 1000) / 10,
      'día medio derrota': losses ? Math.round((lossDays / losses) * 10) / 10 : '-',
      'actos cumplidos (de 5)': Math.round((actsMet / games) * 100) / 100,
      'derrotas antes del día 6': earlyLosses,
      'estrellas 1/2/3': `${stars[1]}/${stars[2]}/${stars[3]}`,
      causas: Object.entries(causes).map(([k, v]) => `${k}:${v}`).join(' ') || '-',
    });
  }
}
console.table(rows);
