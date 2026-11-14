// Retrato de un tripulante. Si hay foto del equipo (public/crew/, declarada en
// public/optional-assets.json) se usa recortada en círculo; si no, el retrato SVG de casco.
// `mood` cambia el gesto que se intuye en el reflejo del visor (solo en el SVG).
import type { CrewId } from '../data/crew';
import { crewPhotos } from '../data/crew';
import '../styles/crew.css';

export type Mood = 'happy' | 'neutral' | 'worried';

interface Props {
  color: string;
  mood?: Mood;
  size?: number;
  /** Si se da y hay foto, se muestra la foto en vez del dibujo. */
  crew?: CrewId;
}

export function CrewPortrait({ color, mood = 'happy', size = 56, crew }: Props) {
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
  const mouth = mood === 'happy' ? 'M25 37 Q32 42 39 37' : mood === 'neutral' ? 'M26 38 L38 38' : 'M25 40 Q32 35 39 40';
  return (
    <svg class="portrait" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {/* Hombros y mochila */}
      <path d="M8 64 C8 50 18 44 32 44 C46 44 56 50 56 64 Z" fill="#e9e6de" />
      <path d="M12 56 C14 50 20 47 26 46 L24 52 Z M52 56 C50 50 44 47 38 46 L40 52 Z" fill={color} />
      <rect x="27" y="50" width="10" height="7" rx="1.5" fill={color} />
      {/* Casco */}
      <circle cx="32" cy="28" r="19" fill="#e9e6de" />
      <rect x="20" y="44" width="24" height="4" rx="2" fill={color} />
      {/* Visor con reflejo y un gesto */}
      <ellipse cx="32" cy="30" rx="13.5" ry="11" fill="#1b1a17" />
      <path d="M22 25 Q27 20 34 20" stroke="#f3d39a" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8" />
      <circle cx="27" cy="31" r="1.6" fill="#f3d39a" opacity="0.85" />
      <circle cx="37" cy="31" r="1.6" fill="#f3d39a" opacity="0.85" />
      <path d={mouth} stroke="#f3d39a" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.85" />
      {/* Linterna */}
      <rect x="47" y="21" width="5" height="4" rx="1" fill="#2a2b2e" />
    </svg>
  );
}
