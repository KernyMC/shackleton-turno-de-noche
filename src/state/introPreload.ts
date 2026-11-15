// Precarga de los vídeos del juego (intro y victoria): se descargan enteros un poco antes de
// hacer falta y se guardan en memoria (blob). Al mostrarlos arrancan al instante, sin esperar a
// la red ni cortes. Si la descarga falla o el jugador pidió ahorrar datos, se usa la dirección normal.
type Lang = 'es' | 'en';
/** Vídeos que existen en public/video/<nombre>-<idioma>.mp4. */
export type ClipName = 'intro' | 'victoria';

const ready = new Map<string, string>();
const pending = new Set<string>();
const urlOf = (name: ClipName, l: Lang): string => `/video/${name}-${l}.mp4`;

/** Carátula del vídeo (se ve mientras carga). */
export function clipPoster(name: ClipName, l: Lang): string {
  return `/video/${name}-${l}.jpg`;
}

/** Empieza a descargar un vídeo (una sola vez). No hace nada sin navegador. */
export function preloadClip(name: ClipName, l: Lang): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  const url = urlOf(name, l);
  if (ready.has(url) || pending.has(url)) return;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  if (saveData) return;
  pending.add(url);
  fetch(url)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((blob) => {
      ready.set(url, URL.createObjectURL(blob));
    })
    .catch(() => {
      /* sin precarga: el vídeo se pedirá a la red como siempre */
    })
    .finally(() => pending.delete(url));
}

/** Dirección que debe usar el vídeo: la copia en memoria si ya llegó; si no, la de red. */
export function clipSrc(name: ClipName, l: Lang): string {
  const url = urlOf(name, l);
  return ready.get(url) ?? url;
}

export const preloadIntro = (l: Lang): void => preloadClip('intro', l);
export const introSrc = (l: Lang): string => clipSrc('intro', l);
