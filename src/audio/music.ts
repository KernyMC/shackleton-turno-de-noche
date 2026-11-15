// Música de fondo (pistas de Suno en public/audio/music/, normalizadas a -16 LUFS con ffmpeg).
// Solo observa el store y elige la pista que toca: no cambia ninguna regla del juego.
//
//   portada ............ main        práctica de minijuegos ... minigames
//   día con Sol ........ day         noche lunar ............... night
//   tormenta solar ..... storm       reto del día .............. minigames (la gran tormenta: storm)
//   victoria ........... victory     misión abortada ........... lost
//   evento que pide decidir: un golpe corto (question) mientras la pista de fondo baja.
//   mientras habla un tripulante (voz del tutorial, voice.ts) la música también baja.
//
// Cambios con fundido amortiguado (setTargetAtTime), nunca de golpe. Cada pista se descarga solo
// cuando suena por primera vez. Respeta el silencio general (muted), la pestaña oculta y la regla
// del navegador de no sonar antes de la primera interacción. Si un archivo falla, hay silencio.
import { computed, effect, signal } from '@preact/signals';
import { defaultConfig } from '../sim/config';
import { introVideoOpen } from '../state/intro';
import { practiceChallenge, practiceOpen } from '../state/practice';
import { activeChallenge, game, screen } from '../state/store';
import { muted, sharedContext } from './sfx';
import { voiceSpeaking } from './voice';

export type TrackId = 'main' | 'day' | 'night' | 'storm' | 'minigames' | 'victory' | 'lost';

interface TrackDef {
  /** Volumen propio de la pista (0..1), antes del volumen de música del jugador. */
  gain: number;
  loop: boolean;
  /** Al volver a sonar, ¿empieza desde el principio? (si no, sigue donde se quedó). */
  restart: boolean;
}

// Mezcla: el fondo de juego queda bajo para no tapar los efectos ni distraer al leer;
// portada, tormenta y final suben porque son momentos para sentir.
const TRACKS: Record<TrackId, TrackDef> = {
  main: { gain: 0.7, loop: true, restart: false },
  day: { gain: 0.4, loop: true, restart: false },
  night: { gain: 0.42, loop: true, restart: false },
  storm: { gain: 0.55, loop: true, restart: true },
  minigames: { gain: 0.45, loop: true, restart: true },
  victory: { gain: 0.8, loop: false, restart: true },
  lost: { gain: 0.6, loop: false, restart: true },
};
const STINGER_GAIN = 0.6;
/** Cuánto baja la pista de fondo mientras suena el golpe de evento. */
const DUCK = 0.3;
/** Cuánto baja la música mientras habla un tripulante (voz del tutorial). */
const VOICE_DUCK = 0.35;
/** Constante de tiempo de los fundidos (s): ~3 τ hasta el volumen final. */
const FADE_IN = 0.6;
const FADE_OUT = 0.5;
const BASE = '/audio/music/';

