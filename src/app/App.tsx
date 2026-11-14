// Raíz de la app: máquina de estados de pantallas (por ahora solo menú y juego).
import { lang, t } from '../i18n';
import { Scene } from '../scene/Scene';
import { useEffect } from 'preact/hooks';
import { Coach } from '../components/Coach';
import { Hud } from '../components/Hud';
import { SunStatus } from '../components/SunStatus';
import { Tablet } from '../components/Tablet';
import { loadSpaceWeather } from '../state/spaceWeather';
import { startTutorialWatcher } from '../state/tutorial';
import { exitToMenu, game, restart, screen, startGame } from '../state/store';

function Menu() {
  // Consulta el Sol de hoy sin bloquear el menú.
  useEffect(() => void loadSpaceWeather(), []);
  return (
    <main class="menu">
      <h1>{t('app.title')}</h1>
      <p class="menu__subtitle">{t('app.subtitle')}</p>
      <div class="menu__actions">
        <button type="button" class="btn btn--primary" onClick={() => startGame('cadete')}>
          {t('menu.new_cadete')}
        </button>
        <button type="button" class="btn" onClick={() => startGame('comandante')}>
          {t('menu.new_comandante')}
        </button>
        <button type="button" class="btn btn--ghost" onClick={() => (lang.value = lang.value === 'es' ? 'en' : 'es')}>
          {lang.value === 'es' ? 'English' : 'Español'}
        </button>
      </div>
      <SunStatus />
      <footer class="menu__footer">{t('app.disclaimer')}</footer>
    </main>
  );
}

// PROVISIONAL: la tarea C-05 lo reemplaza.
function Debrief() {
  const r = game.value?.result;
  if (!r) return null;
  return (
    <main class="menu">
      <h1>{r.outcome === 'win' ? `${t('debrief.win')} ${'★'.repeat(r.stars)}` : t('debrief.loss', { dia: r.day })}</h1>
      <p class="menu__subtitle">{r.causes.join(', ')}</p>
      <div class="menu__actions">
        <button type="button" class="btn btn--primary" onClick={restart}>{t('debrief.again')}</button>
        <button type="button" class="btn" onClick={exitToMenu}>{t('menu.back')}</button>
      </div>
    </main>
  );
}

export default function App() {
  // La guía de la primera partida observa el juego desde que arranca la app.
  useEffect(() => startTutorialWatcher(), []);
  if (screen.value === 'menu') return <Menu />;
  if (screen.value === 'debrief') return <Debrief />;
  return (
    <div class="game">
      <Scene />
      <Hud />
      <Tablet />
      <Coach />
    </div>
  );
}
