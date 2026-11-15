// Control del volumen de la música: un botón que abre un panel pequeño con un deslizador.
// En la barra superior del juego es un botón de ícono; en la portada, un enlace de texto.
// Solo lee y cambia el volumen de música (src/audio/music.ts); el silencio general sigue en su botón.
// El panel se pinta en <body> con posición fija (portal): así no queda debajo de la tablet ni lo
// recorta su contenedor, y se ancla al borde derecho del botón sin salirse de la pantalla.
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { musicVolume, setMusicVolume } from '../audio/music';
import { muted } from '../audio/sfx';
import { t } from '../i18n';
import { Icon } from './icons';
import '../styles/music.css';

/** Margen mínimo con el borde de la pantalla (px). */
const EDGE = 16;
const GAP = 8;

interface Place {
  right: number;
  top?: number;
  bottom?: number;
}

export function MusicControl({ variant = 'icon' }: { variant?: 'icon' | 'link' }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pct = Math.round(musicVolume.value * 100);

  // Coloca el panel junto al botón: debajo en la barra superior, encima en la portada.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = (): void => {
      const b = toggle.current?.getBoundingClientRect();
      if (!b) return;
      const w = panel.current?.offsetWidth ?? 220;
      const maxRight = Math.max(EDGE, window.innerWidth - w - EDGE);
      const right = Math.min(maxRight, Math.max(EDGE, window.innerWidth - b.right));
      setPlace(variant === 'icon' ? { right, top: b.bottom + GAP } : { right, bottom: window.innerHeight - b.top + GAP });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (toggle.current?.contains(target) || panel.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <span class={`musicctl musicctl--${variant}`}>
      <button
        ref={toggle}
        type="button"
        class={variant === 'icon' ? `iconbtn${open ? ' iconbtn--on' : ''}` : 'linkbtn'}
        aria-expanded={open}
        aria-controls="musicctl-panel"
        aria-label={variant === 'icon' ? t('music.button') : undefined}
        title={t('music.button')}
        onClick={() => setOpen(!open)}
      >
        {variant === 'icon' ? <Icon name="music" size={18} /> : t('music.button')}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id="musicctl-panel"
            class="musicctl__panel"
            role="group"
            aria-label={t('music.button')}
            style={place ? { right: `${place.right}px`, top: place.top !== undefined ? `${place.top}px` : 'auto', bottom: place.bottom !== undefined ? `${place.bottom}px` : 'auto' } : { visibility: 'hidden' }}
          >
            <label class="musicctl__label" for="musicctl-range">
              <Icon name="music" size={16} />
              <span>{t('music.volume')}</span>
              <output class="musicctl__value" for="musicctl-range">
                {pct === 0 ? t('music.off') : `${pct} %`}
              </output>
            </label>
            <input
              id="musicctl-range"
              class="musicctl__range"
              type="range"
              min={0}
              max={100}
              step={5}
              value={pct}
              aria-valuetext={pct === 0 ? t('music.off') : `${pct} %`}
              onInput={(e) => setMusicVolume(Number((e.target as HTMLInputElement).value) / 100)}
            />
            {muted.value && <p class="musicctl__note">{t('music.muted_note')}</p>}
          </div>,
          document.body,
        )}
    </span>
  );
}
