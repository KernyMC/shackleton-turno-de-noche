// Raíz de la app: máquina de estados de pantallas (por ahora solo menú y juego).
import { lang, t } from '../i18n';
import { Scene } from '../scene/Scene';
import { getEnergyBudget } from '../sim/engine';
import { defaultConfig } from '../sim/config';
import { exitToMenu, game, screen, startGame, tabletOpen, toggleTablet } from '../state/store';

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

function Tablet() {
  if (!tabletOpen.value) return null;
  return (
    <div class="tablet" role="dialog" aria-modal="true" aria-labelledby="tablet-title">
      <h2 id="tablet-title">{t('tablet.title')}</h2>
      <p>{t('tablet.placeholder')}</p>
      <button type="button" class="btn" onClick={toggleTablet}>✕</button>
    </div>
  );
}

export default function App() {
  if (screen.value === 'menu') return <Menu />;
  return (
    <div class="game">
      <Scene />
      <Hud />
      <Tablet />
    </div>
  );
}
