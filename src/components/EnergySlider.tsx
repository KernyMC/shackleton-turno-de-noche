// Tarjeta del módulo activo: nombre, valor grande, UN slider, qué hace y su efecto en vivo.
// Solo muestra; las reglas viven en el motor y el store. Diseño: docs/DIVERSION.md (experto UX).
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import type { GameState, ModuleId } from '../sim/types';
import { budget, plan, requestRepair, resolving, setPlanValue } from '../state/store';
import { num, signed } from './format';
import { Icon } from './icons';

interface Props {
  id: ModuleId;
  game: GameState;
  /** Se llama cuando el valor pedido se recortó por falta de energía. */
  onClamped(): void;
}

export const isSheltered = (id: ModuleId, game: GameState): boolean =>
  game.shelterToday && (id === 'greenhouse' || id === 'workshop');

/**
 * Efecto en vivo del módulo, con números. Es solo para mostrar: los valores reales del día los
 * calcula el motor (previewDay). Sin signos confusos: el blindaje dice la radiación que queda.
 */
function effectText(id: ModuleId, value: number, game: GameState): { text: string; ready?: boolean } {
  const b = defaultConfig.balance;
  const fx = b.effects;
  const e = value / b.modules[id].maxEnergy;
  if (isSheltered(id, game)) return { text: t('tablet.effect.sheltered') };
  switch (id) {
    case 'recycler':
      if (value === 0) return { text: t('tablet.effect.off') };
      return { text: t('tablet.effect.life_support', { valor: signed(fx.recyclerLifeSupport * e) }) };
    case 'greenhouse':
      if (value === 0) return { text: t('tablet.effect.off') };
      return {
        text: t('tablet.effect.greenhouse', {
          comida: signed(fx.greenhouseFood * e),
          agua: signed(-fx.greenhouseWaterCost * e),
        }),
      };
    case 'shield': {
      const base = b.difficulty[game.difficulty].doseBaseDaily;
      return {
        text: t('tablet.effect.shield', { valor: num(base * (1 - fx.shieldReduction * e), 2), sin: num(base, 2) }),
      };
    }
    case 'workshop':
      return value >= fx.workshopMinEnergy
        ? { text: t('tablet.effect.workshop_ready'), ready: true }
        : { text: t('tablet.effect.workshop_idle', { min: fx.workshopMinEnergy }) };
  }
}

export function EnergySlider({ id, game, onClamped }: Props) {
  const max = defaultConfig.balance.modules[id].maxEnergy;
  const minWorkshop = defaultConfig.balance.effects.workshopMinEnergy;
  const value = plan.value[id];
  const broken = game.modules[id].broken;
  const noEnergy = (budget.value?.available ?? 0) < 1;
  const sheltered = isSheltered(id, game);
  const repairPending = game.repairToday === id;
  const canRepair = !game.modules.workshop.broken && (budget.value?.available ?? 0) >= minWorkshop;
  const inputId = `slider-${id}`;
  const effect = effectText(id, value, game);

  const set = (next: number): void => {
    if (setPlanValue(id, next)) onClamped();
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    // El navegador ya hace flechas ±1 y Home/End; Shift + flecha salta de 5 en 5.
    if (!e.shiftKey) return;
    const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    set(value + step);
  };

  return (
    <section class={`module${broken ? ' module--broken' : ''}${sheltered ? ' module--sheltered' : ''}`}>
      <label class="module__head" for={inputId}>
        <Icon name={id} size={24} />
        <span class="module__name">{t(`module.${id}`)}</span>
        <span class="module__value">
          <b>{value}</b>
          <span class="module__max">/ {max}</span>
        </span>
      </label>
      <input
        id={inputId}
        class="module__slider"
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        disabled={broken || noEnergy || resolving.value}
        aria-valuetext={t('tablet.slider_valuetext', { valor: value, max, efecto: broken ? t('tablet.broken') : effect.text })}
        onInput={(e) => set(Number(e.currentTarget.value))}
        onKeyDown={onKeyDown}
      />
      <p class="module__what">{t(`module.${id}.what`)}</p>
      {broken ? (
        <p class="module__repair">
          <Icon name="alert" size={16} />
          <span>{t('tablet.broken')}</span>
          {repairPending ? (
            <>
              <span class="module__reason">{t('tablet.repair_scheduled')}</span>
              <button type="button" class="btn btn--small btn--ghost" onClick={() => requestRepair(null)}>
                {t('tablet.repair_cancel')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                class="btn btn--small"
                disabled={!canRepair || resolving.value}
                onClick={() => requestRepair(id)}
              >
                {t('tablet.repair', { min: minWorkshop })}
              </button>
              {!canRepair && (
                <span class="module__reason">
                  {t(game.modules.workshop.broken ? 'event.reason.workshop_broken' : 'event.reason.workshop_energy')}
                </span>
              )}
            </>
          )}
        </p>
      ) : (
        <p class={`module__effect${effect.ready ? ' module__effect--ready' : ''}`}>
          {effect.ready && <Icon name="check" size={16} />}
          <span>{effect.text}</span>
        </p>
      )}
    </section>
  );
}
