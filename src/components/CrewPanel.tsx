// Panel de tripulación: las cuatro tarjetas con su rol, su ánimo y lo que hacen ahora.
// Tocar una tarjeta acerca la cámara a su módulo; un segundo toque (o el botón) vuelve a la base.
// Región no modal: no atrapa el foco; Esc la cierra y devuelve el foco al botón que la abrió.
import { useEffect, useRef } from 'preact/hooks';
import { CREW } from '../data/crew';
import type { CrewId } from '../data/crew';
import { t } from '../i18n';
import { sceneBridge } from '../scene/bridge';
import type { ModuleId } from '../sim/types';
import { crewActivity } from '../state/crewActivity';
import { crewFocus, crewOpen } from '../state/crewPanel';
import { faceOf, moodOf } from '../state/rewards';
import { game } from '../state/store';
import { CrewPortrait } from './CrewPortrait';
import { Icon } from './icons';
import type { IconName } from './icons';
import '../styles/crew.css';

const MOOD_ICON: Record<'happy' | 'neutral' | 'worried', IconName> = { happy: 'check', neutral: 'info', worried: 'alert' };

function closeCrew(): void {
  if (crewFocus.value) sceneBridge.centerOn?.(null);
  crewFocus.value = null;
  crewOpen.value = false;
}

function seeAll(): void {
  sceneBridge.centerOn?.(null);
  crewFocus.value = null;
}

function pick(id: CrewId, module: ModuleId): void {
  if (crewFocus.value === id) {
    seeAll();
    return;
  }
  crewFocus.value = id;
  sceneBridge.centerOn?.(module);
}

export function CrewPanel() {
  const g = game.value;
  const open = crewOpen.value;
  const root = useRef<HTMLElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    root.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closeCrew();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const el = opener.current;
      if (el instanceof HTMLElement && document.contains(el)) el.focus({ preventScroll: true });
    };
  }, [open]);

  if (!g || !open) return null;
  const moods = moodOf(g);
  return (
    <section class="crewp" ref={root} tabIndex={-1} role="region" aria-label={t('crew.panel.title')}>
      <header class="crewp__head">
        <h2 class="crewp__title">
          <Icon name="crew" size={18} />
          {t('crew.panel.title')}
        </h2>
        <button type="button" class="iconbtn crewp__close" onClick={closeCrew} aria-label={t('crew.panel.close')} title={t('crew.panel.close')}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <ul class="crewp__list">
        {CREW.map((c) => {
          const mood = faceOf(moods[c.id]);
          const act = crewActivity(g, c.id);
          const on = crewFocus.value === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                class={`crewp__card crewp__card--${mood}${on ? ' crewp__card--on' : ''}`}
                style={{ '--crew': c.css }}
                aria-pressed={on}
                onClick={() => pick(c.id, c.module)}
              >
                <span class="crewp__face">
                  <CrewPortrait crew={c.id} color={c.css} mood={mood} size={52} />
                </span>
                <span class="crewp__info">
                  <b class="crewp__name">{c.name}</b>
                  <span class="crewp__role">
                    <Icon name={c.roleIcon} size={14} />
                    {t(`crew.${c.id}.role`)}
                  </span>
                  <span class="crewp__module">{t('crew.cares', { modulo: t(`module.${c.module}`) })}</span>
                  <span class={`crewp__mood crewp__mood--${mood}`}>
                    <Icon name={MOOD_ICON[mood]} size={13} />
                    {t(`crew.mood.${mood}`)}
                  </span>
                  <span class={`crewp__act${act.special ? ' crewp__act--special' : ''}`}>
                    {t(act.key, act.vars ? { modulo: t(`module.${act.vars.module}`) } : {})}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" class="btn btn--small crewp__all" onClick={seeAll}>
        {t('crew.panel.all')}
      </button>
    </section>
  );
}
