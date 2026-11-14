// Raíz de la app: máquina de estados de pantallas (por ahora solo menú y juego).
import { lang, t } from '../i18n';
import { Scene } from '../scene/Scene';
import { getEnergyBudget } from '../sim/engine';
import { defaultConfig } from '../sim/config';
import {
  applyPreset,
  chooseEventOption,
  executeDay,
  exitToMenu,
  game,
  plan,
  resolving,
  restart,
  screen,
  setPlanValue,
  startGame,
  tabletOpen,
  toggleTablet,
} from '../state/store';

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

// PROVISIONAL: las tareas C-03 (planificador) y C-04 (eventos) reemplazan esta tablet.
// Solo sirve para jugar una partida completa mientras tanto.
function Tablet() {
  const g = game.value;
  if (!tabletOpen.value || !g) return null;
  const event = g.phase === 'event' ? g.pendingEvent : null;
  return (
    <div class="tablet" role="dialog" aria-modal="true" aria-labelledby="tablet-title">
      <h2 id="tablet-title">{t('tablet.title')}</h2>
      {event ? (
        <div class="tablet__options">
          <p>{event.kind} {String(event.payload?.level ?? event.payload?.module ?? '')}</p>
          {event.options.map((o) => (
            <button key={o.id} type="button" class="btn" disabled={!!o.disabledReason}
              title={o.disabledReason ? t(o.disabledReason) : undefined}
              onClick={() => chooseEventOption(o.id)}>
              {o.id}
            </button>
          ))}
        </div>
      ) : (
        <>
          {(['recycler', 'greenhouse', 'shield', 'workshop'] as const).map((id) => (
            <label key={id} class="tablet__row">
              <span>{t(`module.${id}`)}</span>
              <input type="range" min={0} max={defaultConfig.balance.modules[id].maxEnergy}
                value={plan.value[id]} disabled={g.modules[id].broken || resolving.value}
                onInput={(e) => setPlanValue(id, Number(e.currentTarget.value))} />
              <b>{plan.value[id]}</b>
            </label>
          ))}
          <div class="tablet__options">
            <button type="button" class="btn" onClick={() => applyPreset('saving')}>ahorro</button>
            <button type="button" class="btn btn--primary" disabled={resolving.value} onClick={executeDay}>
              {resolving.value ? t('tablet.resolving') : t('tablet.execute')}
            </button>
          </div>
        </>
      )}
      {!event && <button type="button" class="btn btn--ghost" onClick={toggleTablet}>✕</button>}
    </div>
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
