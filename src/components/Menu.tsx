// Inicio en dos pasos, sobre la misma escena 3D:
//   1. Portada estilo póster: la tripulación de cerca, la Tierra grande, un cohete subiendo y el
//      logo. Un solo botón grande: «Comenzar».
//   2. La tripulación en fila: conocerlos, escribir el nombre de comandante y elegir dificultad.
// Al empezar la misión, la tripulación camina hasta la escotilla del refugio, entra y la cámara
// vuela a la base. Funciona con teclado, en celular y sin 3D (retratos SVG).
import { useEffect, useRef, useState } from 'preact/hooks';
import { CREW, crewById, crewFullName, crewName } from '../data/crew';
import type { CrewId } from '../data/crew';
import { lang, t } from '../i18n';
import type { World } from '../scene/world';
import type { Difficulty } from '../sim/types';
import { clearReady, markReady } from '../state/loading';
import { loadSpaceWeather } from '../state/spaceWeather';
import { commanderName, setCommanderName, startGame } from '../state/store';
import { sourcesOpen } from '../state/sources';
import { helpOpen } from '../state/tutorial';
import { CrewPortrait } from './CrewPortrait';
import { SunStatus } from './SunStatus';

/** Duración de la secuencia de entrada (caminar + vuelo de cámara). */
const ENTER_MS = 3600;
const NAME_MAX = 20;
type Step = 'title' | 'crew';

function LanguageButton() {
  return (
    <button
      type="button"
      class="linkbtn"
      lang={lang.value === 'es' ? 'en' : 'es'}
      onClick={() => (lang.value = lang.value === 'es' ? 'en' : 'es')}
    >
      {lang.value === 'es' ? 'English' : 'Español'}
    </button>
  );
}

