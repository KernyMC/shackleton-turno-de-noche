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
  tone(900 + fill * 500, 0, 0.045, 0.035, 'square');
}

/** Ejecutar el día: golpe grave de confirmación. */
export function playCommit(): void {
  tone(150, 0, 0.22, 0.09, 'sine', 70);
  tone(420, 0.02, 0.09, 0.03, 'triangle');
}

/** Cada módulo que rinde: una nota de un acorde según el recurso. */
const MODULE_NOTE = { life_support: 659, food: 784, dose: 523, check: 988 } as const;
export function playYield(kind: keyof typeof MODULE_NOTE): void {
  tone(MODULE_NOTE[kind], 0, 0.2, 0.04, 'triangle');
}

/** Recoger la cosecha: dos notas ascendentes. */
export function playCollect(): void {
  tone(660, 0, 0.12);
  tone(990, 0.08, 0.18);
}

/** Día completado: confirmación suave. */
export function playDayDone(): void {
  tone(523, 0, 0.14, 0.04);
  tone(784, 0.1, 0.22, 0.04);
}

/** Hito: acorde ascendente. */
export function playMilestone(): void {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, 0.045, 'triangle'));
}

/** Avería: dos zumbidos descendentes. */
export function playBreakdown(): void {
  tone(330, 0, 0.18, 0.06, 'sawtooth', 220);
  tone(300, 0.22, 0.26, 0.06, 'sawtooth', 180);
}

/** Tormenta solar: alarma de tres pulsos ascendentes. */
export function playStormAlarm(): void {
  [0, 0.28, 0.56].forEach((s) => tone(520, s, 0.2, 0.05, 'square', 880));
}
