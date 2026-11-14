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
      const half = 30;
      const x = Math.min(window.innerWidth - half - 8, Math.max(half + 8, p.x));
      const y = Math.max(floor + half + 10, Math.min(ceiling - half - 10, p.y - 30));
      el.current.style.left = `${x}px`;
      el.current.style.top = `${y}px`;
    }
    // Si nadie la toca, se recoge sola: nunca bloquea el avance.
    const auto = setTimeout(() => collectHarvest(false), 3200);
    return () => clearTimeout(auto);
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
      <Icon name="food" size={24} />
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

const MILESTONE_ICON = { first_harvest: 'food', first_night: 'moon', storm_safe: 'shield' } as const;

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
        <span class="celebrate__badge" aria-hidden="true">
          <Icon name={MILESTONE_ICON[id]} size={big ? 34 : 24} />
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
