// Sonidos generados con Web Audio (sin archivos). El contexto se crea con la primera
// interacción del jugador (política de reproducción automática) y se silencia con la pestaña oculta.
// El jugador puede silenciarlos; la preferencia se guarda en este navegador.
import { signal } from '@preact/signals';

const MUTE_KEY = 'halosur:mute:v1';
function readMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
export const muted = signal(readMuted());
export function toggleMute(): void {
  muted.value = !muted.value;
  try {
    localStorage.setItem(MUTE_KEY, muted.value ? '1' : '0');
  } catch {
    /* sin almacenamiento: solo dura esta sesión */
  }
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || muted.value) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return document.hidden ? null : ctx;
  } catch {
    return null;
  }
}

/** Contexto de audio compartido (lo usa la música). Quien lo pida decide si respeta mute y pestaña oculta. */
export function sharedContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    ctx ??= new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

/** Nota corta con envolvente suave. */
function tone(freq: number, start: number, duration: number, volume = 0.06, type: OscillatorType = 'sine', slideTo?: number): void {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  const t0 = ac.currentTime + start;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Un bloque de energía: clic seco, más agudo cuanto más lleno. */
export function playTick(fill = 0.5): void {
  playSample('block_click', () => tone(900 + fill * 500, 0, 0.045, 0.035, 'square'), 0.45);
}

/** Ejecutar el día: golpe grave de confirmación. */
export function playCommit(): void {
  playSample('day_commit', () => {
    tone(150, 0, 0.22, 0.09, 'sine', 70);
    tone(420, 0.02, 0.09, 0.03, 'triangle');
  });
}

/** Cada módulo que rinde: una nota de un acorde según el recurso. */
const MODULE_NOTE = { life_support: 659, food: 784, dose: 523, check: 988 } as const;
export function playYield(kind: keyof typeof MODULE_NOTE): void {
  tone(MODULE_NOTE[kind], 0, 0.2, 0.04, 'triangle');
}

/** Recoger la cosecha: dos notas ascendentes. */
export function playCollect(): void {
  playSample('harvest_collect', () => {
    tone(660, 0, 0.12);
    tone(990, 0.08, 0.18);
  });
}

/** Día completado: confirmación suave. */
export function playDayDone(): void {
  playSample('day_done', () => {
    tone(523, 0, 0.14, 0.04);
    tone(784, 0.1, 0.22, 0.04);
  }, 0.5);
}

/** Hito: acorde ascendente. */
export function playMilestone(): void {
  playSample('milestone', () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, 0.045, 'triangle')));
}

// ---------- Minijuegos ----------
/** Empieza un reto: tres notas que suben. */
export function playChallengeStart(): void {
  playSample('challenge_start', () => [392, 523, 659].forEach((f, i) => tone(f, i * 0.08, 0.16, 0.045, 'triangle')));
}

/** Resultado de un reto: fanfarria, dos notas neutras o un «otra vez será» suave (nunca triste). */
export function playChallengeResult(outcome: 'perfect' | 'partial' | 'failed' | 'skipped'): void {
  if (outcome === 'perfect') {
    playSample('challenge_win', () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.3, 0.045, 'triangle')));
  } else if (outcome === 'partial') {
    playSample('challenge_partial', () => {
      tone(587, 0, 0.16, 0.04, 'triangle');
      tone(659, 0.12, 0.24, 0.04, 'triangle');
    });
  } else if (outcome === 'failed') {
    playSample('challenge_fail', () => tone(440, 0, 0.3, 0.045, 'sine', 300));
  }
}

/** El rover avanza una casilla. */
export function playRoverStep(): void {
  playSample('rover_step', () => tone(220, 0, 0.07, 0.04, 'square', 260), 0.4);
}

/** El brazo cierra la pinza. */
export function playArmGrab(): void {
  playSample('arm_grab', () => {
    tone(320, 0, 0.12, 0.05, 'sawtooth', 180);
    tone(900, 0.12, 0.05, 0.03, 'square');
  });
}

