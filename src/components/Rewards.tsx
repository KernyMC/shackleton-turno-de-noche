// Capa de recompensas sobre el juego: números que salen de cada módulo y viajan a su barra del
// HUD, la burbuja de cosecha, la frase de la tripulación al terminar el día y la celebración de
// hitos con confeti sutil. Nada bloquea el avance; todo funciona con movimiento reducido.
import { useEffect, useRef } from 'preact/hooks';
import { crewById } from '../data/crew';
import { t } from '../i18n';
import { sceneBridge } from '../scene/bridge';
import { collectHarvest, dayNote, dismissMilestone, floats, harvest, milestone } from '../state/rewards';
import type { FloatItem } from '../state/rewards';
import { playCollect, playDayDone, playMilestone } from '../audio/sfx';
import { CrewPortrait } from './CrewPortrait';
import { Icon } from './icons';

const reduced = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TARGET_SELECTOR: Record<FloatItem['target'], string> = { vitals: '.hud__zone--bl', dose: '.hud__zone--tl', none: '' };

function Float({ item, index }: { item: FloatItem; index: number }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = el.current;
    const from = sceneBridge.project?.(item.module);
    if (!node || !from) return;
    node.style.left = `${from.x}px`;
    node.style.top = `${from.y}px`;
    const target = TARGET_SELECTOR[item.target] ? document.querySelector(TARGET_SELECTOR[item.target]) : null;
    const rect = target?.getBoundingClientRect();
    const dx = rect ? rect.left + rect.width / 2 - from.x : 0;
    const dy = rect ? rect.top + rect.height / 2 - from.y : -60;
    const animation = reduced()
      ? node.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1600 })
      : node.animate(
          [
            { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
            { transform: 'translate(-50%, -110%) scale(1.15)', opacity: 1, offset: 0.25 },
            { transform: 'translate(-50%, -110%) scale(1)', opacity: 1, offset: 0.5 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6)`, opacity: 0.2 },
          ],
          { duration: 1700, delay: index * 140, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' },
        );
    animation.onfinish = () => node.remove();
    return () => animation.cancel();
  }, [item.key]);
  return (
    <div ref={el} class={`float float--${item.icon}`} aria-hidden="true">
      <Icon name={item.icon} size={16} />
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
    const auto = setTimeout(() => collectHarvest(false), 3000);
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
      <Icon name="food" size={22} />
      <span>+XP</span>
    </button>
  );
}

function DayNoteToast() {
  const note = dayNote.value;
  useEffect(() => {
    if (!note) return;
    playDayDone();
    const hide = setTimeout(() => (dayNote.value = null), 3600);
    return () => clearTimeout(hide);
  }, [note?.key]);
  if (!note) return null;
  const member = crewById(note.crew);
  return (
    <div class="daynote" role="status" style={{ '--crew': member.css }}>
      <span class="daynote__check" aria-hidden="true">
        <Icon name="check" size={20} />
      </span>
      <div>
        <p class="daynote__title">{t('rewards.day_done', { dia: note.day })}</p>
        <p class="daynote__line">
          <CrewPortrait color={member.css} size={22} />
          <span>
            <strong>{t(`crew.${note.crew}.short`)}:</strong> “{t(note.phrase)}”
          </span>
        </p>
      </div>
    </div>
  );
}

function Celebration() {
  const id = milestone.value;
  useEffect(() => {
    if (!id) return;
    playMilestone();
    const hide = setTimeout(dismissMilestone, 3200);
    return () => clearTimeout(hide);
  }, [id]);
  if (!id) return null;
  const pieces = reduced() ? [] : Array.from({ length: 24 }, (_, i) => i);
  return (
    <div class="celebrate" role="status" onClick={dismissMilestone}>
      <div class="celebrate__confetti" aria-hidden="true">
        {pieces.map((i) => (
          <span key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--d': `${(i % 6) * 0.08}s` }} />
        ))}
      </div>
      <div class="celebrate__card">
        <span class="celebrate__badge" aria-hidden="true">
          <Icon name={id === 'first_harvest' ? 'food' : id === 'first_night' ? 'moon' : 'shield'} size={34} />
        </span>
        <p class="celebrate__kicker">{t('rewards.milestone')}</p>
        <p class="celebrate__title">{t(`rewards.${id}`)}</p>
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
      <DayNoteToast />
      <Celebration />
    </div>
  );
}
