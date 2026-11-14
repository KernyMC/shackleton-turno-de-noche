// Tablet de muñeca: el planificador de energía, la interacción central del juego (tarea C-03).
// Con un evento pendiente muestra el panel del evento en lugar del planificador.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { MODULE_IDS } from '../sim/types';
import type { GameState } from '../sim/types';
import {
  applyPreset,
  budget,
  executeDay,
  game,
  plan,
  preview,
  resolving,
  tabletOpen,
  toggleTablet,
} from '../state/store';
import type { Preset } from '../state/store';
import { EnergySlider } from './EnergySlider';
import { EventPanel } from './EventPanel';
import { num, signed } from './format';
import { Icon } from './icons';

const NOTICE_MS = 2000;

/** Barra de presupuesto: energía asignada, a la batería y desperdiciada. */
function BudgetBar({ game: g }: { game: GameState }) {
  const available = budget.value?.available ?? 0;
  const p = preview.value;
  const assigned = MODULE_IDS.reduce((sum, id) => sum + plan.value[id], 0);
  const wasted = p?.wasted ?? 0;
  const toBattery = Math.max(0, available - assigned - wasted);
  const pct = (v: number): string => `${available > 0 ? (v / available) * 100 : 0}%`;
  const capacity = defaultConfig.balance.difficulty[g.difficulty].batteryCapacity;

  return (
    <div class="budget">
      <div class="budget__bar" aria-hidden="true">
        <span class="budget__seg budget__seg--assigned" style={{ width: pct(assigned) }} />
        <span class="budget__seg budget__seg--battery" style={{ width: pct(toBattery) }} />
        <span class="budget__seg budget__seg--wasted" style={{ width: pct(wasted) }} />
      </div>
      <p class="budget__legend">
        <span>
          <i class="budget__key budget__key--assigned" />
          {t('tablet.budget.assigned', { valor: num(assigned) })}
        </span>
        <span>
          <i class="budget__key budget__key--battery" />
          {t('tablet.budget.battery', { valor: num(toBattery), capacidad: capacity })}
        </span>
      </p>
      {wasted > 0 && (
        <p class="tablet__notice tablet__notice--warn">
          <Icon name="alert" size={16} />
          {t('tablet.budget.wasted', { valor: num(wasted) })}
        </p>
      )}
    </div>
  );
}

function Planner({ game: g }: { game: GameState }) {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const b = budget.value;
  const p = preview.value;
  const minWorkshop = defaultConfig.balance.effects.workshopMinEnergy;
  const needsWorkshop = (g.repairToday !== null || g.roverSendToday) && plan.value.workshop < minWorkshop;
  const noEnergy = (b?.available ?? 0) < 1;

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const flash = (key: string): void => {
    setNotice(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  };
  const preset = (which: Preset): void => {
    if (applyPreset(which)) flash('tablet.preset_adjusted');
  };

  return (
    <>
      <header class="tablet__budget-head">
        <p class="tablet__available">
          {t('tablet.available')} <b>{num(b?.available ?? 0)}</b>
        </p>
        <p class="tablet__breakdown">
          {t('hud.breakdown', { bateria: num(g.battery), sol: num(b?.solar ?? 0), base: b?.base ?? 0 })}
        </p>
      </header>

      {noEnergy && (
        <p class="tablet__notice tablet__notice--danger">
          <Icon name="alert" size={16} />
          {t('tablet.no_energy')}
        </p>
      )}

      <div class="tablet__modules">
        {MODULE_IDS.map((id) => (
          <EnergySlider key={id} id={id} game={g} onClamped={() => flash('plan.error.over_budget')} />
        ))}
      </div>

      <BudgetBar game={g} />

      {needsWorkshop && (
        <p class="tablet__notice tablet__notice--warn">
          <Icon name="alert" size={16} />
          {t(g.roverSendToday ? 'tablet.needs_workshop.rover' : 'tablet.needs_workshop.repair', { min: minWorkshop })}
        </p>
      )}
      <p class="tablet__notice" role="status" aria-live="polite">
        {notice ? t(notice) : ''}
      </p>

      {p && (
        <p class="tablet__preview">
          <span>{t('tablet.preview.life_support', { valor: signed(p.lifeSupport) })}</span>
          <span>{t('tablet.preview.food', { valor: signed(p.food) })}</span>
          <span>{t('tablet.preview.dose', { valor: signed(p.dose, 2) })}</span>
          <span>{t('tablet.preview.battery', { valor: num(p.battery) })}</span>
        </p>
      )}

      <div class="tablet__actions">
        <div class="tablet__presets">
          {g.lastPlan && (
            <button type="button" class="btn btn--small" disabled={resolving.value} onClick={() => preset('repeat')}>
              {t('tablet.preset.repeat')}
            </button>
          )}
          <button type="button" class="btn btn--small" disabled={resolving.value} onClick={() => preset('saving')}>
            {t('tablet.preset.saving')}
          </button>
          <button type="button" class="btn btn--small" disabled={resolving.value} onClick={() => preset('zero')}>
            {t('tablet.preset.zero')}
          </button>
        </div>
        <button type="button" class="btn btn--primary btn--execute" disabled={resolving.value} onClick={executeDay}>
          {resolving.value ? t('tablet.resolving') : t('tablet.execute')}
        </button>
      </div>
    </>
  );
}

export function Tablet() {
  const g = game.value;
  const open = tabletOpen.value;
  const dialog = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const inEvent = g?.phase === 'event';

  // Al abrir, el foco va al título.
  useEffect(() => {
    if (open) title.current?.focus();
  }, [open]);

  if (!open || !g) return null;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!inEvent) toggleTablet();
      return;
    }
    if (e.key === 'Enter' && !inEvent) {
      const target = e.target as HTMLElement;
      // Enter ejecuta el día salvo que el foco esté en un control que ya usa Enter.
      if (target.tagName !== 'BUTTON' && target.tagName !== 'INPUT') {
        e.preventDefault();
        executeDay();
      }
      return;
    }
    if (e.key === 'Tab') trapFocus(e, dialog.current);
  };

  return (
    <div
      ref={dialog}
      class="tablet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tablet-title"
      onKeyDown={onKeyDown}
    >
      <header class="tablet__head">
        <h2 id="tablet-title" ref={title} tabIndex={-1}>
          {t('tablet.title')} · {t('hud.day', { dia: g.day, total: defaultConfig.balance.days })}
        </h2>
        {!inEvent && (
          <button type="button" class="btn btn--icon btn--ghost" aria-label={t('tablet.close')} onClick={toggleTablet}>
            <Icon name="close" />
          </button>
        )}
      </header>
      {inEvent ? <EventPanel game={g} /> : <Planner game={g} />}
    </div>
  );
}

/** Mantiene el foco dentro del diálogo al pulsar Tab / Shift+Tab. */
function trapFocus(e: KeyboardEvent, root: HTMLElement | null): void {
  if (!root) return;
  const focusable = [
    ...root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex="0"]'),
  ];
  if (focusable.length === 0) return;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !root.contains(active))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || !root.contains(active))) {
    e.preventDefault();
    first.focus();
  } else if (!e.shiftKey && active === root.querySelector('#tablet-title')) {
    e.preventDefault();
    first.focus();
  }
}
