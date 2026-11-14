// Raíz de la app: máquina de estados de pantallas (por ahora solo menú y juego).
import { lang, t } from '../i18n';
import { Scene } from '../scene/Scene';
import { getEnergyBudget } from '../sim/engine';
import { defaultConfig } from '../sim/config';
import { Tablet } from '../components/Tablet';
import { exitToMenu, game, restart, screen, startGame } from '../state/store';

function Menu() {
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
      <footer class="menu__footer">{t('app.disclaimer')}</footer>
    </main>
  );
}

function Hud() {
  const g = game.value;
  if (!g) return null;
  const d = defaultConfig.balance.difficulty[g.difficulty];
  const budget = getEnergyBudget(g);
  const round = (n: number): number => Math.round(n * 10) / 10;
  return (
    <header class="hud">
      <span class="hud__day">{t('hud.day', { dia: g.day, total: defaultConfig.balance.days })}</span>
      <span>🔋 {t('hud.battery')} <b>{round(g.battery)} / {d.batteryCapacity}</b></span>
      <span>♻️ {t('hud.life_support')} <b>{round(g.lifeSupport)}%</b></span>
      <span>🌱 {t('hud.food')} <b>{round(g.food)}%</b></span>
      <span>☢️ {t('hud.dose')} <b>{round(g.dose)} / {d.doseLimit} mSv</b></span>
      <span title={t('hud.breakdown', { bateria: round(g.battery), sol: round(budget.solar), base: budget.base })}>
        {t('hud.available', { valor: round(budget.available) })}
      </span>
      <button type="button" class="btn btn--ghost" onClick={exitToMenu}>{t('menu.back')}</button>
    </header>
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
  if (screen.value === 'menu') return <Menu />;
  if (screen.value === 'debrief') return <Debrief />;
  return (
    <div class="game">
      <Scene />
      <Hud />
      <Tablet />
    </div>
  );
}
