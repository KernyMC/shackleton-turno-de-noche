// Visor del juego con la distribución de un shooter en primera persona, que los niños ya conocen:
//   arriba al centro  → marcador: día y cuenta hacia la noche lunar (tira de 30 días)
//   arriba izquierda  → dial circular: dosis de radiación
//   arriba derecha    → feed: últimas líneas de la bitácora
//   abajo izquierda   → "salud": soporte vital y comida
//   abajo derecha     → "munición": batería actual / capacidad
// Solo lee el store. El estado nunca se comunica solo con color: siempre ícono + palabra.
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { getLight } from '../sim/engine';
import type { GameState, LogEntry } from '../sim/types';
import { budget, exitToMenu, game, skyView, tabletOpen, toggleTablet } from '../state/store';
import { helpOpen } from '../state/tutorial';
import { xp } from '../state/rewards';
import { num, signed } from './format';
import { Icon } from './icons';

type Level = 'ok' | 'low' | 'critical';

/** Umbrales de §4.7 del documento original. */
function resourceLevel(value: number): Level {
  if (value <= 10) return 'critical';
  if (value <= 25) return 'low';
  return 'ok';
}
function doseLevel(fraction: number): Level {
  if (fraction >= 0.9) return 'critical';
  if (fraction >= 0.7) return 'low';
  return 'ok';
}

function Status({ level, low, critical }: { level: Level; low: string; critical: string }) {
  if (level === 'ok') return null;
  return (
    <span class={`hud__status hud__status--${level}`}>
      <Icon name="alert" size={14} />
      {t(level === 'critical' ? critical : low)}
    </span>
  );
}

