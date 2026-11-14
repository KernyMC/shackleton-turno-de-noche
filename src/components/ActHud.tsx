// Piezas del acto sobre el juego:
//   - ActGoal: la pastilla del objetivo (siempre visible bajo la barra superior). Barra con una MARCA
//     en la meta; el número va pequeño. Tocarla vuelve a mostrar la tarjeta del acto.
//   - ActToast: aviso compacto (meta cumplida o no, módulo desbloqueado, por qué paró el avance).
//   - FastForwardBar: "Avanzando · Día n de 5" y el botón grande "Parar".
// Sin rojo y sin cuenta regresiva. Solo lee el store.
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import { actGoalStatus } from '../sim/acts';
import { defaultConfig } from '../sim/config';
import { dismissToast, showActCardNow, toast } from '../state/acts';
import { playDayDone } from '../audio/sfx';
import { cancelFastForward, fastForwarding, ffDays, game } from '../state/store';
import { ActCard, actVars } from './ActCard';
import { num } from './format';
import { Icon } from './icons';
import type { IconName } from './icons';
import '../styles/acts.css';

/** Cuánto de la barra llena y dónde va la marca (0..1), según el tipo de meta. */
function barOf(goal: string, value: number, target: number, progress: number): { fill: number; mark: number } {
  if (goal === 'air_food' || goal === 'battery_pct' || goal === 'all_min') {
    return { fill: Math.min(1, Math.max(0, value / 100)), mark: Math.min(1, target / 100) };
  }
  return { fill: progress, mark: 1 };
}

/**
 * La barra superior cambia de alto (día, noche, ancho). Se mide y se escribe dónde empieza la
 * pastilla (--act-top) y dónde acaba (--act-below): lo demás que sale arriba se apila desde ahí.
 */
function useStack(pill: { current: HTMLElement | null }): void {
  useEffect(() => {
    const bar = document.querySelector('.topbar');
    const root = bar?.closest('.game') as HTMLElement | null;
    if (!bar || !root || typeof ResizeObserver === 'undefined') return;
    const measure = (): void => {
      const top = Math.round(bar.getBoundingClientRect().bottom - root.getBoundingClientRect().top) + 8;
      const h = pill.current ? Math.round(pill.current.getBoundingClientRect().height) : 52;
      root.style.setProperty('--act-top', `${top}px`);
      root.style.setProperty('--act-below', `${top + h + 8}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    if (pill.current) ro.observe(pill.current);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--act-top');
      root.style.removeProperty('--act-below');
    };
  }, []);
}

export function ActGoal() {
  const g = game.value;
  const pill = useRef<HTMLButtonElement>(null);
  useStack(pill);
  if (!g) return null;
  const s = actGoalStatus(g);
  const vars = actVars(s.act);
  const { fill, mark } = barOf(s.goal, s.value, s.target, s.progress);
  const counting = s.goal === 'no_blackout' || s.goal === 'reach_day';
  const lost = s.goal === 'no_blackout' && s.value > 0;
  const reached = !lost && s.met && (!counting || s.progress >= 1);
  const small = ((): string => {
    if (s.goal === 'no_blackout') return `${s.vars.days} / ${s.vars.length}`;
    if (s.goal === 'reach_day') return `${s.value} / ${s.target}`;
    return `${num(s.value, 0)} / ${s.target}`;
  })();
  const state = t(lost ? 'act.state.lost' : reached ? 'act.state.met' : 'act.state.go');
  const label = t(`act.${s.act}.pill`, vars);
  const pct = Math.round(fill * 100);
  return (
    <button
      ref={pill}
      type="button"
      class={`act-pill${reached ? ' act-pill--met' : ''}${lost ? ' act-pill--lost' : ''}`}
      onClick={() => showActCardNow(s.act)}
      aria-label={`${t('act.pill_aria', { n: s.act, meta: t(`act.${s.act}.goal`, vars) })} ${state}`}
      title={t('act.pill_title')}
    >
      <span class="act-pill__icon" aria-hidden="true">
        <Icon name={reached ? 'check' : 'target'} size={16} />
      </span>
      <span class="act-pill__text">{label}</span>
      <span class="act-pill__num">
        {small}
        {counting && ` ${t('act.unit.days')}`}
      </span>
      <span class="act-pill__bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span class="act-pill__fill" style={{ width: `${pct}%` }} />
        <i class="act-pill__mark" style={{ left: `${mark * 100}%` }} aria-hidden="true" />
      </span>
    </button>
  );
}

const UNLOCK_ICON: Record<string, IconName> = { workshop: 'workshop', shield: 'shield', recycler: 'recycler', greenhouse: 'greenhouse' };
const UNLOCK_TEXT = new Set(['workshop', 'shield']);

export function ActToast() {
  const item = toast.value;
  useEffect(() => {
    if (item && (item.kind === 'met' || item.kind === 'unlock')) playDayDone();
  }, [item?.key]);
  if (!item) return null;
  let icon: IconName = 'info';
  let text = '';
  let sub = '';
  switch (item.kind) {
    case 'met':
      icon = 'check';
      text = t('act.met');
      sub = t(`act.${item.act}.name`);
      break;
    case 'missed':
      icon = 'info';
      text = t('act.missed');
      sub = t(`act.${item.act}.name`);
      break;
    case 'unlock': {
      const m = item.module ?? 'workshop';
      icon = UNLOCK_ICON[m] ?? 'check';
      text = UNLOCK_TEXT.has(m) ? t(`unlock.${m}`) : t('unlock.generic', { module: t(`module.${m}`) });
      break;
    }
    case 'stop':
      icon = 'ff';
      text = t(`ff.stopped.${item.reason}`, { n: defaultConfig.balance.fastForward.maxDays });
      break;
  }
  return (
    <div class={`act-toast act-toast--${item.kind}`} role="status" key={item.key} onClick={dismissToast}>
      <span class="act-toast__badge" aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <span class="act-toast__body">
        <span class="act-toast__text">{text}</span>
        {sub && <span class="act-toast__sub">{sub}</span>}
      </span>
    </div>
  );
}

export function FastForwardBar() {
  const on = fastForwarding.value;
  const stopBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!on) return;
    stopBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cancelFastForward();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on]);
  if (!on) return null;
  const max = defaultConfig.balance.fastForward.maxDays;
  const n = Math.min(max, Math.max(1, ffDays.value));
  return (
    <div class="ff-bar" role="status" aria-live="polite">
      <span class="ff-bar__icon" aria-hidden="true">
        <Icon name="ff" size={22} />
      </span>
      <span class="ff-bar__text">{t('ff.running', { n, max })}</span>
      <span class="ff-bar__dots" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <i key={i} class={i < n ? 'ff-bar__dot ff-bar__dot--on' : 'ff-bar__dot'} />
        ))}
      </span>
      <button type="button" class="btn btn--primary ff-bar__stop" ref={stopBtn} onClick={cancelFastForward}>
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" /></svg>
        {t('ff.stop')}
      </button>
    </div>
  );
}

/** Todo lo del acto que flota sobre el juego (menos la pastilla, que vive en el visor). */
export function ActLayer() {
  return (
    <>
      <ActToast />
      <FastForwardBar />
      <ActCard />
    </>
  );
}
