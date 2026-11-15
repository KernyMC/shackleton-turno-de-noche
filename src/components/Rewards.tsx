// Capa de recompensas sobre el juego. Un canal por hecho:
//   - números que salen de cada módulo, uno tras otro, y viajan a su recurso (con su nota)
//   - la burbuja de cosecha sobre el invernadero
//   - la voz de la tripulación: burbuja de diálogo abajo a la izquierda, con retrato grande
//   - los hitos: tarjeta breve; confeti solo para la noche lunar superada
// Nada bloquea el avance; todo funciona con movimiento reducido.
import { useEffect, useRef } from 'preact/hooks';
import { crewById, crewName } from '../data/crew';
import { t } from '../i18n';
import { sceneBridge } from '../scene/bridge';
import { collectHarvest, dayDone, dayNote, dismissMilestone, floats, harvest, milestone } from '../state/rewards';
import type { FloatItem } from '../state/rewards';
import { playCollect, playDayDone, playMilestone, playYield } from '../audio/sfx';
import { CrewPortrait } from './CrewPortrait';
import { Icon } from './icons';
import { playerName } from './player';

const reduced = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TARGET_SELECTOR: Record<FloatItem['target'], string> = { vitals: '.res--life', dose: '.topbar__dose', none: '' };
const FLOAT_TARGET: Partial<Record<FloatItem['icon'], string>> = { food: '.res--food' };
/** Separación entre los números de cada módulo: la base "responde" módulo a módulo. */
const STAGGER_MS = 300;
const VOICE_MS = 5200;

