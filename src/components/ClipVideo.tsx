// Vídeo a pantalla completa con botón de saltar (se usa para la victoria: al terminar los 30 días
// y al completar el tutorial). Un archivo por idioma en public/video/<nombre>-<es|en>.mp4.
// Si el vídeo no carga, avisa con onDone y la pantalla de detrás sigue como siempre.
// Mientras suena, la música de fondo calla (music.ts lee `introVideoOpen`).
import { useEffect, useRef, useState } from 'preact/hooks';
import { muted } from '../audio/sfx';
import { lang, t } from '../i18n';
import { introVideoOpen } from '../state/intro';
import { clipPoster, clipSrc } from '../state/introPreload';
import type { ClipName } from '../state/introPreload';
import { Icon } from './icons';
import '../styles/introvideo.css';

export function ClipVideo({ name, label, onDone }: { name: ClipName; label: string; onDone: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  /** El navegador no dejó arrancar solo: se muestra un botón grande para reproducir. */
  const [blocked, setBlocked] = useState(false);
  const l = lang.value;
  // Dirección fija mientras dura el vídeo: la copia precargada si ya llegó, o la de red.
  const src = useRef({ l, url: clipSrc(name, l) });
  if (src.current.l !== l) src.current = { l, url: clipSrc(name, l) };

  const latest = useRef(onDone);
  latest.current = onDone;

  useEffect(() => {
    introVideoOpen.value = true;
    return () => {
      introVideoOpen.value = false;
    };
  }, []);

  const start = (): void => {
    const v = video.current;
    if (!v) return;
    v.muted = muted.value;
    v.play()
      .then(() => setBlocked(false))
      .catch(() => setBlocked(true));
  };

  useEffect(() => {
    skip.current?.focus();
    start();
  }, [l]);

  useEffect(() => {
    const v = video.current;
    if (v) v.muted = muted.value;
  }, [muted.value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        latest.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div class="introvid introvid--clip" role="dialog" aria-modal="true" aria-label={label}>
      <video
        ref={video}
        key={l}
        class="introvid__video"
        src={src.current.url}
        poster={clipPoster(name, l)}
        playsInline
        preload="auto"
        onEnded={() => latest.current()}
        onError={() => latest.current()}
        onClick={() => blocked && start()}
      />
      <div class="introvid__bar">
        <button ref={skip} type="button" class="btn introvid__skip" onClick={() => latest.current()}>
          {t('clip.skip')}
          <Icon name="arrow" size={16} />
        </button>
      </div>
      {blocked && (
        <button type="button" class="btn btn--primary introvid__play" onClick={start}>
          {t('intro.play')}
        </button>
      )}
    </div>
  );
}
