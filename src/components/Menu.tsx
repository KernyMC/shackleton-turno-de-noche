// Pantalla de inicio "Conoce a tu tripulación": los cuatro astronautas en fila frente a la base,
// una cámara baja que hace travelling, el nombre de la comandante y la dificultad.
// Al comenzar, la cámara vuela hacia la base. Funciona con teclado, en celular y sin 3D.
import { useEffect, useRef, useState } from 'preact/hooks';
import { CREW, crewById } from '../data/crew';
import type { CrewId } from '../data/crew';
import { lang, t } from '../i18n';
import type { World } from '../scene/world';
import type { Difficulty } from '../sim/types';
import { loadSpaceWeather } from '../state/spaceWeather';
import { commanderName, setCommanderName, startGame } from '../state/store';
import { helpOpen } from '../state/tutorial';
import { CrewPortrait } from './CrewPortrait';
import { SunStatus } from './SunStatus';

const FLY_MS = 1500;
const NAME_MAX = 20;

export function Menu() {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const [focused, setFocused] = useState<CrewId | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('cadete');
  const [launching, setLaunching] = useState(false);
  const [has3d, setHas3d] = useState(true);

  // Consulta el Sol de hoy sin bloquear el menú.
  useEffect(() => void loadSpaceWeather(), []);

  // Escena 3D: la tripulación en fila frente a la base.
  useEffect(() => {
    let disposed = false;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    void import('../scene/world')
      .then(({ createWorld }) => {
        if (disposed || !host.current) return;
        const w = createWorld(host.current, {
          onHover: () => {},
          onSelect: () => {},
          onCrewHover: (id) => setFocused((id as CrewId | null) ?? null),
          onCrewSelect: (id) => setFocused(id as CrewId),
        });
        world.current = w;
        w.setReducedMotion(motion.matches);
        w.setSunlight(0.7);
        w.setLabelsVisible(false);
        CREW.forEach((c) => w.setModule(c.module, { efficiency: 0.8, broken: false }));
        w.showCrew(CREW.map((c) => ({ id: c.id, color: c.color })));
        // En pantallas anchas la tripulación queda a la derecha del panel.
        const wide = window.matchMedia('(min-width: 761px)');
        const place = (): void => w.setViewShift(0, wide.matches ? 0.17 : 0);
        place();
        wide.addEventListener('change', place);
      })
      .catch(() => setHas3d(false)); // sin WebGL: la tripulación se ve en los retratos SVG
    return () => {
      disposed = true;
      world.current?.dispose();
      world.current = null;
    };
  }, []);

  useEffect(() => world.current?.setCrewFocus(focused), [focused]);

  const launch = async (): Promise<void> => {
    if (launching) return;
    setLaunching(true);
    setFocused(null);
    try {
      // Tope de tiempo: si la pestaña se oculta y la animación se pausa, la partida empieza igual.
      await Promise.race([world.current?.flyIn(FLY_MS), new Promise((r) => setTimeout(r, FLY_MS + 400))]);
    } finally {
      startGame(difficulty);
    }
  };

  const member = focused ? crewById(focused) : null;

  return (
    <div class={`crewscreen${launching ? ' crewscreen--launching' : ''}${has3d ? '' : ' crewscreen--flat'}`}>
      <div class="crewscreen__scene" ref={host} aria-hidden="true" />

      <header class="crewscreen__title">
        <p class="card__kicker">{t('menu.kicker')}</p>
        <h1>{t('app.title')}</h1>
      </header>


      <main class="crewscreen__panel">
        <h2>{t('crew.title')}</h2>
        <ul class="crewlist" aria-label={t('crew.title')}>
          {CREW.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                class={`crewchip${focused === c.id ? ' crewchip--on' : ''}`}
                style={{ '--crew': c.css }}
                aria-pressed={focused === c.id}
                onMouseEnter={() => setFocused(c.id)}
                onFocus={() => setFocused(c.id)}
                onClick={() => setFocused(c.id)}
              >
                <CrewPortrait color={c.css} size={44} />
                <span class="crewchip__name">{t(`crew.${c.id}.short`)}</span>
                <span class="crewchip__role">{t(`module.${c.module}`)}</span>
              </button>
            </li>
          ))}
        </ul>

        {member && (
          <aside class="crewcard" style={{ '--crew': member.css }} aria-live="polite">
            <CrewPortrait color={member.css} size={64} />
            <div>
              <p class="crewcard__name">{t(`crew.${member.id}.name`)}</p>
              <p class="crewcard__role">{t(`crew.${member.id}.role`)}</p>
              <p class="crewcard__module">{t('crew.cares', { modulo: t(`module.${member.module}`) })}</p>
              <p class="crewcard__quote">“{t(`crew.${member.id}.quote`)}”</p>
            </div>
          </aside>
        )}
        <label class="commander">
          <span>{t('crew.commander_label')}</span>
          <input
            type="text"
            maxLength={NAME_MAX}
            value={commanderName.value}
            placeholder={t('crew.commander_default')}
            autoComplete="off"
            onInput={(e) => setCommanderName(e.currentTarget.value)}
          />
        </label>

        <div class="difficulty" role="radiogroup" aria-label={t('crew.difficulty')}>
          {(['cadete', 'comandante'] as Difficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={difficulty === d}
              class={`difficulty__btn${difficulty === d ? ' difficulty__btn--on' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              <strong>{t(`menu.mission.${d}`)}</strong>
              <span>{t(`menu.mission.${d}.what`)}</span>
            </button>
          ))}
        </div>

        <button type="button" class="btn btn--primary crewscreen__go" disabled={launching} onClick={launch}>
          {t('crew.start')}
        </button>

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
