// Voces de la guía del tutorial (ElevenLabs, generadas UNA vez con `npm run voices` en
// public/audio/voice/<idioma>/<clave>.mp3). El juego nunca llama a la API.
// Una voz suena solo si su texto grabado es EXACTAMENTE el que se ve en pantalla (index.json):
// si alguien cambia la frase y no regenera, la burbuja queda solo con texto, nunca dice otra cosa.
// Respeta el silencio general y la pestaña oculta; mientras habla, la música baja (music.ts).
import { effect, signal } from '@preact/signals';
import { lang } from '../i18n';
import { muted } from './sfx';

type Index = Record<string, Record<string, { text: string; speaker: string }>>;

const BASE = '/audio/voice/';
/** Volumen de la voz (0..1): por encima de la música para que se entienda. */
const VOICE_VOLUME = 1;

/** Hay una voz sonando ahora (la música la usa para bajar). */
export const voiceSpeaking = signal(false);

let index: Promise<Index | null> | null = null;
function loadIndex(): Promise<Index | null> {
  index ??= fetch(BASE + 'index.json')
    .then((r) => (r.ok ? (r.json() as Promise<Index>) : null))
    .catch(() => null);
  return index;
}

let current: HTMLAudioElement | null = null;
let token = 0;

/** Calla la voz que esté sonando. */
export function stopVoice(): void {
  token++;
  if (current) {
    current.pause();
    current = null;
  }
  voiceSpeaking.value = false;
}

/** Dice la línea `key` si hay audio grabado con este mismo texto en el idioma actual. */
export function speak(key: string, text: string): void {
  stopVoice();
  if (typeof window === 'undefined' || muted.value || document.hidden) return;
  const mine = token;
  const l = lang.value;
  void loadIndex().then((idx) => {
    const entry = idx?.[l]?.[key];
    if (mine !== token || !entry || entry.text !== text || muted.value) return;
    const el = new Audio(`${BASE}${l}/${key}.mp3`);
    el.volume = VOICE_VOLUME;
    el.onended = () => {
      if (current === el) stopVoice();
    };
    current = el;
    el.play()
      .then(() => {
        if (current === el) voiceSpeaking.value = true;
      })
      .catch(() => {
        if (current === el) stopVoice();
      });
  });
}

// Silenciar o esconder la pestaña corta la voz al momento.
if (typeof window !== 'undefined') {
  effect(() => {
    if (muted.value) stopVoice();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopVoice();
  });
}
