// Tablero de energía: la interacción central, en forma visual.
//   - Barra de reparto: cuánta energía hay hoy y a dónde va (un color por módulo, el resto a la
//     batería, lo que no cabe se pierde rayado).
//   - Cuatro columnas que se llenan por bloques con el color del módulo (y de quien lo cuida).
//     Se tocan los bloques, se usan − / +, o el teclado (flechas, Shift ±5, Inicio/Fin).
//   - Veredicto: un sello de color y tres medidores de cómo amanece la base mañana.
// Solo muestra y llama al store; las reglas viven en el motor.
import { CREW } from '../data/crew';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { getLight } from '../sim/engine';
import { MODULE_IDS } from '../sim/types';
import type { GameState, ModuleId } from '../sim/types';
import type { Verdict } from '../sim/verdict';
import { budget, focusModule, plan, preview, requestRepair, resolving, setPlanValue } from '../state/store';
import { CrewPortrait } from './CrewPortrait';
import { EnergyFlow } from './EnergyFlow';
import { num, signed } from './format';
import { Icon } from './icons';
import type { IconName } from './icons';

/** Energía que vale cada bloque de una columna. */
export const BLOCK = 5;
const COLOR: Record<ModuleId, string> = Object.fromEntries(CREW.map((c) => [c.module, c.css])) as Record<ModuleId, string>;

export const isSheltered = (id: ModuleId, game: GameState): boolean =>
  game.shelterToday && (id === 'greenhouse' || id === 'workshop');

/** Lo que produce el módulo con esa energía: ícono del recurso y número (solo para mostrar). */
function yieldOf(id: ModuleId, value: number, game: GameState): { icon: IconName; text: string; ready?: boolean } | null {
  const b = defaultConfig.balance;
  const fx = b.effects;
  const e = value / b.modules[id].maxEnergy;
  if (isSheltered(id, game) || game.modules[id].broken) return null;
  switch (id) {
    case 'recycler':
      return { icon: 'life_support', text: signed(fx.recyclerLifeSupport * e) };
    case 'greenhouse':
      return { icon: 'food', text: signed(fx.greenhouseFood * e) };
    case 'shield': {
      const base = b.difficulty[game.difficulty].doseBaseDaily;
      return { icon: 'dose', text: `${num(base * (1 - fx.shieldReduction * e), 1)}` };
    }
    case 'workshop':
      return value >= fx.workshopMinEnergy ? { icon: 'check', text: t('board.ready'), ready: true } : { icon: 'workshop', text: `${value}/${fx.workshopMinEnergy}` };
  }
}

function Column({ id, game, onClamped }: { id: ModuleId; game: GameState; onClamped(): void }) {
  const max = defaultConfig.balance.modules[id].maxEnergy;
  const value = plan.value[id];
  const blocks = Math.ceil(max / BLOCK);
  const broken = game.modules[id].broken;
  const sheltered = isSheltered(id, game);
  const disabled = broken || resolving.value || (budget.value?.available ?? 0) < 1;
  const active = focusModule.value === id;
  const crew = CREW.find((c) => c.module === id)!;
  const out = yieldOf(id, value, game);

  const set = (next: number): void => {
    focusModule.value = id;
    if (setPlanValue(id, next)) onClamped();
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (disabled) return;
    const step = e.shiftKey ? BLOCK : 1;
    const moves: Record<string, number> = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step };
    if (e.key in moves) set(value + moves[e.key]!);
    else if (e.key === 'Home') set(0);
    else if (e.key === 'End') set(max);
    else return;
    e.preventDefault();
  };

  return (
    <div
      class={`meter${active ? ' meter--active' : ''}${broken ? ' meter--broken' : ''}${sheltered ? ' meter--sheltered' : ''}`}
      style={{ '--mod': COLOR[id] }}
      data-module={id}
      onPointerDown={() => (focusModule.value = id)}
    >
      <div class="meter__head">
        <span class="meter__icon">
          <Icon name={broken ? 'alert' : sheltered ? 'shield' : id} size={20} />
        </span>
        <span class="meter__name">{t(`module.${id}`)}</span>
      </div>

      <div
        id={`slider-${id}`}
        class="meter__track"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={t(`module.${id}`)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={t('board.valuetext', { valor: value, max, modulo: t(`module.${id}`) })}
        aria-disabled={disabled}
        onKeyDown={onKeyDown}
        onFocus={() => (focusModule.value = id)}
      >
        {Array.from({ length: blocks }, (_, i) => {
          const level = blocks - i; // de arriba (lleno) a abajo
          const top = Math.min(max, level * BLOCK);
          const filled = Math.min(1, Math.max(0, (value - (level - 1) * BLOCK) / Math.min(BLOCK, max - (level - 1) * BLOCK)));
          return (
            <button
              key={level}
              type="button"
              tabIndex={-1}
              class="meter__block"
              disabled={disabled}
              aria-hidden="true"
              onClick={() => set(value === top ? top - BLOCK : top)}
            >
              <span style={{ height: `${filled * 100}%` }} />
            </button>
          );
        })}
      </div>

      <p class="meter__value">
        <b>{value}</b>
        <span>/{max}</span>
      </p>

      {broken ? (
        <p class={`meter__state${game.repairToday === id ? ' meter__state--fixing' : ''}`}>
          <Icon name={game.repairToday === id ? 'workshop' : 'alert'} size={14} />
          {t(game.repairToday === id ? 'board.repairing' : 'board.broken')}
        </p>
      ) : (
        <div class="meter__steps">
          <button type="button" aria-label={t('board.less', { modulo: t(`module.${id}`) })} disabled={disabled || value === 0} onClick={() => set(value - BLOCK)}>
            −
          </button>
          <button type="button" aria-label={t('board.more', { modulo: t(`module.${id}`) })} disabled={disabled || value === max} onClick={() => set(value + BLOCK)}>
            +
          </button>
        </div>
      )}

      <p class={`meter__out${out?.ready ? ' meter__out--ready' : ''}`}>
        {out ? (
          <>
            <Icon name={out.icon} size={14} />
            {out.text}
          </>
        ) : (
          <span class="meter__off">{t(broken ? 'board.broken' : 'board.shelter')}</span>
        )}
      </p>
      <span class="meter__crew" title={t(`crew.${crew.id}.name`)}>
        <CrewPortrait color={crew.css} size={22} />
      </span>
    </div>
  );
}

