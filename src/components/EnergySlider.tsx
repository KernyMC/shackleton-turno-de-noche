// Un módulo del planificador: slider de energía, efecto previsto y estado (averiado, refugio).
// Solo muestra; las reglas viven en el motor y el store.
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import type { GameState, ModuleId } from '../sim/types';
import { budget, plan, requestRepair, resolving, setPlanValue } from '../state/store';
import { signed } from './format';
import { Icon } from './icons';

interface Props {
  id: ModuleId;
  game: GameState;
  /** Se llama cuando el valor pedido se recortó por falta de energía. */
  onClamped(): void;
}

/** Texto del efecto previsto. Es solo para mostrar: el número real lo calcula previewDay. */
function effectText(id: ModuleId, value: number, game: GameState, sheltered: boolean): string {
  const b = defaultConfig.balance;
  const fx = b.effects;
  const e = value / b.modules[id].maxEnergy;
  if (sheltered && (id === 'greenhouse' || id === 'workshop')) return t('tablet.effect.sheltered');
  switch (id) {
    case 'recycler':
      return t('tablet.effect.life_support', { valor: signed(fx.recyclerLifeSupport * e) });
    case 'greenhouse':
      return t('tablet.effect.greenhouse', {
        comida: signed(fx.greenhouseFood * e),
        agua: signed(-fx.greenhouseWaterCost * e),
      });
    case 'shield':
      return t('tablet.effect.shield', {
        valor: signed(-b.difficulty[game.difficulty].doseBaseDaily * fx.shieldReduction * e, 2),
      });
    case 'workshop':
      return value >= fx.workshopMinEnergy
        ? t('tablet.effect.workshop_ready')
        : t('tablet.effect.workshop_idle', { min: fx.workshopMinEnergy });
  }
}

export function EnergySlider({ id, game, onClamped }: Props) {
  const max = defaultConfig.balance.modules[id].maxEnergy;
  const minWorkshop = defaultConfig.balance.effects.workshopMinEnergy;
  const value = plan.value[id];
  const broken = game.modules[id].broken;
  const noEnergy = (budget.value?.available ?? 0) < 1;
  const sheltered = game.shelterToday && (id === 'greenhouse' || id === 'workshop');
  const repairPending = game.repairToday === id;
  const canRepair = !game.modules.workshop.broken && (budget.value?.available ?? 0) >= minWorkshop;
  const inputId = `slider-${id}`;
  const effect = broken ? t('tablet.broken') : effectText(id, value, game, game.shelterToday);

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
    <div class={`module${broken ? ' module--broken' : ''}${sheltered ? ' module--sheltered' : ''}`}>
      <label class="module__head" for={inputId}>
        <Icon name={id} />
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
        aria-valuetext={t('tablet.slider_valuetext', { valor: value, max, efecto: effect })}
        onInput={(e) => set(Number(e.currentTarget.value))}
        onKeyDown={onKeyDown}
      />
      <p class="module__effect">
        {broken && <Icon name="alert" size={16} />}
        <span>{effect}</span>
      </p>
      {broken &&
        (repairPending ? (
          <p class="module__repair">
            <span>{t('tablet.repair_scheduled')}</span>
            <button type="button" class="btn btn--small btn--ghost" onClick={() => requestRepair(null)}>
              {t('tablet.repair_cancel')}
            </button>
          </p>
        ) : (
          <p class="module__repair">
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
          </p>
        ))}
    </div>
  );
}
