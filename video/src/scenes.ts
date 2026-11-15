// Guion del vídeo de 30 s (30 fps = 900 fotogramas). Cada escena usa un clip grabado del juego real
// (capture/run.mjs → public/clips). Tiempos de clip en segundos del clip original.
// focus: centro del encuadre en píxeles del clip (1920×1080). zoom: >1 acerca. vFocus/vZoom: versión vertical
// (recorte cuadrado de 1080 px de lado si vZoom = 1).

export type Lang = 'es' | 'en';

export interface Shot {
  clip: string; // archivo en public/ (sin idioma: el sufijo -en se añade si existe esa versión)
  from: number; // segundo del clip donde empieza
  fromEn?: number; // si el clip en inglés tiene otros tiempos
  frames: number; // duración en el vídeo final
  rate?: number; // velocidad de reproducción
  focus?: [number, number];
  zoom?: [number, number]; // zoom al principio y al final del plano
  vFocus?: [number, number];
  vZoom?: [number, number];
}

export interface Scene {
  id: string;
  shots: Shot[];
  label?: { kicker: Record<Lang, string>; title: Record<Lang, string>; sub?: Record<Lang, string> };
  /** Rótulo arriba a la derecha (horizontal) para no tapar lo importante. */
  labelTop?: boolean;
  /** Subtítulo distinto por plano (minijuegos). */
  shotSubs?: Record<Lang, string>[];
}

export const FPS = 30;