/** Barra de reparto: toda la energía de hoy y a dónde va. */
function ShareBar({ game: g, wasted }: { game: GameState; wasted: number }) {
  const total = Math.max(0, budget.value?.available ?? 0);
  const used = MODULE_IDS.reduce((sum, id) => sum + plan.value[id], 0);
  const toBattery = Math.max(0, total - used - wasted);
  const pct = (v: number): string => `${total > 0 ? (v / total) * 100 : 0}%`;
  const capacity = defaultConfig.balance.difficulty[g.difficulty].batteryCapacity;
  return (
    <div class="share">
      <EnergyFlow />
      <p class="share__left">
        <Icon name="battery" size={15} />
        {t('board.to_battery', { valor: num(toBattery, 0), max: capacity })}
      </p>
      <div class="share__bar" role="img" aria-label={t('board.share_aria', { usada: num(used, 0), total: num(total, 0) })}>
        {MODULE_IDS.map((id) => (
          <span key={id} class="share__seg" style={{ width: pct(plan.value[id]), background: COLOR[id] }} />
        ))}
        <span class="share__seg share__seg--battery" style={{ width: pct(toBattery) }} />
        <span class="share__seg share__seg--wasted" style={{ width: pct(wasted) }} />
      </div>
      {wasted > 0 && (
        <p class="share__warn">
          <Icon name="alert" size={14} />
          {t('board.wasted', { valor: num(wasted, 0) })}
        </p>
      )}
    </div>
  );
}

const STAMP: Record<Verdict['level'], IconName> = { safe: 'check', tight: 'alert', critical: 'alert' };

