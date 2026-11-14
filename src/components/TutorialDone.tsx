// Tarjeta «¡Tutorial completado!»: sale al cerrar el día 5 del modo Tutorial (o al saltarlo).
// Resume lo aprendido en tres íconos y ofrece empezar la misión, repetir o salir al menú.
// Espera a que terminen los avisos de fin de día para no montarse encima de ellos.
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import { dayDone, milestone, reacting } from '../state/rewards';
import { exitToMenu, resolving } from '../state/store';
import { startNormal, startTutorial } from '../state/mode';
import { Icon } from './icons';
import type { IconName } from './icons';
import '../styles/tutorial.css';

const LEARNED: [IconName, string][] = [
  ['battery', 'tut.done.l1'],
  ['life_support', 'tut.done.l2'],
  ['info', 'tut.done.l3'],
];

export function TutorialDone() {
  const primary = useRef<HTMLButtonElement>(null);
  const waiting = dayDone.value !== null || milestone.value !== null || reacting.value || resolving.value;
  useEffect(() => {
    if (!waiting) primary.current?.focus();
  }, [waiting]);
  if (waiting) return null;

  // Tab se queda dentro de la tarjeta.
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return;
    const items = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button')];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div class="overlay tut-done" onKeyDown={onKey}>
      <section class="card tut-done__card" role="dialog" aria-modal="true" aria-labelledby="tut-done-title">
        <p class="card__kicker">{t('menu.mission.tutorial')}</p>
        <h2 id="tut-done-title">{t('tut.done.title')}</h2>
        <p class="tut-done__sub">{t('tut.done.sub')}</p>
        <ul class="tut-done__learned">
          {LEARNED.map(([icon, key]) => (
            <li key={key}>
              <span class="tut-done__icon" aria-hidden="true">
                <Icon name={icon} size={26} />
              </span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
        <div class="tut-done__actions">
          <button ref={primary} type="button" class="btn btn--primary" onClick={() => startNormal('cadete')}>
            {t('tut.done.start')}
          </button>
          <button type="button" class="btn" onClick={startTutorial}>
            {t('tut.done.repeat')}
          </button>
          <button type="button" class="linkbtn" onClick={exitToMenu}>
            {t('tut.done.menu')}
          </button>
        </div>
      </section>
    </div>
  );
}
