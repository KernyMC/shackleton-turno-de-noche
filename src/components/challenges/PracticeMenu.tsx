// «Minijuegos» desde la portada: lista de los retos diarios para probarlos sueltos, sin partida.
// Es práctica: no hay premios ni castigos y nada toca el estado del juego. Usa la dificultad Cadete.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { defaultConfig } from '../../sim/config';
import type { ChallengeDef } from '../../sim/types';
import { practiceChallenge, practiceOpen } from '../../state/practice';
import { Icon } from '../icons';
import { Challenge } from './ChallengeModal';
import { registry } from './registry';
import '../../styles/challenge.css';

export function PracticeMenu() {
  const [def, setDef] = useState<ChallengeDef | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  const open = practiceOpen.value;
  useEffect(() => {
    if (open && !def) first.current?.focus();
  }, [open, def]);
  if (!open) return null;
  useEffect(() => {
    practiceChallenge.value = def?.id ?? null;
    return () => {
      practiceChallenge.value = null;
    };
  }, [def]);

  if (def) return <Challenge key={def.id} def={def} assist={0} onFinish={() => setDef(null)} />;

  const list = defaultConfig.challenges.list.filter((c) => registry[c.id]);
  const close = (): void => {
    practiceOpen.value = false;
  };
  return (
    <div
      class="chl-overlay"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div class="chl-card chl-practice" role="dialog" aria-modal="true" aria-labelledby="chl-practice-title">
        <p class="chl-kicker">{t('practice.kicker')}</p>
        <h2 id="chl-practice-title" class="chl-title">{t('practice.title')}</h2>
        <p class="chl-text">{t('practice.text')}</p>
        <ul class="chl-practice-list">
          {list.map((c, i) => (
            <li key={c.id}>
              <button ref={i === 0 ? first : undefined} type="button" class="btn chl-practice-item" onClick={() => setDef(c)}>
                <span class="chl-practice-day">{t('practice.day', { n: c.day })}</span>
                <span class="chl-practice-name">{t(`challenge.${c.id}.title`)}</span>
                <Icon name="arrow" size={18} />
              </button>
            </li>
          ))}
        </ul>
        <div class="chl-actions">
          <button type="button" class="btn btn--ghost" onClick={close}>
            {t('practice.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
