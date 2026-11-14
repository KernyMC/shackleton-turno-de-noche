// Panel de planificación: la interacción central del juego, en forma visual.
// Barra de reparto de la energía, cuatro columnas de energía (una por módulo, con el color de
// quien lo cuida) y un veredicto con medidores de cómo amanece la base mañana.
// No repite lo que ya muestra el HUD. Con un evento pendiente muestra el panel del evento.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import type { GameState } from '../sim/types';
import { planVerdict } from '../sim/verdict';
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
import { reacting } from '../state/rewards';
import { playCommit } from '../audio/sfx';
import { EventPanel } from './EventPanel';
import { num, signed } from './format';
import { Icon } from './icons';
import { PowerBoard } from './PowerBoard';

const NOTICE_MS = 2000;

/** Ejecutar con su golpe de sonido. */
function commit(): void {
  if (executeDay()) playCommit();
}

function Planner({ game: g }: { game: GameState }) {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const b = budget.value;
  const p = preview.value;
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
      {noEnergy && (
        <p class="tablet__notice tablet__notice--danger">
          <Icon name="alert" size={16} />
          {t('tablet.no_energy')}
        </p>
      )}

      <PowerBoard game={g} verdict={verdict} onClamped={() => flash('plan.error.over_budget')} />

      {needsWorkshop && (
        <p class="tablet__notice tablet__notice--warn">
          <Icon name="alert" size={16} />
          {t(g.roverSendToday ? 'tablet.needs_workshop.rover' : 'tablet.needs_workshop.repair', { min: minWorkshop })}
        </p>
      )}
      <p class="tablet__notice tablet__notice--flash" role="status" aria-live="polite">
        {notice ? t(notice) : ''}
      </p>

      <div class="tablet__actions">
        <button type="button" class="btn btn--primary btn--execute" disabled={resolving.value} onClick={commit}>
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6Z" fill="currentColor" /></svg>
          {resolving.value ? t('tablet.resolving') : t('tablet.execute', { dia: g.day })}
        </button>
        {g.lastPlan && (
          <button
            type="button"
            class="btn btn--icon btn--ghost"
            title={t('tablet.preset.repeat')}
            aria-label={t('tablet.preset.repeat')}
            disabled={resolving.value}
            onClick={() => applyPreset('repeat') && flash('tablet.preset_adjusted')}
          >
            <Icon name="recycler" size={20} />
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
    if (slider instanceof HTMLElement && slider.tabIndex >= 0) slider.focus({ preventScroll: true });
    else if (!dialog.current?.contains(document.activeElement)) title.current?.focus();
  }, [open, focused, inEvent]);

  // Cada día arranca con el plan de ayer (ajustado a la energía de hoy): se corrige, no se rehace.
  const day = g?.day;
  useEffect(() => {
    if (!open || !g || g.phase !== 'planning' || resolving.value || !g.lastPlan) return;
    const total = Object.values(plan.value).reduce((a, b) => a + b, 0);
    if (total === 0) applyPreset('repeat');
  }, [open, day, g?.phase, resolving.value]);

  if (!open || !g) return null;
  // Mientras la base reacciona al día ejecutado, el panel se aparta para que se vea la maqueta.
  const away = !inEvent && (resolving.value || reacting.value);

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
        commit();
      }
      return;
    }
    // El foco solo se atrapa cuando hay una decisión obligatoria; si no, se puede volver a la maqueta.
    if (e.key === 'Tab' && inEvent) trapFocus(e, dialog.current);
  };

  return (
    <div
      ref={dialog}
      class={`tablet${away ? ' tablet--away' : ''}`}
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
          <button type="button" class="iconbtn" aria-label={t('help.button')} title={t('help.button')} onClick={() => (helpOpen.value = true)}>
            <Icon name="help" size={18} />
          </button>
          {!inEvent && (
            <button type="button" class="iconbtn" aria-label={t('tablet.close')} title={t('tablet.close')} onClick={toggleTablet}>
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