/** Veredicto: sello de color + tres medidores de mañana. */
function Forecast({ verdict, capacity }: { verdict: Verdict; capacity: number }) {
  const p = preview.value;
  const word = verdict.reason === 'blackout' ? 'tablet.verdict.blackout' : `tablet.verdict.${verdict.level}`;
  const gauges: { key: string; icon: IconName; label: string; value: number; max: number; flag: boolean }[] = [
    { key: 'life', icon: 'life_support', label: 'hud.life_support', value: verdict.lifeSupport, max: 100, flag: verdict.reason === 'life_support' },
    { key: 'food', icon: 'food', label: 'hud.food', value: verdict.food, max: 100, flag: verdict.reason === 'food' },
    { key: 'battery', icon: 'battery', label: 'hud.battery', value: verdict.battery, max: capacity, flag: verdict.reason === 'blackout' },
  ];
  return (
    <div class={`forecast forecast--${verdict.level}`} role="status" aria-live="polite">
      <div class="forecast__stamp">
        <Icon name={STAMP[verdict.level]} size={26} />
        <span>{t(word)}</span>
      </div>
      <div class="forecast__gauges" aria-label={t('tablet.verdict.tomorrow')}>
        <span class="forecast__label">{t('tablet.verdict.tomorrow')}</span>
        {p && (
          <p class="forecast__words">
            {t('board.after_today', { aire: signed(p.lifeSupport), comida: signed(p.food), bateria: num(p.battery, 0) })}
          </p>
        )}
        {gauges.map((gauge) => {
          const level = gauge.value / gauge.max <= 0.1 ? 'critical' : gauge.value / gauge.max <= 0.25 ? 'low' : 'ok';
          return (
            <div key={gauge.key} class={`gauge gauge--${level}${gauge.flag ? ' gauge--flag' : ''}`} title={t(gauge.label)}>
              <Icon name={gauge.icon} size={16} />
              <span class="gauge__bar"><span style={{ width: `${Math.max(0, Math.min(100, (gauge.value / gauge.max) * 100))}%` }} /></span>
              <b>{Math.round(gauge.value)}</b>
              <span class="sr-only">{t(gauge.label)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Avería: un solo botón claro, con lo que cuesta y cuándo queda listo. */
function RepairCards({ game: g }: { game: GameState }) {
  const broken = MODULE_IDS.filter((id) => g.modules[id].broken);
  if (broken.length === 0) return null;
  const min = defaultConfig.balance.effects.workshopMinEnergy;
  const canRepair = !g.modules.workshop.broken && (budget.value?.available ?? 0) >= min;
  return (
    <div class="repairs">
      {broken.map((id) => {
        const fixing = g.repairToday === id;
        return (
          <div key={id} class={`repair${fixing ? ' repair--on' : ''}`} style={{ '--mod': COLOR[id] }}>
            <span class="repair__icon" aria-hidden="true">
              <Icon name="workshop" size={22} />
            </span>
            <div class="repair__body">
              <p class="repair__title">{t(fixing ? 'repair.title_on' : 'repair.title', { modulo: t(`module.${id}`) })}</p>
              {fixing ? (
                <p class="repair__note">{t('repair.in_progress')}</p>
              ) : (
                !canRepair && <p class="repair__note repair__note--warn">{t('repair.need', { min })}</p>
              )}
            </div>
            {fixing ? (
              <button type="button" class="btn btn--small btn--ghost" disabled={resolving.value} onClick={() => requestRepair(null)}>
                {t('tablet.repair_cancel')}
              </button>
            ) : (
              <button type="button" class="btn btn--small repair__go" disabled={!canRepair || resolving.value} onClick={() => requestRepair(id)}>
                <Icon name="workshop" size={16} />
                {t('repair.button', { min })}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Pronóstico de Sol: hoy y los próximos días, para decidir cuánto guardar. */
function SunForecast({ game: g }: { game: GameState }) {
  const total = defaultConfig.balance.days;
  const days = Array.from({ length: 6 }, (_, i) => g.day + i).filter((d) => d <= total);
  return (
    <div class="sunfc" role="group" aria-label={t('sunfc.title')}>
      <p class="sunfc__title">{t('sunfc.title')}</p>
      <ol class="sunfc__days">
        {days.map((d) => {
          const light = getLight(d, g.difficulty);
          const dark = light < 0.1;
          const text = t(dark ? 'sunfc.dark' : 'sunfc.light', { pct: Math.round(light * 100) });
          return (
            <li key={d} class={`sunfc__day${d === g.day ? ' sunfc__day--today' : ''}${dark ? ' sunfc__day--dark' : ''}`} title={text}>
              <span class="sunfc__bar" aria-hidden="true">
                <span style={{ height: `${Math.max(6, light * 100)}%` }} />
              </span>
              <Icon name={dark ? 'moon' : 'sun'} size={13} />
              <span class="sunfc__label">{d === g.day ? t('sunfc.today') : t('sunfc.day', { dia: d })}</span>
              <span class="sr-only">{text}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function PowerBoard({ game: g, verdict, onClamped }: { game: GameState; verdict: Verdict; onClamped(): void }) {
  const capacity = defaultConfig.balance.difficulty[g.difficulty].batteryCapacity;
  return (
    <>
      <ShareBar game={g} wasted={verdict.wasted} />
      <RepairCards game={g} />
      <div class="board" role="group" aria-label={t('board.aria')}>
        {MODULE_IDS.map((id) => (
          <Column key={id} id={id} game={g} onClamped={onClamped} />
        ))}
      </div>
      <Forecast verdict={verdict} capacity={capacity} />
      <SunForecast game={g} />
    </>
  );
}
