// Ambiente por acto (Web Audio, sin archivos): una capa de fondo muy suave (volumen máximo 0,02)
// que cambia con el acto. Acto 1 y 4: calma (acorde mayor lento). 2: algo inquieta. 3: grave y
// espaciosa (la noche). 5: más brillante. Fundido de 2 s entre actos.
// Respeta el silencio (muted), la pestaña oculta, y arranca solo tras la primera interacción.
import { computed, effect } from '@preact/signals';
import { actOf } from '../sim/acts';
import { game, screen } from '../state/store';
import { muted, sharedContext } from './sfx';

/** Volumen máximo de toda la capa (0..1). */
const MASTER = 0.02;
const FADE_S = 2;

interface Voice {
  freq: number;
  type: OscillatorType;
  /** Parte del volumen de la capa (la suma es 1). */
  gain: number;
}
interface LayerDef {
  voices: Voice[];
  /** Corte del filtro: más bajo = más oscuro. */
  cutoff: number;
  /** Velocidad (Hz) y hondura (0..1) del vaivén lento del volumen. */
  lfoHz: number;
  lfoDepth: number;
  /** Desafinación en cents entre voces (inquietud). */
  detune: number;
}

const CALM: LayerDef = {
  voices: [
    { freq: 130.81, type: 'sine', gain: 0.4 },
    { freq: 164.81, type: 'sine', gain: 0.3 },
    { freq: 196.0, type: 'triangle', gain: 0.3 },
  ],
  cutoff: 700,
  lfoHz: 0.07,
  lfoDepth: 0.3,
  detune: 3,
};
const LAYERS: Record<number, LayerDef> = {
  1: CALM,
  2: {
    voices: [
      { freq: 146.83, type: 'sine', gain: 0.4 },
      { freq: 196.0, type: 'triangle', gain: 0.3 },
      { freq: 220.0, type: 'sine', gain: 0.3 },
    ],
    cutoff: 900,
    lfoHz: 0.22,
    lfoDepth: 0.45,
    detune: 9,
  },
  3: {
    voices: [
      { freq: 55.0, type: 'sine', gain: 0.45 },
      { freq: 82.41, type: 'sine', gain: 0.35 },
      { freq: 329.63, type: 'sine', gain: 0.2 },
    ],
    cutoff: 420,
    lfoHz: 0.05,
    lfoDepth: 0.35,
    detune: 4,
  },
  4: CALM,
  5: {
    voices: [
      { freq: 261.63, type: 'sine', gain: 0.28 },
      { freq: 329.63, type: 'sine', gain: 0.26 },
      { freq: 392.0, type: 'triangle', gain: 0.24 },
      { freq: 493.88, type: 'sine', gain: 0.22 },
    ],
    cutoff: 1800,
    lfoHz: 0.1,
    lfoDepth: 0.25,
    detune: 2,
  },
};

interface Layer {
  gain: GainNode;
  stop(): void;
}

function buildLayer(ac: AudioContext, master: GainNode, def: LayerDef): Layer {
  const gain = ac.createGain();
  gain.gain.value = 0;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = def.cutoff;
  // Vaivén lento del volumen: una oscilación de baja frecuencia sobre la ganancia de la capa.
  const swell = ac.createGain();
  swell.gain.value = 1 - def.lfoDepth / 2;
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  lfo.frequency.value = def.lfoHz;
  lfoGain.gain.value = def.lfoDepth / 2;
  lfo.connect(lfoGain).connect(swell.gain);
  const oscs = def.voices.map((v, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = v.type;
    osc.frequency.value = v.freq;
    osc.detune.value = (i % 2 ? 1 : -1) * def.detune;
    g.gain.value = v.gain;
    osc.connect(g).connect(filter);
    osc.start();
    return osc;
  });
  lfo.start();
  filter.connect(swell).connect(gain).connect(master);
  return {
    gain,
    stop: () => {
      oscs.forEach((o) => o.stop());
      lfo.stop();
      gain.disconnect();
    },
  };
}

/** Acto activo (0 = ninguno: menú, debrief). */
const activeAct = computed(() => (screen.value === 'game' && game.value ? actOf(game.value.day).id : 0));

/** Arranca el ambiente. Devuelve cómo detenerlo. */
export function startAmbient(): () => void {
  if (typeof window === 'undefined') return () => {};
  let interacted = false;
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let current: { act: number; layer: Layer } | null = null;
  let retire: ReturnType<typeof setTimeout> | null = null;

  const apply = (): void => {
    if (!interacted) return;
    const wantAct = muted.value || document.hidden ? 0 : activeAct.value;
    ac ??= sharedContext();
    if (!ac) return;
    if (!master) {
      master = ac.createGain();
      master.gain.value = MASTER;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended' && wantAct > 0) void ac.resume();
    const now = ac.currentTime;
    if (current && current.act === wantAct) return;
    if (current) {
      const old = current;
      old.layer.gain.gain.cancelScheduledValues(now);
      old.layer.gain.gain.setValueAtTime(old.layer.gain.gain.value, now);
      old.layer.gain.gain.linearRampToValueAtTime(0, now + FADE_S);
      if (retire) clearTimeout(retire);
      retire = setTimeout(() => old.layer.stop(), FADE_S * 1000 + 100);
      current = null;
    }
    const def = LAYERS[wantAct];
    if (!def || !master) return;
    const layer = buildLayer(ac, master, def);
    layer.gain.gain.setValueAtTime(0, now);
    layer.gain.gain.linearRampToValueAtTime(1, now + FADE_S);
    current = { act: wantAct, layer };
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
  const stop = effect(() => {
    void muted.value;
    void activeAct.value;
    apply();
  });

  return () => {
    stop();
    window.removeEventListener('pointerdown', onFirst, true);
    window.removeEventListener('keydown', onFirst, true);
    document.removeEventListener('visibilitychange', onVisibility);
    if (retire) clearTimeout(retire);
    current?.layer.stop();
    current = null;
  };
}
