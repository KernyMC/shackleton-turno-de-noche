// Genera UNA vez las voces de la guía del tutorial con ElevenLabs (texto a voz) y las guarda en
// public/audio/voice/<idioma>/<clave>.mp3. El juego nunca llama a la API: solo reproduce estos archivos.
// Cada burbuja la dice el tripulante que la firma (src/state/coachFacts.ts), con una voz por persona
// e idioma. index.json guarda el texto exacto de cada audio: si el texto del juego cambia, ese audio
// deja de sonar (no dice algo distinto de lo que se lee) hasta que se regenera.
// Uso: npm run voices            (solo las que faltan o cuyo texto cambió)
//      npm run voices -- --force (regenera todas)
// La clave ELEVEN_LABS se lee de .env y solo se usa en la cabecera de la petición.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CrewId } from '../src/data/crew';
import en from '../src/i18n/en.json';
import es from '../src/i18n/es.json';
import { coachFacts, COACH_SPEAKER, WARN_SPEAKER } from '../src/state/coachFacts';

type Lang = 'es' | 'en';
interface Entry {
  text: string;
  speaker: CrewId;
}
type Index = Record<Lang, Record<string, Entry>>;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'audio', 'voice');
const force = process.argv.includes('--force');
try {
  process.loadEnvFile(join(root, '.env'));
} catch {
  /* sin .env: se intenta con el entorno */
}
const key = process.env.ELEVEN_LABS;

/** Reparto de voces (biblioteca de ElevenLabs). Español con acento latinoamericano. */
const VOICES: Record<Lang, Record<CrewId, { id: string; name: string }>> = {
  es: {
    valeria: { id: 'Czw3Dn181ypdrCOnPfif', name: 'Brian C' }, // Eduardo
    mateo: { id: 'i4Kar2uamCWyas8TAu31', name: 'Adán' }, // Christopher
    amaru: { id: 'Wl3O9lmFSMgGFTTwuS6f', name: 'Martin Alvarez' }, // Kevin
    lucia: { id: 'P0zSUl3c6tjweeuBGjgP', name: 'Ery' }, // Vanessa
  },
  en: {
    valeria: { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris' },
    mateo: { id: 'bIHbv24MWmeRgasZH58o', name: 'Will' },
    amaru: { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian' },
    lucia: { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica' },
  },
};
const DICTS: Record<Lang, Record<string, string>> = { es, en };

function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, n: string) => (n in vars ? String(vars[n]) : m));
}

/** Lo que se lee en voz alta: los signos de los botones se dicen con palabras. */
function spoken(text: string, lang: Lang): string {
  const plus = lang === 'es' ? 'más' : 'plus';
  const minus = lang === 'es' ? 'menos' : 'minus';
  return text.replace(/«|»/g, '"').replace(/\s\+(?=\s)/g, ` ${plus}`).replace(/\s[−-](?=[\s.,])/g, ` ${minus}`);
}

/** Todas las líneas con voz: cada burbuja del tutorial (menos la presentación) y los dos avisos. */
function lines(lang: Lang): Record<string, Entry> {
  const vars = coachFacts('cadete', 1);
  const out: Record<string, Entry> = {};
  for (const [step, speaker] of Object.entries(COACH_SPEAKER)) {
    if (step === 'welcome') continue;
    const k = `coach.${step}`;
    out[k] = { text: fill(DICTS[lang][k]!, vars), speaker };
  }
  for (const [k, speaker] of Object.entries(WARN_SPEAKER)) out[k] = { text: fill(DICTS[lang][k]!, vars), speaker };
  return out;
}

const indexPath = join(outDir, 'index.json');
const old: Index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : { es: {}, en: {} };
const next: Index = { es: {}, en: {} };
const todo: { lang: Lang; k: string; e: Entry }[] = [];
for (const lang of ['es', 'en'] as const) {
  mkdirSync(join(outDir, lang), { recursive: true });
  for (const [k, e] of Object.entries(lines(lang))) {
    const same = old[lang]?.[k]?.text === e.text && old[lang]?.[k]?.speaker === e.speaker;
    if (!force && same && existsSync(join(outDir, lang, `${k}.mp3`))) next[lang][k] = e;
    else todo.push({ lang, k, e });
  }
}
const save = (): void => writeFileSync(indexPath, JSON.stringify(next, null, 2) + '\n');

if (todo.length === 0) {
  save();
  console.log('Nada que generar: todas las voces existen y su texto no cambió (usa --force para regenerar).');
  process.exit(0);
}
if (!key) {
  console.error('Falta ELEVEN_LABS en .env. No se generó nada; el tutorial queda solo con texto.');
  process.exit(1);
}
console.log(`Generando ${todo.length} voces (${todo.reduce((a, x) => a + x.e.text.length, 0)} caracteres)…`);

let failed = 0;
for (const { lang, k, e } of todo) {
  const voice = VOICES[lang][e.speaker];
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: spoken(e.text, lang),
      model_id: 'eleven_multilingual_v2',
      language_code: lang,
      voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    failed++;
    const why = res.status === 401 ? 'clave inválida o sin permiso de texto a voz (revisa ELEVEN_LABS)' : (await res.text()).slice(0, 200);
    console.error(`✗ ${lang}/${k}: ${res.status} ${why}`);
    if (res.status === 401) break;
    continue;
  }
  writeFileSync(join(outDir, lang, `${k}.mp3`), Buffer.from(await res.arrayBuffer()));
  next[lang][k] = e;
  save();
  console.log(`✓ ${lang}/${k} (${voice.name})`);
}
save();
console.log(failed ? `Terminado con ${failed} fallos.` : 'Listo.');
