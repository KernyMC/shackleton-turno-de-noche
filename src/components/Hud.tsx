// Visor del juego. Pocos elementos, bien alineados, para que la base 3D sea la protagonista:
//   barra superior  → dosis (con Amaru) · día y tira de 30 días con el cohete · sol, cielo, sonido, ayuda, salir
//   arriba izquierda → registro corto: lo último que pasó, con ícono, que se desvanece
//   abajo izquierda  → tarjeta de recursos: soporte vital, comida y batería, cada uno con la cara
//                      de quien lo cuida (su gesto cambia cuando el recurso baja)
//   abajo al centro  → un solo botón: "Planificar el día"
// Solo lee el store. El estado nunca se comunica solo con color: siempre ícono + palabra.
import { crewById } from '../data/crew';
import type { CrewId } from '../data/crew';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { getLight } from '../sim/engine';
import type { GameState, LogEntry } from '../sim/types';
import { muted, toggleMute } from '../audio/sfx';
import { faceOf, moodOf } from '../state/rewards';
import { budget, exitToMenu, game, skyView, tabletOpen, toggleTablet } from '../state/store';
import { helpOpen } from '../state/tutorial';
import { CrewPortrait } from './CrewPortrait';
import { num, signed } from './format';
import { Icon } from './icons';
import type { IconName } from './icons';

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
      <Icon name="alert" size={13} />
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
  return (
    <span class={`hud__trend hud__trend--${delta > 0 ? 'up' : 'down'}`}>
      {delta > 0 ? '▲' : '▼'} {signed(delta)}
    </span>
  );
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

function Face({ crew, mood }: { crew: CrewId; mood: number }) {
  const member = crewById(crew);
  return (
    <span class={`hud__face hud__face--${faceOf(mood)}`} style={{ '--crew': member.css }} title={t(`crew.${crew}.short`)}>
      <CrewPortrait color={member.css} mood={faceOf(mood)} size={34} />
    </span>
  );
}

/** Día y tira de 30 días con la noche marcada y el cohete que avanza hacia la nave de relevo. */
function Scoreboard({ g }: { g: GameState }) {
  const total = defaultConfig.balance.days;
  const nights = defaultConfig.light.nightDays;
  const firstNight = Math.min(...nights);
  const lastNight = Math.max(...nights);
  let nightText: string | null = null;
  if (g.day < firstNight) nightText = t(firstNight - g.day === 1 ? 'hud.night_tomorrow' : 'hud.night_in', { dias: firstNight - g.day });
  else if (g.day <= lastNight) nightText = t('hud.night_now', { dias: lastNight - g.day + 1 });

  return (
    // La clave por día vuelve a montar el bloque: un destello breve marca el día nuevo.
    <div class="topbar__day" key={g.day}>
      <p class="hud__day">
        {t('hud.day_label')} <b>{String(g.day).padStart(2, '0')}</b>
        <span class="hud__dim">/ {total}</span>
      </p>
      <div class="hud__progress">
        <span class="hud__rocket" style={{ left: `${((g.day - 1) / (total - 1)) * 100}%` }} aria-hidden="true">
          <svg viewBox="0 0 20 20" width="16" height="16"><path d="M10 2c2.5 2 3.6 5 3.6 8.4l1.9 2.4-2.6.6-.9 2.6h-4l-.9-2.6-2.6-.6 1.9-2.4C6.4 7 7.5 4 10 2Z" fill="currentColor" /></svg>
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
        <span class="hud__ship" aria-hidden="true" title={t('hud.relief_ship')}>
          <svg viewBox="0 0 20 20" width="14" height="14"><circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M2 10h4M14 10h4" stroke="currentColor" stroke-width="1.6" /></svg>
        </span>
      </div>
      {nightText && (
        <p class={`hud__night${g.day >= firstNight ? ' hud__night--now' : ''}`}>
          <Icon name="moon" size={13} />
          {nightText}
        </p>
      )}
    </div>
  );
}

/** Dosis de radiación: anillo, valor y la cara de Amaru, que vigila el blindaje. */
function Dose({ g, mood }: { g: GameState; mood: number }) {
  const limit = defaultConfig.balance.difficulty[g.difficulty].doseLimit;
  const fraction = Math.min(1, g.dose / limit);
  const level = doseLevel(fraction);
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <div class="topbar__dose">
      <div
        class={`hud__dial hud__dial--${level}`}
        role="progressbar"
        aria-label={t('hud.dose')}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.round(g.dose)}
      >
        <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
          <circle class="hud__dial-track" cx="22" cy="22" r={r} />
          <circle class="hud__dial-fill" cx="22" cy="22" r={r} stroke-dasharray={`${c * fraction} ${c}`} transform="rotate(-90 22 22)" />
        </svg>
        <Icon name="dose" size={16} />
      </div>
      <div class="hud__stack">
        <span class="hud__label">
          {t('hud.dose')}
          <Status level={level} low="hud.status.caution" critical="hud.status.danger" />
        </span>
        <span class="hud__value">
          <b>{num(g.dose)}</b>
          <span class="hud__dim">/ {limit} mSv</span>
        </span>
      </div>
      <Face crew="amaru" mood={mood} />
    </div>
  );
}