export function Menu() {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState<Step>('title');
  const stepRef = useRef<Step>('title');
  const placeRef = useRef<() => void>(() => {});
  const [focused, setFocused] = useState<CrewId | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('cadete');
  const [launching, setLaunching] = useState(false);
  const [has3d, setHas3d] = useState(true);

  // Consulta el Sol de hoy sin bloquear el menú.
  useEffect(() => void loadSpaceWeather(), []);

  // Escena 3D compartida por los dos pasos.
  useEffect(() => {
    let disposed = false;
    let removePlace: (() => void) | undefined;
    let stopReady: (() => void) | undefined;
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
        w.setLabelsVisible(false);
        CREW.forEach((c) => w.setModule(c.module, { efficiency: 0.8, broken: false }));
        w.showCrew(CREW.map((c) => ({ id: c.id, color: c.color })));
        w.setIntroView('title');
        w.setSunlight(0.35);
        const wide = window.matchMedia('(min-width: 761px)');
        const place = (): void => w.setViewShift(0, wide.matches && stepRef.current === 'crew' ? 0.15 : 0);
        placeRef.current = place;
        place();
        wide.addEventListener('change', place);
        removePlace = () => wide.removeEventListener('change', place);
        // La pantalla de carga sigue hasta que la base está completa (modelos y shaders listos).
        void w.ready.then(() => {
          if (!disposed) stopReady = markReady('menu');
        });
      })
      .catch(() => {
        if (disposed) return;
        setHas3d(false); // sin WebGL: la tripulación se ve en los retratos SVG
        stopReady = markReady('menu');
      });
    return () => {
      disposed = true;
      removePlace?.();
      stopReady?.();
      clearReady('menu');
      world.current?.dispose();
      world.current = null;
    };
  }, []);

  useEffect(() => world.current?.setCrewFocus(step === 'crew' ? focused : null), [focused, step]);
  useEffect(() => startButton.current?.focus(), [step]);

  const toCrew = (): void => {
    stepRef.current = 'crew';
    placeRef.current();
    setStep('crew');
    world.current?.setIntroView('crew');
    world.current?.setSunlight(0.7);
  };
  const toTitle = (): void => {
    stepRef.current = 'title';
    placeRef.current();
    setStep('title');
    setFocused(null);
    world.current?.setIntroView('title');
    world.current?.setSunlight(0.35);
  };

  const launch = async (): Promise<void> => {
    if (launching) return;
    setLaunching(true);
    setFocused(null);
    try {
      // Tope de tiempo: si la pestaña se oculta y la animación se pausa, la partida empieza igual.
      await Promise.race([world.current?.flyIn(ENTER_MS), new Promise((r) => setTimeout(r, ENTER_MS + 500))]);
    } finally {
      startGame(difficulty);
    }
  };

  const member = focused ? crewById(focused) : null;
  const classes = ['crewscreen', `crewscreen--${step}`, launching ? 'crewscreen--launching' : '', has3d ? '' : 'crewscreen--flat'];

  return (
    <div class={classes.join(' ')}>
      <div class="crewscreen__scene" ref={host} aria-hidden="true" />

      {step === 'title' ? (
        <main class="title">
          {!has3d && (
            <div class="title__crew" aria-hidden="true">
              {CREW.map((c) => <CrewPortrait key={c.id} crew={c.id} color={c.css} size={88} />)}
            </div>
          )}
          <div class="title__logo">
            <p class="title__kicker">{t('menu.kicker')}</p>
            <h1 class="title__name">SHACKLETON</h1>
            <p class="title__bar">{t('title.subtitle')}</p>
            <p class="title__pitch">{t('title.pitch')}</p>
            <button ref={startButton} type="button" class="btn btn--primary title__start" onClick={toCrew}>
              {t('title.start')}
            </button>
            <nav class="title__links" aria-label={t('crew.more')}>
              <button type="button" class="linkbtn" onClick={() => (helpOpen.value = true)}>
                {t('help.button')}
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" class="linkbtn" onClick={() => (sourcesOpen.value = true)}>
                {t('sources.button')}
              </button>
              <span aria-hidden="true">·</span>
              <LanguageButton />
            </nav>
            <SunStatus compact />
          </div>
          <footer class="title__footer">
            <span>{t('app.disclaimer')}</span>
            <span>{t('title.team')}</span>
          </footer>
        </main>
      ) : (
        <main class="crewscreen__panel">
          <button type="button" class="linkbtn crewscreen__back" onClick={toTitle} disabled={launching}>
            ← {t('crew.back')}
          </button>
          <h2 class="crewscreen__heading">{t('crew.title')}</h2>
          <ul class="crewlist">
            {CREW.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  class={`crewchip${focused === c.id ? ' crewchip--on' : ''}`}
                  style={{ '--crew': c.css }}
                  aria-pressed={focused === c.id}
                  aria-label={`${crewFullName(c.id)}, ${t(`crew.${c.id}.role`)}`}
                  onMouseEnter={() => setFocused(c.id)}
                  onFocus={() => setFocused(c.id)}
                  onClick={() => setFocused(c.id)}
                >
                  <CrewPortrait crew={c.id} color={c.css} size={has3d ? 40 : 56} />
                  <span class="crewchip__name">{crewName(c.id)}</span>
                </button>
              </li>
            ))}
          </ul>
          {member ? (
            <p class="crewcard" style={{ '--crew': member.css }} aria-live="polite">
              <strong>{crewFullName(member.id)}</strong> · {t(`crew.${member.id}.role`)}
              <span class="crewcard__quote">“{t(`crew.${member.id}.quote`)}”</span>
            </p>
          ) : (
            <p class="crewcard crewcard--hint">{t('crew.hint')}</p>
          )}

          <input
            class="commander"
            type="text"
            maxLength={NAME_MAX}
            value={commanderName.value}
            placeholder={t('crew.commander_placeholder')}
            aria-label={t('crew.commander_label')}
            autoComplete="off"
            onInput={(e) => setCommanderName(e.currentTarget.value)}
          />
          <div class="segmented" role="radiogroup" aria-label={t('crew.difficulty')}>
            {(['cadete', 'comandante'] as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={difficulty === d}
                class={`segmented__btn${difficulty === d ? ' segmented__btn--on' : ''}`}
                onClick={() => setDifficulty(d)}
              >
                <strong>{t(`menu.mission.${d}`)}</strong>
                <span>{t(`menu.mission.${d}.what`)}</span>
              </button>
            ))}
          </div>
          <button ref={startButton} type="button" class="btn btn--primary crewscreen__go" disabled={launching} onClick={launch}>
            {t('crew.start')}
          </button>
        </main>
      )}
    </div>
  );
}