function Float({ item, index }: { item: FloatItem; index: number }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = el.current;
    const from = sceneBridge.project?.(item.module);
    if (!node || !from) return;
    node.style.left = `${from.x}px`;
    node.style.top = `${from.y}px`;
    const selector = FLOAT_TARGET[item.icon] ?? TARGET_SELECTOR[item.target];
    const target = selector ? document.querySelector(selector) : null;
    const rect = target?.getBoundingClientRect();
    const dx = rect ? rect.left + rect.width / 2 - from.x : 0;
    const dy = rect ? rect.top + rect.height / 2 - from.y : -60;
    const delay = index * STAGGER_MS;
    const sound = setTimeout(() => playYield(item.icon), delay);
    const animation = reduced()
      ? node.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1600, fill: 'both' })
      : node.animate(
          [
            { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
            { transform: 'translate(-50%, -120%) scale(1.25)', opacity: 1, offset: 0.2 },
            { transform: 'translate(-50%, -115%) scale(1)', opacity: 1, offset: 0.5 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5)`, opacity: 0.1 },
          ],
          { duration: 1500, delay, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' },
        );
    animation.onfinish = () => node.remove();
    return () => {
      clearTimeout(sound);
      animation.cancel();
    };
  }, [item.key]);
  return (
    <div ref={el} class={`float float--${item.icon}`} aria-hidden="true">
      <Icon name={item.icon} size={18} />
      {item.text}
    </div>
  );
}

/** Brote listo para cosechar: dibujo propio a color, como una ficha de juego. */
function HarvestArt() {
  return (
    <svg class="harvest__art celebrate__art" viewBox="0 0 48 48" aria-hidden="true">
      <ellipse cx="24" cy="40" rx="13" ry="4.5" fill="#6b5340" stroke="#0b0c0e" stroke-width="2" />
      <path d="M24 39V21" stroke="#2f7a2c" stroke-width="3.4" stroke-linecap="round" />
      <path d="M24 27C13.5 27 8 20 8 11.5c9.5 0 16 5 16 15.5Z" fill="#6cc45c" stroke="#0b0c0e" stroke-width="2" stroke-linejoin="round" />
      <path d="M24 22.5c0-9.5 6-15 16-15 0 9.5-5.5 15-16 15Z" fill="#a9ec8f" stroke="#0b0c0e" stroke-width="2" stroke-linejoin="round" />
      <path d="M12.5 15.5l9 9M35.5 11.5l-9 8.5" stroke="#2f7a2c" stroke-width="1.7" stroke-linecap="round" fill="none" />
      <path d="M30 10.5c2.2-.9 4.4-1.2 6.6-1" stroke="#e9ffd9" stroke-width="1.6" stroke-linecap="round" fill="none" />
    </svg>
  );
}

function HarvestBubble() {
  const h = harvest.value;
  const el = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!h) return;
    const p = sceneBridge.project?.('greenhouse');
    if (el.current && p) {
      // Zona segura: debajo de la barra superior, la pastilla y los avisos; dentro de la pantalla.
      const H = window.innerHeight;
      let floor = 0;
      let ceiling = H;
      document
        .querySelectorAll('.topbar, .act-pill, .daydone, .act-toast, .warn, .alert-toast, .coach, .feed, .resources, .hud__plan, .tablet:not(.tablet--away), .voice')
        .forEach((node) => {
          const r = node.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return;
          // Lo que vive en la mitad de arriba empuja hacia abajo; lo de abajo, hacia arriba.
          if (r.top + r.height / 2 < H / 2) floor = Math.max(floor, r.bottom);
          else ceiling = Math.min(ceiling, r.top);
        });
      const half = 38;
      const x = Math.min(window.innerWidth - half - 8, Math.max(half + 8, p.x));
      const y = Math.max(floor + half + 10, Math.min(ceiling - half - 10, p.y - 30));
      el.current.style.left = `${x}px`;
      el.current.style.top = `${y}px`;
    }
    // Si nadie la toca, se recoge sola (lo programa el estado): nunca bloquea el avance.
  }, [h?.key]);
  if (!h) return null;
  return (
    <button
      ref={el}
      type="button"
      class="harvest"
      aria-label={t('rewards.harvest')}
      onClick={() => {
        playCollect();
        collectHarvest(true);
      }}
    >
      <HarvestArt />
      <span class="harvest__plus" aria-hidden="true">+</span>
    </button>
  );
}

/** "Día 7 completado. Ahora planifica el Día 8": cierra un día y abre el siguiente, siempre. */
function DayDone() {
  const done = dayDone.value;
  useEffect(() => {
    if (!done) return;
    const hide = setTimeout(() => (dayDone.value = null), 3200);
    return () => clearTimeout(hide);
  }, [done?.key]);
  if (!done) return null;
  return (
    <p class="daydone" role="status" key={done.key}>
      <Icon name="check" size={18} />
      {t('rewards.day_done', { dia: done.day, siguiente: done.day + 1 })}
    </p>
  );
}

/** La voz de la tripulación: una burbuja de diálogo con su retrato, como en los juegos de rol. */
function CrewVoice() {
  const note = dayNote.value;
  useEffect(() => {
    if (!note) return;
    playDayDone();
    const hide = setTimeout(() => (dayNote.value = null), VOICE_MS);
    return () => clearTimeout(hide);
  }, [note?.key]);
  if (!note) return null;
  const member = crewById(note.crew);
  return (
    <div
      class={`voice voice--${note.mood}`}
      role="status"
      style={{ '--crew': member.css, '--life': `${VOICE_MS}ms` }}
      onClick={() => (dayNote.value = null)}
      key={note.key}
    >
      <span class="voice__portrait" aria-hidden="true">
        <CrewPortrait crew={member.id} color={member.css} size={64} mood={note.mood === 'worried' ? 'worried' : 'happy'} />
      </span>
      <div class="voice__bubble">
        <p class="voice__who">
          <strong>{crewName(note.crew)}</strong>
          <span>{t('rewards.day_label', { dia: note.day })}</span>
        </p>
        <p class="voice__line">{t(note.phrase, { nombre: playerName() })}</p>
        <span class="voice__timer" aria-hidden="true" />
      </div>
    </div>
  );
}

/** Dibujo de cada hito: mismo trazo que la ficha de cosecha (color plano y contorno oscuro). */
function MilestoneArt({ id }: { id: 'first_harvest' | 'first_night' | 'storm_safe' }) {
  if (id === 'first_harvest') return <HarvestArt />;
  if (id === 'first_night') {
    return (
      <svg class="celebrate__art" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M31 6.5a17.5 17.5 0 1 0 10.5 31A19.5 19.5 0 0 1 31 6.5Z" fill="#f4e7b8" stroke="#0b0c0e" stroke-width="2" stroke-linejoin="round" />
        <circle cx="21" cy="21" r="2.6" fill="#d9c98f" />
        <circle cx="27" cy="31" r="1.9" fill="#d9c98f" />
        <path d="M38 9l1.3 3.2 3.2 1.3-3.2 1.3L38 18l-1.3-3.2-3.2-1.3 3.2-1.3Z" fill="#ffb347" stroke="#0b0c0e" stroke-width="1.4" stroke-linejoin="round" />
        <path d="M9 8l.9 2.1 2.1.9-2.1.9L9 14l-.9-2.1L6 11l2.1-.9Z" fill="#8fe6f0" stroke="#0b0c0e" stroke-width="1.2" stroke-linejoin="round" />
      </svg>
    );
  }
  return (
    <svg class="celebrate__art" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 4.5 40 10v12.5c0 10-6.6 17-16 21-9.4-4-16-11-16-21V10Z" fill="#b9a4ff" stroke="#0b0c0e" stroke-width="2" stroke-linejoin="round" />
      <path d="M24 9.5 35.5 13.5v9c0 7.3-4.6 12.6-11.5 15.9Z" fill="#d6c9ff" />
      <path d="M16 24.5l6 6 11-12" fill="none" stroke="#0b0c0e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

function Celebration() {
  const id = milestone.value;
  const big = id === 'first_night';
  useEffect(() => {
    if (!id) return;
    playMilestone();
    const hide = setTimeout(dismissMilestone, big ? 3400 : 2600);
    return () => clearTimeout(hide);
  }, [id]);
  if (!id) return null;
  const pieces = big && !reduced() ? Array.from({ length: 28 }, (_, i) => i) : [];
  return (
    <div class={`celebrate${big ? ' celebrate--big' : ''}`} role="status" onClick={dismissMilestone}>
      {big && (
        <div class="celebrate__confetti" aria-hidden="true">
          {pieces.map((i) => (
            <span key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--d': `${(i % 6) * 0.08}s` }} />
          ))}
        </div>
      )}
      <div class="celebrate__card">
        <span class={`celebrate__badge celebrate__badge--${id}`} aria-hidden="true">
          <MilestoneArt id={id} />
        </span>
        <div>
          <p class="celebrate__kicker">{t('rewards.milestone')}</p>
          <p class="celebrate__title">{t(`rewards.${id}`)}</p>
        </div>
      </div>
    </div>
  );
}

export function Rewards() {
  const list = floats.value;
  return (
    <div class="rewards">
      {list.map((item, i) => (
        <Float key={item.key} item={item} index={i} />
      ))}
      <HarvestBubble />
      <DayDone />
      <CrewVoice />
      <Celebration />
    </div>
  );
}
