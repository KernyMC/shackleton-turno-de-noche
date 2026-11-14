// Menú de inicio: la base lunar viva de fondo, el título y dos formas de empezar.
// Debe enganchar en segundos: una imagen, una frase y un botón grande.
import { useEffect, useRef } from 'preact/hooks';
import { lang, t } from '../i18n';
import { defaultConfig } from '../sim/config';
import type { Difficulty } from '../sim/types';
import type { World } from '../scene/world';
import { loadSpaceWeather } from '../state/spaceWeather';
import { startGame } from '../state/store';
import { helpOpen } from '../state/tutorial';
import { Icon } from './icons';
import type { IconName } from './icons';
import { SunStatus } from './SunStatus';

/** La base de fondo: misma maqueta del juego, girando sola y con sus luces encendidas. */
function Backdrop() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let world: World | null = null;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const wide = window.matchMedia('(min-width: 900px)');
    // En pantallas anchas la base va a la derecha del texto; en estrechas, arriba.
    const place = (): void => world?.setViewShift(wide.matches ? 0.04 : 0.24, wide.matches ? 0.24 : 0);
    void import('../scene/world')
      .then(({ createWorld }) => {
        if (disposed || !host.current) return;
        // Solo decorativa: no avisa de toques ni cambia nada.
        world = createWorld(host.current, { onHover: () => {}, onSelect: () => {} });
        world.setReducedMotion(motion.matches);
        world.setSunlight(0.55);
        world.setSunAzimuth(0.9);
        world.setModule('recycler', { efficiency: 0.9, broken: false });
        world.setModule('greenhouse', { efficiency: 0.7, broken: false });
        world.setModule('shield', { efficiency: 0.8, broken: false });
        world.setModule('workshop', { efficiency: 0.5, broken: false });
        world.setLabelsVisible(false);
        place();
      })
      .catch(() => {
        // Sin WebGL el menú funciona igual, con fondo liso.
      });
    wide.addEventListener('change', place);
    return () => {
      disposed = true;
      wide.removeEventListener('change', place);
      world?.dispose();
    };
  }, []);
  return <div class="menu__backdrop" ref={host} aria-hidden="true" />;
}

/** Tres diferencias de cada dificultad, leídas de balance.json. */
function facts(difficulty: Difficulty): [IconName, string][] {
  const d = defaultConfig.balance.difficulty[difficulty];
  return [
    ['sun', t(d.stormCount === 1 ? 'menu.fact.storm' : 'menu.fact.storms', { n: d.stormCount })],
    ['moon', t(d.nightLightBonus > 0 ? 'menu.fact.night_soft' : 'menu.fact.night_dark')],
    ['dose', t('menu.fact.dose', { n: d.doseLimit })],
  ];
}

function MissionCard({ difficulty, recommended }: { difficulty: Difficulty; recommended?: boolean }) {
  return (
    <button
      type="button"
      class={`mission${recommended ? ' mission--recommended' : ''}`}
      onClick={() => startGame(difficulty)}
    >
      <span class="mission__head">
        <strong>{t(`menu.mission.${difficulty}`)}</strong>
        {recommended && <span class="option__tag">{t('menu.recommended')}</span>}
      </span>
      <span class="mission__what">{t(`menu.mission.${difficulty}.what`)}</span>
      <span class="mission__facts">
        {facts(difficulty).map(([icon, text]) => (
          <span key={text}>
            <Icon name={icon} size={16} />
            {text}
          </span>
        ))}
      </span>
      <span class="mission__go">{t('menu.start')}</span>
    </button>
  );
}

export function Menu() {
  // Consulta el Sol de hoy sin bloquear el menú.
  useEffect(() => void loadSpaceWeather(), []);
  const days = defaultConfig.balance.days;
  const crew = defaultConfig.balance.difficulty.cadete.crew;
  return (
    <div class="menu">
      <Backdrop />
      <main class="menu__content">
        <header class="menu__title">
          <p class="card__kicker">{t('menu.kicker')}</p>
          <h1>{t('app.title')}</h1>
          <p class="menu__subtitle">{t('menu.pitch', { dias: days, personas: crew })}</p>
        </header>

        <div class="menu__missions">
          <MissionCard difficulty="cadete" recommended />
          <MissionCard difficulty="comandante" />
        </div>

        <div class="menu__row">
          <button type="button" class="btn btn--small" onClick={() => (helpOpen.value = true)}>
            {t('help.button')}
          </button>
          <button
            type="button"
            class="btn btn--small btn--ghost"
            lang={lang.value === 'es' ? 'en' : 'es'}
            onClick={() => (lang.value = lang.value === 'es' ? 'en' : 'es')}
          >
            {lang.value === 'es' ? 'English' : 'Español'}
          </button>
        </div>

        <SunStatus />
        <footer class="menu__footer">{t('app.disclaimer')}</footer>
      </main>
    </div>
  );
}
