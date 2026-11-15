// Intro en vídeo tras «Comenzar» (y desde «Ver la intro» en la portada): un vídeo por idioma en
// public/video/intro-<es|en>.mp4 (27 s, 720p). Se puede saltar en cualquier momento (botón o Esc).
// Si el vídeo no carga (sin red, formato no soportado), se muestra la intro en cómic de siempre.
// Mientras suena, la música de fondo calla (music.ts lee `introVideoOpen`).
import { useEffect, useRef, useState } from 'preact/hooks';
import { muted } from '../audio/sfx';
import { lang, t } from '../i18n';
import { introVideoOpen } from '../state/intro';
import { IntroComic } from './IntroComic';
import { Icon } from './icons';
import '../styles/introvideo.css';

export function IntroVideo({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const [failed, setFailed] = useState(false);
  /** El navegador no dejó arrancar solo: se muestra un botón grande para reproducir. */
  const [blocked, setBlocked] = useState(false);
  const l = lang.value;

  useEffect(() => {
    introVideoOpen.value = !failed;
    return () => {
      introVideoOpen.value = false;
    };
  }, [failed]);

  const start = (): void => {
    const v = video.current;
    if (!v) return;
    v.muted = muted.value;
    v.play()
      .then(() => setBlocked(false))
      .catch(() => setBlocked(true));
  };

  useEffect(() => {
    if (failed) return;
    skip.current?.focus();
    start();
  }, [failed, l]);

  useEffect(() => {
    const v = video.current;
    if (v) v.muted = muted.value;
  }, [muted.value]);

  const latest = useRef(onDone);
  latest.current = onDone;
  useEffect(() => {
    if (failed) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        latest.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [failed]);

  if (failed) return <IntroComic onDone={onDone} onBack={onBack} />;

  return (
    <div class="introvid" role="dialog" aria-modal="true" aria-label={t('intro.title')}>
      <video
        ref={video}
        key={l}
        class="introvid__video"
        src={`/video/intro-${l}.mp4`}
        poster={`/video/intro-${l}.jpg`}
        playsInline
        preload="auto"
        onEnded={onDone}
        onError={() => setFailed(true)}
        onClick={() => blocked && start()}
      />
      <div class="introvid__bar">
        <p class="introvid__tag">{t('comic.label')}</p>
        <button ref={skip} type="button" class="btn introvid__skip" onClick={onDone}>
          {t('intro.skip')}
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
