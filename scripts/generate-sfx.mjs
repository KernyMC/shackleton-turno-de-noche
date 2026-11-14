// Genera los efectos de sonido UNA vez con ElevenLabs (text-to-sound-effects) y los guarda en
// public/audio/sfx/. El juego nunca llama a la API: solo reproduce estos archivos.
// Uso: npm run sfx            (solo los que faltan)
//      npm run sfx -- --force (regenera todos)
// La clave ELEVEN_LABS se lee de .env y solo se usa en la cabecera de la petición.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'audio', 'sfx');
const force = process.argv.includes('--force');

try {
  process.loadEnvFile(join(root, '.env'));
} catch {
  /* sin .env: se intenta con el entorno */
}
const key = process.env.ELEVEN_LABS;
const { effects } = JSON.parse(readFileSync(join(root, 'public', 'data', 'sfx_lines.json'), 'utf8'));
mkdirSync(outDir, { recursive: true });

function writeIndex() {
  const ids = readdirSync(outDir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort();
  writeFileSync(join(outDir, 'index.json'), JSON.stringify({ ids }, null, 2) + '\n');
  return ids;
}

const todo = effects.filter((e) => force || !existsSync(join(outDir, `${e.id}.mp3`)));
if (todo.length === 0) {
  console.log('Nada que generar: todos los efectos existen (usa --force para regenerar).');
  console.log('Índice:', writeIndex().join(', ') || '(vacío)');
  process.exit(0);
}
if (!key) {
  console.error('Falta ELEVEN_LABS en .env. No se generó nada; el juego usa el respaldo sintetizado.');
  process.exit(1);
}

for (const e of todo) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_64', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: e.prompt, duration_seconds: e.duration, prompt_influence: e.influence }),
  }).catch((err) => {
    console.error(`${e.id}: error de red (${err.cause?.code ?? err.message}).`);
    return null;
  });
  if (!res) { process.exitCode = 1; break; }
  if (!res.ok) {
    const hint =
      res.status === 401 ? 'clave inválida o sin permiso (revisa ELEVEN_LABS)'
      : res.status === 402 ? 'plan sin acceso o sin créditos'
      : res.status === 422 ? 'parámetros rechazados'
      : res.status === 429 ? 'demasiadas peticiones o cuota agotada; espera y reintenta'
      : 'error del servicio';
    let detail = '';
    try {
      const j = await res.json();
      detail = typeof j?.detail === 'string' ? j.detail : (j?.detail?.message ?? j?.detail?.status ?? '');
    } catch {
      /* sin cuerpo JSON */
    }
    console.error(`${e.id}: HTTP ${res.status} - ${hint}${detail ? ` [${String(detail).slice(0, 160)}]` : ''}`);
    process.exitCode = 1;
    break;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(outDir, `${e.id}.mp3`), buf);
  const used = res.headers.get('character-cost');
  console.log(`${e.id}.mp3  ${(buf.length / 1024).toFixed(1)} KB${used ? `  (coste: ${used})` : ''}`);
}
console.log('Índice:', writeIndex().join(', '));
