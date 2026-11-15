// npm run data:supabase
// Sube una copia de cada public/data/*.json a la tabla public.game_data de Supabase (respaldo).
// La fuente principal sigue siendo el JSON del repo: este script solo replica.
// Necesita en .env: SUPABASE_URL y SUPABASE_SECRET_KEY (clave secreta, nunca en el navegador ni en el repo).
import { readdirSync, readFileSync } from 'node:fs';

try {
  process.loadEnvFile('.env');
} catch {
  // sin .env: se usan las variables del entorno
}

const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en .env');
  process.exit(1);
}

const rows = readdirSync('public/data')
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({
    name: f.replace(/\.json$/, ''),
    data: JSON.parse(readFileSync(`public/data/${f}`, 'utf8')),
    updated_at: new Date().toISOString(),
  }));

const res = await fetch(`${url}/rest/v1/game_data?on_conflict=name`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify(rows),
});
if (!res.ok) {
  console.error(`Supabase respondió ${res.status}: ${await res.text()}`);
  process.exit(1);
}
console.log(`Subidos ${rows.length} archivos a game_data: ${rows.map((r) => r.name).join(', ')}`);
