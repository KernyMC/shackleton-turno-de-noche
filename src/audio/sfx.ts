// Sonidos generados con Web Audio (sin archivos). El contexto se crea con la primera
// interacción del jugador (política de reproducción automática) y se silencia con la pestaña oculta.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return document.hidden ? null : ctx;
  } catch {
    return null;
  }
}

/** Nota corta con envolvente suave. */
function tone(freq: number, start: number, duration: number, volume = 0.06, type: OscillatorType = 'sine'): void {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ac.currentTime + start;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
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