function Tools({ g }: { g: GameState }) {
  const noSun = getLight(g.day, g.difficulty) < 0.1;
  return (
    <div class="topbar__tools">
      <span class={`hud__sun${noSun ? ' hud__sun--none' : ''}`}>
        <Icon name={noSun ? 'moon' : 'sun'} size={15} />
        {noSun ? t('hud.no_sun') : t('hud.sun_today', { valor: num(budget.value?.solar ?? 0) })}
      </span>
      <button
        type="button"
        class={`iconbtn${skyView.value ? ' iconbtn--on' : ''}`}
        aria-pressed={skyView.value}
        aria-label={t(skyView.value ? 'hud.sky_back' : 'hud.sky')}
        title={t(skyView.value ? 'hud.sky_back' : 'hud.sky')}
        onClick={() => (skyView.value = !skyView.value)}
      >
        <Icon name="sky" size={18} />
      </button>
      <button
        type="button"
        class="iconbtn"
        aria-pressed={!muted.value}
        aria-label={t(muted.value ? 'hud.sound_on' : 'hud.sound_off')}
        title={t(muted.value ? 'hud.sound_on' : 'hud.sound_off')}
        onClick={toggleMute}
      >
        <Icon name={muted.value ? 'mute' : 'sound'} size={18} />
      </button>
      <button type="button" class="iconbtn" aria-label={t('help.button')} title={t('help.button')} onClick={() => (helpOpen.value = true)}>
        <Icon name="help" size={18} />
      </button>
      <button type="button" class="iconbtn" aria-label={t('menu.back')} title={t('menu.back')} onClick={exitToMenu}>
        <Icon name="exit" size={18} />
      </button>
    </div>
  );
}

function logText(entry: LogEntry): string {
  const vars = { ...entry.vars };
  if (typeof vars.module === 'string') vars.module = t(`module.${vars.module}`);
  return t(entry.key, vars);
}

const FEED_ICON: Record<LogEntry['type'], IconName> = {
  info: 'info',
  warning: 'alert',
  event: 'alert',
  decision: 'check',
  achievement: 'check',
};

/** Registro corto: lo de ayer y hoy, máximo 3 líneas, que se desvanecen solas. */
function Feed({ g }: { g: GameState }) {
  const lines = g.log.filter((l) => l.day >= g.day - 1).slice(-3).reverse();
  if (lines.length === 0) return null;
  return (
    <ul class="feed" aria-live="polite" aria-label={t('hud.feed')}>
      {lines.map((entry, i) => (
        <li key={`${entry.day}-${entry.key}-${g.log.length - i}`} class={`feed__line feed__line--${entry.type}`}>
          <Icon name={FEED_ICON[entry.type]} size={15} />
          <span>{logText(entry)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Tarjeta de recursos: cada uno con su color, número grande y la cara de quien lo cuida. */
function Resources({ g, moods }: { g: GameState; moods: Record<CrewId, number> }) {
  const capacity = defaultConfig.balance.difficulty[g.difficulty].batteryCapacity;
  const noSun = getLight(g.day, g.difficulty) < 0.1;
  const life = resourceLevel(g.lifeSupport);
  const food = resourceLevel(g.food);
  const battery: Level = g.battery / capacity <= 0.15 ? (noSun ? 'critical' : 'low') : 'ok';
  const items = [
    { id: 'life', icon: 'life_support' as const, label: t('hud.life_support'), value: g.lifeSupport, max: 100, level: life, delta: lastDelta(g, 'lifeSupport'), crew: 'valeria' as const },
    { id: 'food', icon: 'food' as const, label: t('hud.food'), value: g.food, max: 100, level: food, delta: lastDelta(g, 'food'), crew: 'mateo' as const },
    { id: 'battery', icon: 'battery' as const, label: t('hud.battery'), value: g.battery, max: capacity, level: battery, delta: lastDelta(g, 'battery'), crew: 'lucia' as const },
  ];
  return (
    <div class="resources">
      {items.map((it) => (
        <div key={it.id} class={`res res--${it.id} res--${it.level}`}>
          <div class="res__top">
            <span class="hud__label">
              <Icon name={it.icon} size={14} />
              {it.label}
            </span>
            <Face crew={it.crew} mood={moods[it.crew]} />
          </div>
          <p class="res__value">
            <b>{Math.round(it.value)}</b>
            {it.id === 'battery' && <span class="hud__dim">/ {it.max}</span>}
          </p>
          <Bar value={it.value} max={it.max} level={it.level} label={it.label} />
          <p class="res__foot">
            <Status level={it.level} low="hud.status.low" critical="hud.status.critical" />
            {it.level === 'ok' && <Trend delta={it.delta} />}
          </p>
        </div>
      ))}
    </div>
  );
}

export function Hud() {
  const g = game.value;
  if (!g) return null;
  const moods = moodOf(g);
  return (
    <div class={`hud${tabletOpen.value ? ' hud--tablet' : ''}`}>
      <header class="topbar">
        <Dose g={g} mood={moods.amaru} />
        <Scoreboard g={g} />
        <Tools g={g} />
      </header>
      <Feed g={g} />
      <Resources g={g} moods={moods} />
      {!tabletOpen.value && (
        <button type="button" class="btn btn--primary hud__plan" onClick={toggleTablet}>
          <Icon name="sun" size={20} />
          {t('hud.open_tablet')}
        </button>
      )}
    </div>
  );
}
