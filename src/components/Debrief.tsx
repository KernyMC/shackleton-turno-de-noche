// Pantalla final: por qué ganaste o perdiste, en lenguaje simple, y cómo intentarlo de nuevo.
// Es donde se cierra el aprendizaje: causa en una frase, el día decisivo, la gráfica de la misión
// y un botón para volver atrás. Solo lee el store y el análisis puro de src/sim/debrief.ts.
import { useState } from 'preact/hooks';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { reviewMission } from '../sim/debrief';
import type { GameState, LogEntry } from '../sim/types';
import { exitToMenu, game, restart, rewindTo, startGame } from '../state/store';
import { num } from './format';
import { Icon } from './icons';
import type { IconName } from './icons';

function Stars({ count }: { count: number }) {
  return (
    <p class="debrief__stars" role="img" aria-label={t('debrief.stars', { n: count })}>
      {[1, 2, 3].map((n) => (
        <svg key={n} viewBox="0 0 24 24" width="40" height="40" class={n <= count ? 'star star--on' : 'star'} aria-hidden="true">
          <path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4 6.1 20.7l1.3-6.6L2.5 9.5l6.6-.8Z" />
        </svg>
      ))}
    </p>
  );
}

interface Series {
  key: string;
  label: string;
  icon: IconName;
  dash: string;
  cls: string;
  /** Valor de 0 a 100 para cada día jugado. */
  values: number[];
}

