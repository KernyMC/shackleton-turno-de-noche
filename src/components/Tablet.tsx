// Panel de planificación: la interacción central del juego. Cinco bloques, de arriba abajo:
//   1. encabezado · 2. chips de módulo · 3. módulo activo (un solo slider)
//   4. veredicto + presupuesto · 5. acciones
// No repite lo que ya muestra el HUD (batería, día, dosis): lo único nuevo es cómo amanece mañana.
// Con un evento pendiente muestra el panel del evento. Diseño: docs/DIVERSION.md (experto UX).
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { MODULE_IDS } from '../sim/types';
import type { GameState, ModuleId } from '../sim/types';
import { planVerdict } from '../sim/verdict';
import type { Verdict, VerdictReason } from '../sim/verdict';
import {
  applyPreset,
  budget,
  executeDay,
  focusModule,
  game,
  plan,
  preview,
  resolving,
  tabletOpen,
  toggleTablet,
} from '../state/store';
import { helpOpen, tutorialStep } from '../state/tutorial';
import { EnergySlider, isSheltered } from './EnergySlider';
import { EventPanel } from './EventPanel';
import { num, signed } from './format';
import { Icon } from './icons';
import type { IconName } from './icons';

const NOTICE_MS = 2000;

/** Fila de 4 chips: elegir qué módulo se ajusta. Tocar un módulo en la maqueta hace lo mismo. */
function Chips({ game: g, active }: { game: GameState; active: ModuleId }) {
  return (
    <div class="chips" role="group" aria-label={t('tablet.chips')}>
      {MODULE_IDS.map((id) => {
        const broken = g.modules[id].broken;
        const sheltered = isSheltered(id, g);
        const value = plan.value[id];
        const cls = [
          'chip',
          id === active ? 'chip--active' : '',
          broken ? 'chip--broken' : '',
          !broken && !sheltered && value === 0 ? 'chip--off' : '',
        ].join(' ');
        return (
          <button key={id} type="button" class={cls} data-module={id} aria-pressed={id === active} onClick={() => (focusModule.value = id)}>
            <Icon name={broken ? 'alert' : sheltered ? 'shield' : id} size={18} />
            <span class="chip__name">{t(`module.${id}`)}</span>
            <span class="chip__value">{broken ? t('tablet.chip.broken') : sheltered ? t('tablet.chip.shelter') : value}</span>
          </button>
        );
      })}
    </div>
  );
}

const VERDICT_ICON: Record<Verdict['level'], IconName> = { safe: 'check', tight: 'alert', critical: 'alert' };

/** Veredicto del plan: ícono + palabra, y cómo amanece mañana (3 números). */
function VerdictLine({ verdict }: { verdict: Verdict }) {
  const word = verdict.reason === 'blackout' ? 'tablet.verdict.blackout' : `tablet.verdict.${verdict.level}`;
  const item = (reason: VerdictReason | 'battery', icon: IconName, label: string, value: number) => (
    <span class={`verdict__item${verdict.reason === reason || (reason === 'battery' && verdict.reason === 'blackout') ? ' verdict__item--flag' : ''}`}>
      <Icon name={icon} size={16} />
      <span class="verdict__name">{t(label)}</span> <b>{Math.round(value)}</b>
    </span>
  );
  return (
    <div class={`verdict verdict--${verdict.level}`} role="status" aria-live="polite">
      <p class="verdict__word">
        <Icon name={VERDICT_ICON[verdict.level]} size={22} />
        {t(word)}
        {verdict.reason === 'dose' && <span class="verdict__why">{t('tablet.verdict.dose')}</span>}
      </p>
      <p class="verdict__tomorrow">
        <span class="verdict__label">{t('tablet.verdict.tomorrow')}</span>
        {item('life_support', 'life_support', 'hud.life_support', verdict.lifeSupport)}
        {item('food', 'food', 'hud.food', verdict.food)}
        {item('battery', 'battery', 'hud.battery', verdict.battery)}
      </p>
    </div>
  );
}

