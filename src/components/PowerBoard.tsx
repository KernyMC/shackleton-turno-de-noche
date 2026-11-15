// Tablero de energía: la interacción central, en forma visual.
//   - Barra de reparto: cuánta energía hay hoy y a dónde va (un color por módulo, el resto a la
//     batería, lo que no cabe se pierde rayado).
//   - Cuatro columnas que se llenan por bloques con el color del módulo (y de quien lo cuida).
//     Se tocan los bloques, se usan − / +, o el teclado (flechas, Shift ±5, Inicio/Fin).
//   - Veredicto: un sello de color y tres medidores de cómo amanece la base mañana.
// Solo muestra y llama al store; las reglas viven en el motor.
import { CREW, crewFullName } from '../data/crew';
import { t } from '../i18n';
import { defaultConfig } from '../sim/config';
import { isUnlocked } from '../sim/acts';
import { MODULE_IDS } from '../sim/types';
import type { GameState, ModuleId } from '../sim/types';
import type { Verdict } from '../sim/verdict';
import { unlockFlash } from '../state/acts';
import { applyNightRation, applyPreset, budget, focusModule, plan, preview, requestClean, requestRepair, resolving, setPlanValue } from '../state/store';
import { nightInfo } from '../sim/night';
import { emotionOf, moodOf, planEmotion } from '../state/rewards';
import { resourceLevels } from '../sim/thresholds';
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
  if (!isUnlocked(game, id) || isSheltered(id, game) || game.modules[id].broken) return null;
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
  const locked = !isUnlocked(game, id);
  const flash = unlockFlash.value?.module === id;
  const broken = !locked && game.modules[id].broken;
  const sheltered = !locked && isSheltered(id, game);
  const disabled = locked || broken || resolving.value || (budget.value?.available ?? 0) < 1;
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
      class={`meter${active ? ' meter--active' : ''}${broken ? ' meter--broken' : ''}${sheltered ? ' meter--sheltered' : ''}${locked ? ' meter--locked' : ''}${flash ? ' meter--flash' : ''}`}
      style={{ '--mod': COLOR[id] }}
      data-module={id}
      onPointerDown={() => !locked && (focusModule.value = id)}
    >
      <div class="meter__head">
        <span class="meter__icon">
          <Icon name={locked ? 'lock' : broken ? 'alert' : sheltered ? 'shield' : id} size={20} />
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
        aria-hidden={locked ? 'true' : undefined}
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

      {locked ? (
        <p class="meter__lock">
          <b>{t('lock.title')}</b>
          <span>{t('lock.soon')}</span>
        </p>
      ) : (
        <p class="meter__value">
          <b>{value}</b>
          <span>/{max}</span>
        </p>
      )}

      {locked ? null : broken ? (
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

      <p class={`meter__out${out?.ready ? ' meter__out--ready' : ''}`} hidden={locked}>
        {out ? (
          <>
            <Icon name={out.icon} size={14} />
            {out.text}
          </>
        ) : (
          <span class="meter__off">{t(broken ? 'board.broken' : 'board.shelter')}</span>
        )}
      </p>
      <span class="meter__crew" title={crewFullName(crew.id)} hidden={locked}>
        <CrewPortrait crew={crew.id} color={crew.css} size={22} />
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

/** Veredicto del plan: sello de color + una línea con lo que pasará hoy. Vive en el pie fijo del panel. */
export function Forecast({ verdict, advice }: { verdict: Verdict; advice?: string | null }) {
  const p = preview.value;
  const word = verdict.reason === 'blackout' ? 'tablet.verdict.blackout' : `tablet.verdict.${verdict.level}`;
  return (
    <div class={`forecast forecast--${verdict.level}`} role="status" aria-live="polite">
      {/* El sello se vuelve a estampar (rebote) cada vez que cambia el veredicto. */}
      <div class="forecast__stamp" key={word}>
        <svg class="forecast__face" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="13" />
          {verdict.level === 'safe' ? (
            <path d="M10 13.5q2-3 4 0M18 13.5q2-3 4 0M9.5 18.5q6.5 7 13 0" />
          ) : verdict.level === 'tight' ? (
            <path d="M11 13v2M21 13v2M10.5 21h11" />
          ) : (
            <path d="M9.5 11.5l4 2M22.5 11.5l-4 2M11 14.5v1.5M21 14.5v1.5M10.5 22.5q5.5-5 11 0" />
          )}
        </svg>
        <span>{t(word)}</span>
      </div>
      {advice ? (
        <p class="forecast__words forecast__advice">
          <Icon name="alert" size={18} /> <span>{advice}</span>
        </p>
      ) : (
        p && (
          <p class="forecast__words">
            {t('board.after_today', { aire: signed(p.lifeSupport), comida: signed(p.food), bateria: num(p.battery, 0) })}
          </p>
        )
      )}
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

/** Polvo en los paneles: una tarjeta como la de reparar, con un solo botón claro. */
function DustCard({ game: g }: { game: GameState }) {
  if (!g.dust || g.phase !== 'planning') return null;
  const min = defaultConfig.balance.effects.workshopMinEnergy;
  const canClean = isUnlocked(g, 'workshop') && !g.modules.workshop.broken && (budget.value?.available ?? 0) >= min;
  const on = g.cleanToday;
  return (
    <div class="repairs">
      <div class={`repair repair--dust${on ? ' repair--on' : ''}`}>
        <span class="repair__icon" aria-hidden="true">
          <Icon name="sun" size={22} />
        </span>
        <div class="repair__body">
          <p class="repair__title">{t(on ? 'dust.on' : 'dust.title')}</p>
          {!on && !canClean && <p class="repair__note repair__note--warn">{t('dust.need', { min })}</p>}
        </div>
        {on ? (
          <button type="button" class="btn btn--small btn--ghost" disabled={resolving.value} onClick={() => requestClean(false)}>
            {t('dust.cancel')}
          </button>
        ) : (
          <button type="button" class="btn btn--small repair__go" disabled={!canClean || resolving.value} onClick={() => requestClean(true)}>
            <Icon name="workshop" size={16} />
            {t('dust.button', { min })}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Noche lunar: dos días antes dice que hay que llegar con la batería llena y ofrece guardar; cada
 * noche dice cuántas quedan, cuánta batería hay y cuánto se puede gastar, y reparte esa ración con
 * un botón. Así el jugador sabe qué puede hacer en vez de pasar los días a ciegas.
 */
function NightCard({ game: g }: { game: GameState }) {
  if (g.phase !== 'planning') return null;
  const info = nightInfo(g);
  if (!info) return null;
  const capacity = defaultConfig.balance.difficulty[g.difficulty].batteryCapacity;
  const battery = Math.round(g.battery);
  const pct = Math.max(0, Math.min(100, (g.battery / capacity) * 100));
  const busy = resolving.value;
  return (
    <div class={`nightc nightc--${info.phase}`} role="group" aria-label={t('night.aria')}>
      <span class="nightc__moon" aria-hidden="true"><Icon name="moon" size={26} /></span>
      <div class="nightc__body">
        <p class="nightc__title">
          {info.phase === 'soon'
            ? t(info.daysUntil === 1 ? 'night.soon.one' : 'night.soon', { n: info.daysUntil })
            : t('night.now', { n: info.nightIndex, total: info.nightTotal })}
        </p>
        <div class="nightc__meter" role="img" aria-label={t('night.battery', { n: battery, max: capacity })}>
          <Icon name="battery" size={18} />
          <span class="nightc__bar"><i style={{ width: `${pct}%` }} /></span>
          <b>{battery}</b>
          <span class="nightc__max">/ {capacity}</span>
        </div>
        <p class="nightc__tip">
          {info.phase === 'soon'
            ? t(pct >= 95 ? 'night.soon.full' : 'night.soon.tip', { total: info.nightTotal })
            : info.ration > 0
              ? t('night.ration', { n: info.ration, left: info.nightsLeft })
              : t(info.nightsLeft === 1 ? 'night.empty.last' : 'night.empty', { left: info.nightsLeft })}
        </p>
      </div>
      {info.phase === 'soon' && pct < 95 && (
        <button type="button" class="btn btn--small nightc__go" disabled={busy} onClick={() => applyPreset('saving')}>
          {t('night.save')}
        </button>
      )}
      {info.phase === 'night' && info.ration > 0 && (
        <button type="button" class="btn btn--small nightc__go" disabled={busy} onClick={() => applyNightRation()}>
          {t('night.share')}
        </button>
      )}
    </div>
  );
}

/**
 * Recursos justo encima de las barras: Aire sobre el Reciclador, Comida sobre el Invernadero y la
 * Batería al lado. Cada uno con su carita, su valor de hoy y cuánto cambiará con el plan actual,
 * para que repartir y ver el resultado ocurra en el mismo sitio.
 */
function PlanResources({ game: g }: { game: GameState }) {
  const pv = preview.value;
  if (!pv) return null;
  const capacity = defaultConfig.balance.difficulty[g.difficulty].batteryCapacity;
  const moods = moodOf(g);
  const after = resourceLevels({ ...g, lifeSupport: g.lifeSupport + pv.lifeSupport, food: g.food + pv.food, battery: pv.battery });
  const items = [
    { id: 'life', icon: 'life_support' as const, label: t('hud.life_support'), value: g.lifeSupport, max: 100, delta: pv.lifeSupport, crew: CREW.find((c) => c.id === 'valeria')!, face: planEmotion(emotionOf(moods.valeria), pv.lifeSupport, after.lifeSupport) },
    { id: 'food', icon: 'food' as const, label: t('hud.food'), value: g.food, max: 100, delta: pv.food, crew: CREW.find((c) => c.id === 'mateo')!, face: planEmotion(emotionOf(moods.mateo), pv.food, after.food) },
    { id: 'battery', icon: 'battery' as const, label: t('hud.battery'), value: g.battery, max: capacity, delta: pv.battery - g.battery, crew: CREW.find((c) => c.id === 'lucia')!, face: planEmotion(emotionOf(moods.lucia), pv.battery - g.battery, after.battery) },
  ];
  return (
    <div class="pres" role="status" aria-live="polite" aria-label={t('pres.aria')}>
      {items.map((it) => {
        const d = Math.round(it.delta);
        const now = Math.max(0, Math.min(100, (it.value / it.max) * 100));
        const then = Math.max(0, Math.min(100, ((it.value + it.delta) / it.max) * 100));
        return (
          <div key={it.id} class={`pres__item pres--${it.id}${d > 0 ? ' pres__item--up' : d < 0 ? ' pres__item--down' : ''}`}>
            <span class="pres__face"><CrewPortrait crew={it.crew.id} color={it.crew.css} size={34} emotion={it.face} /></span>
            <span class="pres__name"><Icon name={it.icon} size={14} /> <span class="pres__label">{it.label}</span></span>
            <span class="pres__value">
              <b>{Math.round(it.value)}</b>
              {d !== 0 && (
                <span key={d} class="pres__delta">
                  <span aria-hidden="true">{d > 0 ? '▲' : '▼'}</span> {signed(d)}
                </span>
              )}
            </span>
            <span class="pres__bar" aria-hidden="true">
              <i class="pres__now" style={{ width: `${now}%` }} />
              {Math.abs(then - now) >= 0.5 && (
                <i class={`pres__ghost pres__ghost--${then > now ? 'up' : 'down'}`} style={{ left: `${Math.min(now, then)}%`, width: `${Math.abs(then - now)}%` }} />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PowerBoard({ game: g, verdict, onClamped }: { game: GameState; verdict: Verdict; onClamped(): void }) {
  return (
    <>
      <ShareBar game={g} wasted={verdict.wasted} />
      <RepairCards game={g} />
      <DustCard game={g} />
      <NightCard game={g} />
      <PlanResources game={g} />
      <div class="board" role="group" aria-label={t('board.aria')}>
        {MODULE_IDS.map((id) => (
          <Column key={id} id={id} game={g} onClamped={onClamped} />
        ))}
      </div>
    </>
  );
}