export const SCENES: Scene[] = [
  {
    id: 'title',
    shots: [{ clip: 'clips/title.mp4', from: 0.3, frames: 66, zoom: [1.0, 1.05], focus: [1400, 600], vFocus: [1420, 640] }],
  },
  {
    id: 'intro',
    shots: [{ clip: 'video/intro-es.mp4', from: 0.4, frames: 60, rate: 1.1, zoom: [1.0, 1.06], vFocus: [1100, 560] }],
  },
  {
    id: 'crew',
    shots: [{ clip: 'clips/crew.mp4', from: 1.0, frames: 66, rate: 2.0, zoom: [1.0, 1.04], vFocus: [600, 560] }],
    label: {
      kicker: { es: 'Tu tripulación', en: 'Your crew' },
      title: { es: 'Cuatro astronautas a tu cargo', en: 'Four astronauts in your care' },
      sub: { es: 'Eduardo · Christopher · Kevin · Vanessa', en: 'Eduardo · Christopher · Kevin · Vanessa' },
    },
  },
  {
    id: 'base',
    shots: [
      { clip: 'clips/launch.mp4', from: 1.8, frames: 45, rate: 1.2, zoom: [1.0, 1.08], vFocus: [960, 560] },
      { clip: 'clips/base.mp4', from: 0.3, frames: 45, rate: 1.6, zoom: [1.05, 1.12], focus: [960, 520], vFocus: [1000, 540] },
    ],
    label: {
      kicker: { es: 'Maqueta 3D viva', en: 'Living 3D model' },
      title: { es: 'Dirige una base en la Luna', en: 'Run a base on the Moon' },
      sub: { es: '30 días en el cráter Shackleton', en: '30 days at Shackleton crater' },
    },
  },
  {
    id: 'plan',
    shots: [{ clip: 'clips/plan.mp4', from: 0.2, frames: 90, rate: 1.45, focus: [1500, 560], zoom: [1.2, 1.32], vFocus: [1480, 600], vZoom: [1.15, 1.2] }],
    label: {
      kicker: { es: 'Plan de energía', en: 'Energy plan' },
      title: { es: 'Reparte la energía', en: 'Share out the energy' },
      sub: { es: 'Pulsa + y −: el sello te dice si es seguro', en: 'Tap + and −: the stamp tells you if it is safe' },
    },
  },
  {
    id: 'pass',
    shots: [{ clip: 'clips/pass.mp4', from: 0.1, frames: 60, rate: 1.7, focus: [800, 540], zoom: [1.05, 1.15], vFocus: [900, 540] }],
    label: {
      kicker: { es: 'Día a día', en: 'Day by day' },
      title: { es: 'Pasa el día y mira qué ocurre', en: 'Run the day and see what happens' },
    },
  },
  {
    id: 'storm',
    shots: [{ clip: 'clips/storm.mp4', from: 0.9, frames: 105, rate: 1.9, focus: [1250, 540], zoom: [1.08, 1.14], vFocus: [1480, 560] }],
    label: {
      kicker: { es: 'Dato real · NASA DONKI', en: 'Real data · NASA DONKI' },
      title: { es: '¡Tormenta solar!', en: 'Solar storm!' },
      sub: { es: '¿Al refugio o seguir trabajando?', en: 'Shelter or keep working?' },
    },
  },
  {
    id: 'night',
    shots: [{ clip: 'clips/night.mp4', from: 9.3, fromEn: 16.4, frames: 75, rate: 1.6, zoom: [1.0, 1.08], vFocus: [960, 520] }],
    label: {
      kicker: { es: 'Días 12 a 17', en: 'Days 12 to 17' },
      title: { es: 'Sobrevive a la noche lunar', en: 'Survive the lunar night' },
      sub: { es: 'Sin sol: guarda batería antes', en: 'No sunlight: save battery first' },
    },
  },
  {
    id: 'games',
    shots: [
      { clip: 'clips/rover.mp4', from: 3.2, frames: 54, rate: 2.0, focus: [960, 540], zoom: [1.12, 1.16], vFocus: [960, 540], vZoom: [0.86, 0.88] },
      { clip: 'clips/cables.mp4', from: 2.6, frames: 54, rate: 2.2, focus: [640, 420], zoom: [1.62, 1.68], vFocus: [640, 420], vZoom: [1.02, 1.06] },
      { clip: 'clips/micro.mp4', from: 3.4, frames: 54, rate: 1.8, focus: [640, 420], zoom: [1.62, 1.68], vFocus: [640, 420], vZoom: [1.02, 1.06] },
    ],
    label: {
      kicker: { es: 'Retos diarios', en: 'Daily challenges' },
      title: { es: '10 minijuegos', en: '10 mini-games' },
    },
    shotSubs: [
      { es: 'Lleva el rover al hielo', en: 'Drive the rover to the ice' },
      { es: 'Cables a las balizas', en: 'Cables to the beacons' },
      { es: 'Escudo contra micrometeoritos', en: 'Micrometeorite shield' },
    ],
  },
  {
    id: 'victory',
    labelTop: true,
    shots: [{ clip: 'clips/victory.mp4', from: 0.4, frames: 75, rate: 1.5, focus: [953, 300], zoom: [1.75, 1.6], vFocus: [953, 260], vZoom: [1.12, 1.04] }],
    label: {
      kicker: { es: 'Día 30', en: 'Day 30' },
      title: { es: '¡Llega la nave de relevo!', en: 'The relief ship arrives!' },
      sub: { es: 'La tripulación vuelve a casa', en: 'The crew heads home' },
    },
  },
];

export const END_FRAMES = 51;

export const TOTAL = SCENES.reduce((n, s) => n + s.shots.reduce((m, sh) => m + sh.frames, 0), 0) + END_FRAMES;

export const END_TEXT: Record<Lang, { tag: string; line: string; team: string; url: string }> = {
  es: {
    tag: 'Turno de noche',
    line: 'Juega gratis en el navegador · Español e inglés',
    team: 'Equipo Halo Sur · NASA Space Apps Challenge 2026',
    url: 'shackleton-turno-de-noche.vercel.app',
  },
  en: {
    tag: 'Night shift',
    line: 'Free to play in your browser · English and Spanish',
    team: 'Team Halo Sur · NASA Space Apps Challenge 2026',
    url: 'shackleton-turno-de-noche.vercel.app',
  },
};