/** Presupuesto en una frase y una barra fina de una sola pieza. */
function BudgetLine({ wasted }: { wasted: number }) {
  const total = Math.floor((budget.value?.available ?? 0) + 1e-9);
  const used = MODULE_IDS.reduce((sum, id) => sum + plan.value[id], 0);
  const left = Math.max(0, total - used);
  return (
    <div class="budget">
      <div class="budget__bar" aria-hidden="true">
        <span style={{ width: `${total > 0 ? (used / total) * 100 : 0}%` }} />
      </div>
      <p class="budget__text">
        {left > 0 ? t('tablet.budget.left', { quedan: left, total }) : t('tablet.budget.none')}
      </p>
      {wasted > 0 && (
        <p class="tablet__notice tablet__notice--warn">
          <Icon name="alert" size={16} />
          {t('tablet.budget.wasted', { valor: num(wasted, 0) })}
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
  const active: ModuleId = focusModule.value ?? 'recycler';
  const verdict = planVerdict(g, plan.value);
  const minWorkshop = defaultConfig.balance.effects.workshopMinEnergy;
  const needsWorkshop = (g.repairToday !== null || g.roverSendToday) && plan.value.workshop < minWorkshop;
  const noEnergy = (b?.available ?? 0) < 1;
  const capacity = defaultConfig.balance.difficulty[g.difficulty].batteryCapacity;

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const flash = (key: string): void => {
    setNotice(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  };

  return (
    <>
      <Chips game={g} active={active} />

      {noEnergy && (
        <p class="tablet__notice tablet__notice--danger">
          <Icon name="alert" size={16} />
          {t('tablet.no_energy')}
        </p>
      )}

      <EnergySlider key={active} id={active} game={g} onClamped={() => flash('plan.error.over_budget')} />

      {needsWorkshop && (
        <p class="tablet__notice tablet__notice--warn">
          <Icon name="alert" size={16} />
          {t(g.roverSendToday ? 'tablet.needs_workshop.rover' : 'tablet.needs_workshop.repair', { min: minWorkshop })}
        </p>
      )}
      <p class="tablet__notice tablet__notice--flash" role="status" aria-live="polite">
        {notice ? t(notice) : ''}
      </p>

      <VerdictLine verdict={verdict} />
      <BudgetLine wasted={verdict.wasted} />

      <div class="tablet__actions">
        <button type="button" class="btn btn--primary btn--execute" disabled={resolving.value} onClick={executeDay}>
          {resolving.value ? t('tablet.resolving') : t('tablet.execute')}
        </button>
        {g.lastPlan && (
          <button
            type="button"
            class="btn btn--ghost btn--small"
            disabled={resolving.value}
            onClick={() => applyPreset('repeat') && flash('tablet.preset_adjusted')}
          >
            {t('tablet.preset.repeat')}
          </button>
        )}
      </div>

      <details class="tablet__details">
        <summary>{t('tablet.details')}</summary>
        <p>{t('tablet.details.energy', { total: num(b?.available ?? 0), bateria: num(g.battery), sol: num(b?.solar ?? 0), base: b?.base ?? 0 })}</p>
        {p && (
          <p>
            {t('tablet.preview.life_support', { valor: signed(p.lifeSupport) })} ·{' '}
            {t('tablet.preview.food', { valor: signed(p.food) })} ·{' '}
            {t('tablet.preview.dose', { valor: signed(p.dose, 2) })} ·{' '}
            {t('tablet.preview.battery', { valor: num(p.battery) })}
          </p>
        )}
        <p>{t('tablet.details.capacity', { capacidad: capacity })}</p>
      </details>
    </>
  );
}

export function Tablet() {
  const g = game.value;
  const open = tabletOpen.value;
  const dialog = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const inEvent = g?.phase === 'event';

  // Al abrir o cambiar de módulo, el foco va a su slider; si no se puede, al título.
  const focused = focusModule.value;
  useEffect(() => {
    if (!open) return;
    const slider = focused && !inEvent ? document.getElementById(`slider-${focused}`) : null;
    if (slider instanceof HTMLInputElement && !slider.disabled) slider.focus({ preventScroll: true });
    else if (!dialog.current?.contains(document.activeElement)) title.current?.focus();
  }, [open, focused, inEvent]);

  if (!open || !g) return null;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!inEvent) toggleTablet();
      return;
    }
    if (e.key === 'Enter' && !inEvent) {
      const target = e.target as HTMLElement;
      // Enter ejecuta el día salvo que el foco esté en un botón o desplegable, que ya usan Enter.
      if (target.tagName !== 'BUTTON' && target.tagName !== 'SUMMARY') {
        e.preventDefault();
        executeDay();
      }
      return;
    }
    // El foco solo se atrapa cuando hay una decisión obligatoria; si no, se puede volver a la maqueta.
    if (e.key === 'Tab' && inEvent) trapFocus(e, dialog.current);
  };

  return (
    <div
      ref={dialog}
      class="tablet"
      data-coach={tutorialStep.value ?? undefined}
      role="dialog"
      aria-modal={inEvent ? 'true' : 'false'}
      aria-labelledby="tablet-title"
      onKeyDown={onKeyDown}
    >
      <header class="tablet__head">
        <h2 id="tablet-title" ref={title} tabIndex={-1}>
          {t('tablet.title', { dia: g.day })}
        </h2>
        <div class="tablet__head-actions">
          <button type="button" class="btn btn--ghost btn--small" onClick={() => (helpOpen.value = true)}>
            {t('help.button')}
          </button>
          {!inEvent && (
            <button type="button" class="btn btn--icon btn--ghost" aria-label={t('tablet.close')} onClick={toggleTablet}>
              <Icon name="close" />
            </button>
          )}
        </div>
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