const VOL_KEY = 'halosur:music:v1';
const DEFAULT_VOLUME = 0.6;
function readVolume(): number {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(VOL_KEY) : null;
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

/** Volumen de la música elegido por el jugador (0..1). Se guarda en este navegador. */
export const musicVolume = signal(readVolume());
export function setMusicVolume(v: number): void {
  musicVolume.value = Math.min(1, Math.max(0, v));
  try {
    localStorage.setItem(VOL_KEY, String(musicVolume.value));
  } catch {
    /* sin almacenamiento: solo dura esta sesión */
  }
}

/** Pista que corresponde al momento del juego (null = silencio). */
export const musicTrack = computed<TrackId | null>(() => {
  const s = screen.value;
  // La intro en vídeo trae su propio sonido: la música calla.
  if (introVideoOpen.value) return null;
  if (s === 'debrief') {
    const r = game.value?.result;
    return r ? (r.outcome === 'win' ? 'victory' : 'lost') : null;
  }
  if (s === 'menu') {
    if (practiceChallenge.value === 'day24_super_storm') return 'storm';
    return practiceOpen.value || activeChallenge.value ? 'minigames' : 'main';
  }
  const g = game.value;
  if (!g) return 'main';
  const ch = activeChallenge.value;
  if (ch) return ch.def.id === 'day24_super_storm' ? 'storm' : 'minigames';
  if (g.result) return g.result.outcome === 'win' ? 'victory' : 'lost';
  if (g.pendingEvent?.kind === 'storm' || g.stormToday) return 'storm';
  if (defaultConfig.light.nightDays.includes(g.day)) return 'night';
  return 'day';
});

/** Evento que pide decidir y no es tormenta (la tormenta ya tiene su música). */
const decisionEvent = computed(() => {
  const g = game.value;
  if (screen.value !== 'game' || !g || g.phase !== 'event' || !g.pendingEvent) return null;
  if (g.pendingEvent.kind === 'storm') return null;
  return `${g.day}-${g.pendingEvent.kind}`;
});

interface Channel {
  el: HTMLAudioElement;
  gain: GainNode;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

/** Arranca la música. Devuelve cómo detenerla. */
export function startMusic(): () => void {
  if (typeof window === 'undefined') return () => {};
  let interacted = false;
  let ac: AudioContext | null = null;
  let bus: GainNode | null = null;
  const channels = new Map<string, Channel>();
  let current: TrackId | null = null;
  let duck = 1;
  let lastStinger: string | null = null;

  const channel = (id: string, loop: boolean): Channel | null => {
    const found = channels.get(id);
    if (found) return found;
    if (!ac || !bus) return null;
    try {
      const el = new Audio(`${BASE}${id}.mp3`);
      el.loop = loop;
      el.preload = 'auto';
      const gain = ac.createGain();
      gain.gain.value = 0;
      ac.createMediaElementSource(el).connect(gain).connect(bus);
      const ch: Channel = { el, gain, stopTimer: null };
      channels.set(id, ch);
      return ch;
    } catch {
      return null;
    }
  };

  const fadeTo = (ch: Channel, target: number, tau: number): void => {
    if (!ac) return;
    const now = ac.currentTime;
    ch.gain.gain.cancelScheduledValues(now);
    ch.gain.gain.setValueAtTime(ch.gain.gain.value, now);
    ch.gain.gain.setTargetAtTime(target, now, tau);
  };

  const play = (ch: Channel): void => {
    if (ch.stopTimer) clearTimeout(ch.stopTimer);
    ch.stopTimer = null;
    void ch.el.play().catch(() => {
      /* archivo ausente o reproducción bloqueada: silencio */
    });
  };

  const fadeOutAndPause = (ch: Channel): void => {
    fadeTo(ch, 0, FADE_OUT);
    if (ch.stopTimer) clearTimeout(ch.stopTimer);
    ch.stopTimer = setTimeout(() => {
      ch.el.pause();
      ch.stopTimer = null;
    }, FADE_OUT * 6000);
  };

  const audible = (): boolean => interacted && !muted.value && !document.hidden;

  const applyBus = (): void => {
    if (!ac || !bus) return;
    const now = ac.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    // El oído percibe el volumen de forma logarítmica: el cuadrado reparte mejor el deslizador.
    bus.gain.setTargetAtTime(musicVolume.value ** 2, now, 0.08);
  };

  const apply = (): void => {
    if (!interacted) return;
    ac ??= sharedContext();
    if (!ac) return;
    if (!bus) {
      bus = ac.createGain();
      bus.gain.value = musicVolume.value ** 2;
      bus.connect(ac.destination);
    }
    applyBus();

    if (!audible()) {
      // Se pausa sin olvidar la pista: al volver (pestaña visible, sonido activo) sigue donde iba.
      channels.forEach((ch) => fadeOutAndPause(ch));
      return;
    }
    if (ac.state === 'suspended') void ac.resume();

    const want = musicTrack.value;
    if (want !== current) {
      if (current) {
        const old = channels.get(current);
        if (old) fadeOutAndPause(old);
      }
      current = want;
      if (want) {
        const def = TRACKS[want];
        const ch = channel(want, def.loop);
        if (ch) {
          if (def.restart || ch.el.ended) ch.el.currentTime = 0;
          play(ch);
        }
      }
    }
    if (current) {
      const ch = channels.get(current);
      if (ch) {
        if (ch.el.paused && !ch.el.ended) play(ch);
        fadeTo(ch, TRACKS[current].gain * Math.min(duck, voiceSpeaking.peek() ? VOICE_DUCK : 1), FADE_IN);
      }
    }
  };

  const playStinger = (): void => {
    if (!audible()) return;
    const ch = channel('question', false);
    if (!ch) return;
    duck = DUCK;
    apply();
    ch.el.currentTime = 0;
    ch.gain.gain.cancelScheduledValues(0);
    ch.gain.gain.value = STINGER_GAIN;
    play(ch);
    ch.el.onended = () => {
      duck = 1;
      apply();
    };
  };

  const onFirst = (): void => {
    interacted = true;
    window.removeEventListener('pointerdown', onFirst, true);
    window.removeEventListener('keydown', onFirst, true);
    apply();
  };
  window.addEventListener('pointerdown', onFirst, true);
  window.addEventListener('keydown', onFirst, true);
  const onVisibility = (): void => apply();
  document.addEventListener('visibilitychange', onVisibility);

  const stopTrack = effect(() => {
    void muted.value;
    void musicTrack.value;
    apply();
  });
  const stopVolume = effect(() => {
    void musicVolume.value;
    applyBus();
  });
  const stopVoiceDuck = effect(() => {
    void voiceSpeaking.value;
    apply();
  });
  const stopStinger = effect(() => {
    const id = decisionEvent.value;
    if (id && id !== lastStinger) playStinger();
    if (!id && duck !== 1) {
      duck = 1;
      apply();
    }
    lastStinger = id;
  });

  return () => {
    stopTrack();
    stopVolume();
    stopStinger();
    stopVoiceDuck();
    window.removeEventListener('pointerdown', onFirst, true);
    window.removeEventListener('keydown', onFirst, true);
    document.removeEventListener('visibilitychange', onVisibility);
    channels.forEach((ch) => {
      if (ch.stopTimer) clearTimeout(ch.stopTimer);
      ch.el.pause();
      ch.gain.disconnect();
    });
    channels.clear();
  };
}
