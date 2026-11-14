// Retrato de un tripulante. Si hay foto del equipo (public/crew/, declarada en
// public/optional-assets.json) se usa recortada en círculo; si no, el retrato SVG de casco.
// La carita del visor es un emoticono grueso con cinco emociones (`emotion`); los sitios que solo
// conocen tres gestos (`mood`) siguen funcionando. Estilo pegatina: contorno oscuro y colores planos.
import { useRef } from 'preact/hooks';
import type { CrewId } from '../data/crew';
import { crewPhotos } from '../data/crew';
import type { Emotion } from '../state/rewards';
import '../styles/crew.css';
import '../styles/faces.css';

export type Mood = 'happy' | 'neutral' | 'worried';

const MOOD_EMOTION: Record<Mood, Emotion> = { happy: 'happy', neutral: 'calm', worried: 'worried' };

interface Props {
  color: string;
  mood?: Mood;
  /** Si se da, manda sobre `mood`. */
  emotion?: Emotion;
  size?: number;
  /** Si se da y hay foto, se muestra la foto en vez del dibujo. */
  crew?: CrewId;
}

const INK = '#14120f';
const FACE = '#f3d39a';
const DROP = '#8fd3ff';

/** Gotita de sudor: la preocupación se ve, no se llora. */
function Drop() {
  return <path d="M45 14.5 Q49.5 20.5 45 23.5 Q40.5 20.5 45 14.5 Z" fill={DROP} stroke={INK} stroke-width="1.2" stroke-linejoin="round" />;
}

/** Ojos y boca de cada emoción, dibujados dentro del visor (viewBox 64). */
function Features({ emotion }: { emotion: Emotion }) {
  const line = { stroke: FACE, 'stroke-width': 3.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
  switch (emotion) {
    case 'joy':
      return (
        <>
          <path d="M21.5 29.5 Q25.5 23 29.5 29.5 M34.5 29.5 Q38.5 23 42.5 29.5" {...line} />
          <path d="M23 33.5 Q32 45 41 33.5 Z" fill={FACE} stroke={FACE} stroke-width="1.6" stroke-linejoin="round" />
        </>
      );
    case 'happy':
      return (
        <>
          <g class="face-eyes"><circle cx="26" cy="28" r="2.9" fill={FACE} /><circle cx="38" cy="28" r="2.9" fill={FACE} /></g>
          <path d="M24 34 Q32 42 40 34" {...line} />
        </>
      );
    case 'calm':
      return (
        <>
          <g class="face-eyes"><circle cx="26" cy="29" r="2.7" fill={FACE} /><circle cx="38" cy="29" r="2.7" fill={FACE} /></g>
          <path d="M27 36.5 L37 36.5" {...line} />
        </>
      );
    case 'worried':
      return (
        <>
          <g class="face-eyes"><circle cx="26" cy="30" r="2.7" fill={FACE} /><circle cx="38" cy="30" r="2.7" fill={FACE} /></g>
          <path d="M21 25 L29.5 22 M42.5 25 L34 22" {...line} stroke-width="2.6" />
          <path d="M24 38 Q28 34 32 38 T40 38" {...line} stroke-width="2.8" />
          <Drop />
        </>
      );
    default:
      // Asustado: ojos enormes y boca en «o». Tierno, no angustioso.
      return (
        <>
          <g class="face-eyes">
            <circle cx="26" cy="29" r="4.6" fill={FACE} /><circle cx="38" cy="29" r="4.6" fill={FACE} />
            <circle cx="26.6" cy="29.6" r="1.9" fill={INK} /><circle cx="37.4" cy="29.6" r="1.9" fill={INK} />
          </g>
          <path d="M21.5 21 Q25.5 18 29.5 21 M34.5 21 Q38.5 18 42.5 21" {...line} stroke-width="2.4" />
          <ellipse cx="32" cy="38" rx="3" ry="3.5" {...line} stroke-width="2.8" />
          <Drop />
        </>
      );
  }
}

export function CrewPortrait({ color, mood = 'happy', emotion, size = 56, crew }: Props) {
  const e: Emotion = emotion ?? MOOD_EMOTION[mood];
  const prev = useRef<Emotion>(e);
  // Al cambiar de emoción, los rasgos rebotan una vez (CSS, 250 ms). En el primer dibujo no.
  const pop = prev.current !== e;
  prev.current = e;

  const photo = crew ? crewPhotos.value[crew] : undefined;
  if (photo) {
    return (
      <img
        class="portrait portrait--photo"
        src={photo}
        width={size}
        height={size}
        alt=""
        draggable={false}
        style={{ '--ring': color }}
      />
    );
  }
  return (
    <svg class={`portrait portrait--${e}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {/* Hombros y mochila: color plano del tripulante */}
      <path d="M6 64 C6 50 17 44 32 44 C47 44 58 50 58 64 Z" fill={color} stroke={INK} stroke-width="2.2" stroke-linejoin="round" />
      <rect x="22" y="44" width="20" height="5" rx="2.5" fill="#e9e6de" stroke={INK} stroke-width="2" />
      {/* Casco con contorno */}
      <circle cx="32" cy="27" r="21" fill="#e9e6de" stroke={INK} stroke-width="2.4" />
      {/* Visor oscuro y la carita */}
      <ellipse cx="32" cy="29" rx="16" ry="13" fill="#1b1a17" stroke={INK} stroke-width="1.6" />
      <path d="M20.5 22 Q24 18.5 29 18" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.45" />
      <g class={`face-feat${pop ? ' face-feat--pop' : ''}`} key={e}>
        <Features emotion={e} />
      </g>
    </svg>
  );
}
