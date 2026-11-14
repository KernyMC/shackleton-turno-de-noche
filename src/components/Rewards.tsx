// Capa de recompensas sobre el juego. Un canal por hecho:
//   - números que salen de cada módulo, uno tras otro, y viajan a su recurso (con su nota)
//   - la burbuja de cosecha sobre el invernadero
//   - la voz de la tripulación: burbuja de diálogo abajo a la izquierda, con retrato grande
//   - los hitos: tarjeta breve; confeti solo para la noche lunar superada
// Nada bloquea el avance; todo funciona con movimiento reducido.
import { useEffect, useRef } from 'preact/hooks';
import { crewById } from '../data/crew';
import { t } from '../i18n';
import { sceneBridge } from '../scene/bridge';
import { collectHarvest, dayNote, dismissMilestone, floats, harvest, milestone } from '../state/rewards';
import type { FloatItem } from '../state/rewards';
import { playCollect, playDayDone, playMilestone, playYield } from '../audio/sfx';
import { CrewPortrait } from './CrewPortrait';
import { Icon } from './icons';

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
      el.current.style.left = `${p.x}px`;
      el.current.style.top = `${p.y - 30}px`;
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
        <CrewPortrait color={member.css} size={64} mood={note.mood === 'worried' ? 'worried' : 'happy'} />
      </span>
      <div class="voice__bubble">
        <p class="voice__who">
          <strong>{t(`crew.${note.crew}.short`)}</strong>
          <span>{t('rewards.day_done', { dia: note.day })}</span>
        </p>
        <p class="voice__line">{t(note.phrase)}</p>
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
      <CrewVoice />
      <Celebration />
    </div>
  );
}
