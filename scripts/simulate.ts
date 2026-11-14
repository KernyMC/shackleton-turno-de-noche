// Corre muchas partidas automáticas para medir el balance. Uso: npm run simulate [-- 1000]
// Objetivos (docs/tasks/A-motor.md, A-05): prudente ≥ 70 % en Comandante y ≥ 90 % en Cadete;
// todo-al-reciclador ≤ 10 % en Comandante; aleatoria ≤ 25 %.

import { allRecycler, playGame, prudent, randomPlayer } from '../src/sim/strategies';
import type { Difficulty } from '../src/sim/types';

const games = Number(process.argv[2] ?? 1000);
const rows: Record<string, string | number>[] = [];

for (const difficulty of ['cadete', 'comandante'] as Difficulty[]) {
  for (const strategy of [allRecycler, prudent, randomPlayer]) {
    let wins = 0;
    let lossDays = 0;
    const stars = [0, 0, 0, 0];
    const causes: Record<string, number> = {};
    for (let seed = 1; seed <= games; seed++) {
      const result = playGame(seed, difficulty, strategy).result!;
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
      'estrellas 1/2/3': `${stars[1]}/${stars[2]}/${stars[3]}`,
      causas: Object.entries(causes).map(([k, v]) => `${k}:${v}`).join(' ') || '-',
    });
  }
}
console.table(rows);