/** Gráfica SVG hecha a mano: cada línea tiene color Y patrón de trazo distinto. */
function MissionChart({ g }: { g: GameState }) {
  const [table, setTable] = useState(false);
  const d = defaultConfig.balance.difficulty[g.difficulty];
  const total = defaultConfig.balance.days;
  const nights = defaultConfig.light.nightDays;
  const W = 640, H = 220, L = 34, R = 10, T = 12, B = 26;
  const x = (day: number): number => L + ((day - 1) / (total - 1)) * (W - L - R);
  const y = (v: number): number => T + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - T - B);
  const h = g.history;
  const series: Series[] = [
    { key: 'life', label: t('hud.life_support'), icon: 'life_support', dash: '', cls: 'line--life', values: h.map((s) => s.lifeSupport) },
    { key: 'food', label: t('hud.food'), icon: 'food', dash: '7 4', cls: 'line--food', values: h.map((s) => s.food) },
    { key: 'battery', label: t('debrief.chart.battery'), icon: 'battery', dash: '2 4', cls: 'line--battery', values: h.map((s) => (s.battery / d.batteryCapacity) * 100) },
    { key: 'dose', label: t('debrief.chart.dose'), icon: 'dose', dash: '10 3 2 3', cls: 'line--dose', values: h.map((s) => (s.dose / d.doseLimit) * 100) },
  ];
  const storms = g.log.filter((l) => l.key.startsWith('log.storm.')).map((l) => l.day);
  const firstNight = Math.min(...nights), lastNight = Math.max(...nights);

  return (
    <section class="debrief__chart" aria-labelledby="chart-title">
      <h2 id="chart-title">{t('debrief.chart.title')}</h2>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('debrief.chart.aria')} preserveAspectRatio="xMidYMid meet">
        <rect class="chart__night" x={x(firstNight) - 6} y={T} width={x(lastNight) - x(firstNight) + 12} height={H - T - B} />
        <text class="chart__note" x={(x(firstNight) + x(lastNight)) / 2} y={T + 12} text-anchor="middle">{t('debrief.chart.night')}</text>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line class={v === 25 ? 'chart__grid chart__grid--low' : 'chart__grid'} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text class="chart__tick" x={L - 6} y={y(v) + 4} text-anchor="end">{v}</text>
          </g>
        ))}
        {[1, 5, 10, 15, 20, 25, 30].map((day) => (
          <text key={day} class="chart__tick" x={x(day)} y={H - 8} text-anchor="middle">{day}</text>
        ))}
        {storms.map((day) => (
          <g key={day} class="chart__storm">
            <line x1={x(day)} x2={x(day)} y1={T} y2={H - B} />
            <circle cx={x(day)} cy={T + 4} r="4" />
          </g>
        ))}
        {series.map((s) => (
          <polyline
            key={s.key}
            class={`chart__line ${s.cls}`}
            stroke-dasharray={s.dash}
            points={s.values.map((v, i) => `${x(h[i]!.day).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
          />
        ))}
      </svg>
      <ul class="chart__legend">
        {series.map((s) => (
          <li key={s.key}>
            <svg width="34" height="10" aria-hidden="true">
              <line class={`chart__line ${s.cls}`} stroke-dasharray={s.dash} x1="1" x2="33" y1="5" y2="5" />
            </svg>
            <Icon name={s.icon} size={15} />
            {s.label}
          </li>
        ))}
        {storms.length > 0 && (
          <li>
            <svg width="12" height="12" aria-hidden="true" class="chart__storm"><circle cx="6" cy="6" r="4" /></svg>
            {t('debrief.chart.storm')}
          </li>
        )}
      </ul>
      <button type="button" class="btn btn--ghost btn--small" aria-expanded={table} onClick={() => setTable(!table)}>
        {t(table ? 'debrief.chart.hide_table' : 'debrief.chart.show_table')}
      </button>
      {table && (
        <div class="debrief__table">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('hud.day_label')}</th>
                {series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {h.map((s, i) => (
                <tr key={s.day}>
                  <th scope="row">{s.day}</th>
                  {series.map((ser) => <td key={ser.key}>{Math.round(ser.values[i]!)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function logText(entry: LogEntry): string {
  const vars = { ...entry.vars };
  if (typeof vars.module === 'string') vars.module = t(`module.${vars.module}`);
  return t(entry.key, vars);
}

export function Debrief() {
  const g = game.value;
  const result = g?.result;
  const [copied, setCopied] = useState(false);
  if (!g || !result) return null;

  const review = reviewMission(g);
  const won = result.outcome === 'win';
  const cause = result.causes[0];
  const decisions = g.log.filter((l) => l.type === 'decision');
  const total = defaultConfig.balance.days;

  const copy = async (): Promise<void> => {
    const text = won
      ? t('debrief.share.win', { dias: total, estrellas: '★'.repeat(result.stars) })
      : t('debrief.share.loss', { dia: result.day });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false); // sin permiso de portapapeles: no pasa nada
    }
  };

  return (
    <main class={`debrief ${won ? 'debrief--win' : 'debrief--loss'}`}>
      <header class="debrief__head">
        <p class="card__kicker">{t('coach.voice')}</p>
        <h1>{won ? t('debrief.win') : t('debrief.loss', { dia: result.day })}</h1>
        {won ? <Stars count={result.stars} /> : <p class="debrief__abort">{t('debrief.abort')}</p>}
      </header>

      <section class="debrief__why">
        <h2>{t(won ? 'debrief.why_win' : 'debrief.why_loss')}</h2>
        {won ? (
          <p>{t(`debrief.win.stars${result.stars}`)}</p>
        ) : (
          <>
            <p class="debrief__cause">
              <Icon name={cause === 'radiation' ? 'dose' : cause === 'food' ? 'food' : 'life_support'} size={24} />
              {t(`debrief.cause.${cause}`)}
            </p>
            {review.duringNight && cause !== 'radiation' && <p>{t('debrief.night_long')}</p>}
            {result.causes.length > 1 && (
              <p class="debrief__also">
                {t('debrief.also')} {result.causes.slice(1).map((c) => t(`debrief.cause_short.${c}`)).join(', ')}.
              </p>
            )}
            {review.decisiveDay !== null && (
              <p class="debrief__decisive">{t(`debrief.decisive.${cause}`, { dia: review.decisiveDay })}</p>
            )}
          </>
        )}
      </section>

      <div class="debrief__actions">
        {!won && review.rewindDay !== null && (
          <button type="button" class="btn btn--primary" onClick={() => rewindTo(review.rewindDay!)}>
            {t('debrief.rewind', { dia: review.rewindDay })}
          </button>
        )}
        <button type="button" class={won ? 'btn btn--primary' : 'btn'} onClick={restart}>{t('debrief.again')}</button>
        {won && g.difficulty === 'cadete' && (
          <button type="button" class="btn" onClick={() => startGame('comandante')}>{t('debrief.try_commander')}</button>
        )}
        <button type="button" class="btn btn--ghost" onClick={exitToMenu}>{t('menu.back')}</button>
      </div>

      <ul class="debrief__stats">
        <li><b>{g.history.length}</b>{t('debrief.stat.days', { total })}</li>
        <li><b>{review.stormsSheltered} / {review.stormsTotal}</b>{t('debrief.stat.storms')}</li>
        <li><b>{num(review.wasted, 0)}</b>{t('debrief.stat.wasted')}</li>
        <li><b>{review.blackouts}</b>{t('debrief.stat.blackouts')}</li>
      </ul>

      <MissionChart g={g} />

      {decisions.length > 0 && (
        <section class="debrief__decisions">
          <h2>{t('debrief.decisions')}</h2>
          <ol>
            {decisions.map((entry, i) => (
              <li key={`${entry.day}-${i}`}>
                <span class="hud__dim">{t('hud.feed_day', { dia: entry.day })}</span> {logText(entry)}
              </li>
            ))}
          </ol>
        </section>
      )}

      <p class="debrief__share">
        <button type="button" class="btn btn--ghost btn--small" onClick={copy}>{t('debrief.copy')}</button>
        <span role="status">{copied ? t('debrief.copied') : ''}</span>
      </p>
    </main>
  );
}