function Bar({ value, max, level, label }: { value: number; max: number; level: Level; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      class={`hud__bar hud__bar--${level}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

function Trend({ delta }: { delta: number | null }) {
  if (delta === null || Math.abs(delta) < 0.05) return null;
  return <span class="hud__trend">{delta > 0 ? '▲' : '▼'} {signed(delta)}</span>;
}

/** Cambio del último día en un valor del historial. */
function lastDelta(g: GameState, key: 'lifeSupport' | 'food' | 'battery' | 'dose'): number | null {
  const h = g.history;
  if (h.length === 0) return null;
  const now = h[h.length - 1]![key];
  const before = h.length > 1 ? h[h.length - 2]![key] : null;
  if (before !== null) return now - before;
  const d = defaultConfig.balance.difficulty[g.difficulty];
  const start = { lifeSupport: d.lifeSupportStart, food: d.foodStart, battery: d.batteryStart, dose: 0 }[key];
  return now - start;
}

/** Marcador central: día, tira de 30 días con la noche marcada y cuenta hacia la noche. */
function Scoreboard({ g }: { g: GameState }) {
  const total = defaultConfig.balance.days;
  const nights = defaultConfig.light.nightDays;
  const firstNight = Math.min(...nights);
  const lastNight = Math.max(...nights);
  let nightText: string | null = null;
  if (g.day < firstNight) nightText = t(firstNight - g.day === 1 ? 'hud.night_tomorrow' : 'hud.night_in', { dias: firstNight - g.day });
  else if (g.day <= lastNight) nightText = t('hud.night_now', { dias: lastNight - g.day + 1 });

  return (
    <div class="hud__zone hud__zone--top">
      <p class="hud__day">
        {t('hud.day_label')} <b>{String(g.day).padStart(2, '0')}</b>
        <span class="hud__dim">/ {total}</span>
        <span class="hud__xp">{xp.value} XP</span>
      </p>
      <div class="hud__progress">
        <span class="hud__rocket" style={{ left: `${((g.day - 1) / (total - 1)) * 100}%` }} aria-hidden="true">
          <svg viewBox="0 0 20 20" width="16" height="16"><path d="M10 2c2.5 2 3.6 5 3.6 8.4l1.9 2.4-2.6.6-.9 2.6h-4l-.9-2.6-2.6-.6 1.9-2.4C6.4 7 7.5 4 10 2Z" fill="currentColor" /></svg>
        </span>
        <span class="hud__ship" aria-hidden="true" title={t('hud.relief_ship')}>
          <svg viewBox="0 0 20 20" width="14" height="14"><circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M2 10h4M14 10h4" stroke="currentColor" stroke-width="1.6" /></svg>
        </span>
      <ol class="hud__days" aria-label={t('hud.days_strip')}>
        {Array.from({ length: total }, (_, i) => {
          const day = i + 1;
          const cls = [
            'hud__dot',
            nights.includes(day) ? 'hud__dot--night' : '',
            day < g.day ? 'hud__dot--past' : '',
            day === g.day ? 'hud__dot--today' : '',
          ].join(' ');
          return <li key={day} class={cls} />;
        })}
      </ol>
      </div>
      {nightText && (
        <p class={`hud__night${g.day >= firstNight ? ' hud__night--now' : ''}`}>
          <Icon name="moon" size={14} />
          {nightText}
        </p>
      )}
    </div>
  );
}

/** Dial circular de dosis de radiación (el "minimapa"). */
function DoseDial({ g }: { g: GameState }) {
  const limit = defaultConfig.balance.difficulty[g.difficulty].doseLimit;
  const fraction = Math.min(1, g.dose / limit);
  const level = doseLevel(fraction);
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div class="hud__zone hud__zone--tl">
      <div
        class={`hud__dial hud__dial--${level}`}
        role="progressbar"
        aria-label={t('hud.dose')}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.round(g.dose)}
      >
        <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
          <circle class="hud__dial-track" cx="32" cy="32" r={r} />
          <circle
            class="hud__dial-fill"
            cx="32"
            cy="32"
            r={r}
            stroke-dasharray={`${c * fraction} ${c}`}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <Icon name="dose" size={22} />
      </div>
      <div class="hud__stack">
        <span class="hud__label">{t('hud.dose')}</span>
        <span class="hud__value">
          <b>{num(g.dose)}</b>
          <span class="hud__dim">/ {limit} mSv</span>
        </span>
        <Status level={level} low="hud.status.caution" critical="hud.status.danger" />
      </div>
    </div>
  );
}

function logText(entry: LogEntry): string {
  const vars = { ...entry.vars };
  if (typeof vars.module === 'string') vars.module = t(`module.${vars.module}`);
  return t(entry.key, vars);
}

/** Feed de eventos: las últimas líneas de la bitácora, la más nueva arriba. */
function Feed({ g }: { g: GameState }) {
  const lines = g.log.slice(-3).reverse();
  return (
    <div class="hud__zone hud__zone--tr">
      <ul class="hud__feed" aria-live="polite" aria-label={t('hud.feed')}>
        {lines.map((entry, i) => (
          <li key={`${entry.day}-${entry.key}-${i}`} class={`hud__feed-line hud__feed-line--${entry.type}`}>
            <span class="hud__dim">{t('hud.feed_day', { dia: entry.day })}</span> {logText(entry)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Salud": soporte vital (grande) y comida. */
function Vitals({ g }: { g: GameState }) {
  const life = resourceLevel(g.lifeSupport);
  const food = resourceLevel(g.food);
  return (
    <div class="hud__zone hud__zone--bl">
      <div class="hud__vital hud__vital--main">
        <span class="hud__label">
          <Icon name="life_support" size={16} />
          {t('hud.life_support')}
          <Status level={life} low="hud.status.low" critical="hud.status.critical" />
        </span>
        <span class="hud__big">
          <b>{Math.round(g.lifeSupport)}</b>
          <Trend delta={lastDelta(g, 'lifeSupport')} />
        </span>
        <Bar value={g.lifeSupport} max={100} level={life} label={t('hud.life_support')} />
      </div>
      <div class="hud__vital">
        <span class="hud__label">
          <Icon name="food" size={16} />
          {t('hud.food')}
          <Status level={food} low="hud.status.low" critical="hud.status.critical" />
        </span>
        <span class="hud__value">
          <b>{Math.round(g.food)}</b>
          <Trend delta={lastDelta(g, 'food')} />
        </span>
        <Bar value={g.food} max={100} level={food} label={t('hud.food')} />
      </div>
    </div>
  );
}

/** "Munición": batería actual / capacidad y el sol de hoy. */
function Battery({ g }: { g: GameState }) {
  const capacity = defaultConfig.balance.difficulty[g.difficulty].batteryCapacity;
  const noSun = getLight(g.day, g.difficulty) < 0.1;
  const level: Level = g.battery / capacity <= 0.15 ? (noSun ? 'critical' : 'low') : 'ok';
  return (
    <div class="hud__zone hud__zone--br">
      <span class="hud__label">
        <Icon name="battery" size={16} />
        {t('hud.battery')}
      </span>
      <span class="hud__big">
        <b>{Math.round(g.battery)}</b>
        <span class="hud__dim">/ {capacity}</span>
      </span>
      <Bar value={g.battery} max={capacity} level={level} label={t('hud.battery')} />
      <span class={`hud__sun${noSun ? ' hud__sun--none' : ''}`}>
        <Icon name={noSun ? 'moon' : 'sun'} size={14} />
        {noSun ? t('hud.no_sun') : t('hud.sun_today', { valor: num(budget.value?.solar ?? 0) })}
      </span>
    </div>
  );
}

export function Hud() {
  const g = game.value;
  if (!g) return null;
  return (
    <div class={`hud${tabletOpen.value ? ' hud--tablet' : ''}`}>
      <Scoreboard g={g} />
      <DoseDial g={g} />
      <Feed g={g} />
      <Vitals g={g} />
      <Battery g={g} />
      <div class="hud__actions">
        {!tabletOpen.value && (
          <button type="button" class="btn btn--primary" onClick={toggleTablet}>
            {t('hud.open_tablet')}
          </button>
        )}
        <button
          type="button"
          class={`btn btn--small btn--sky${skyView.value ? ' btn--sky-on' : ''}`}
          aria-pressed={skyView.value}
          onClick={() => (skyView.value = !skyView.value)}
        >
          <Icon name={skyView.value ? 'recycler' : 'moon'} size={16} />
          {t(skyView.value ? 'hud.sky_back' : 'hud.sky')}
        </button>
        <button type="button" class="btn btn--small" onClick={() => (helpOpen.value = true)}>
          {t('help.button')}
        </button>
        <button type="button" class="btn btn--ghost btn--small" onClick={exitToMenu}>
          {t('menu.back')}
        </button>
      </div>
    </div>
  );
}