/** Una ficha de cuidado se pega a un tripulante. */
export function playCarePlace(): void {
  playSample('care_place', () => tone(520, 0, 0.09, 0.05, 'sine', 780), 0.5);
}

// Muestras generadas con IA (scripts/generate-sfx.mjs), guardadas en public/audio/sfx/.
// Nunca se piden a ningún servicio durante la partida. Si falta el archivo, suena el respaldo sintetizado.
const BASE = '/audio/sfx/';
let available: Promise<Set<string>> | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function sampleIds(): Promise<Set<string>> {
  available ??= fetch(BASE + 'index.json')
    .then((r) => (r.ok ? r.json() : { ids: [] }))
    .then((j: { ids?: string[] }) => new Set(j.ids ?? []))
    .catch(() => new Set<string>());
  return available;
}

function loadSample(ac: AudioContext, id: string): Promise<AudioBuffer | null> {
  let p = buffers.get(id);
  if (!p) {
    p = sampleIds()
      .then((ids) => (ids.has(id) ? fetch(BASE + id + '.mp3') : null))
      .then((r) => (r && r.ok ? r.arrayBuffer() : null))
      .then((b) => (b ? ac.decodeAudioData(b) : null))
      .catch(() => null);
    buffers.set(id, p);
  }
  return p;
}

/** Reproduce una muestra; si no existe o falla, llama al respaldo sintetizado. */
export function playSample(id: string, fallback: () => void, volume = 0.6): void {
  const ac = audio();
  if (!ac) return;
  void loadSample(ac, id).then((buf) => {
    if (!buf) return fallback();
    if (muted.value || document.hidden) return;
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    gain.gain.value = volume;
    src.buffer = buf;
    src.connect(gain).connect(ac.destination);
    src.start();
  });
}

function synthBreakdown(): void {
  // Dos tonos (agudo y grave), tres repeticiones. Suave: es para niños.
  for (let i = 0; i < 3; i++) {
    tone(740, i * 0.5, 0.2, 0.05, 'square');
    tone(554, i * 0.5 + 0.22, 0.22, 0.05, 'square');
  }
}
function synthStorm(): void {
  [0, 0.28, 0.56].forEach((s) => tone(520, s, 0.2, 0.05, 'square', 880));
}

/** Avería: alarma de dos tonos (muestra) o dos zumbidos descendentes (respaldo). */
export function playBreakdown(): void {
  playSample('alarm_breakdown', synthBreakdown);
}

/** Tormenta solar: alerta de radiación (muestra) o tres pulsos ascendentes (respaldo). */
export function playStormAlarm(): void {
  playSample('storm_alert', synthStorm);
}

/** Golpe de llave inglesa. */
export function playRepairClank(): void {
  playSample('repair_clank', () => {
    tone(1400, 0, 0.09, 0.07, 'square', 700);
    tone(2300, 0, 0.05, 0.03, 'triangle');
  });
}

/** Trinquete rápido con un destello metálico al final. */
export function playRepairShuank(): void {
  playSample('repair_shuank', () => {
    [0, 0.06, 0.12, 0.18].forEach((s) => tone(900, s, 0.04, 0.04, 'square'));
    tone(1800, 0.26, 0.3, 0.04, 'triangle', 3200);
  });
}

/** Reparación lista: campanita y subida suave. */
export function playRepairDone(): void {
  playSample('repair_done', () => {
    tone(1047, 0, 0.25, 0.05, 'triangle');
    tone(1568, 0.1, 0.4, 0.05, 'sine');
  });
}

/** Energía que fluye al pasar el día: zumbido que sube. */
export function playEnergyFlow(): void {
  playSample('energy_flow', () => tone(110, 0, 1.2, 0.05, 'sawtooth', 330), 0.5);
}
