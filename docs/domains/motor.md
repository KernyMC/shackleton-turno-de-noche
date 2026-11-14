# Dominio: motor del juego

Referencia profunda extraída del código el 2026-11-14 (16 archivos de test, 184 tests en verde). Ante la duda manda el código. Cubre `src/sim/**`, `src/state/store.ts` (y los observadores de `src/state/`), `public/data/balance.json`, `public/data/light_sequence.json` y `scripts/simulate.ts`. Specs de origen: `docs/specs/01-motor-simulacion.md`, `00-documento-original.md`.

## 1. Propósito y alcance
- Una partida = 30 días (`balance.days`), dos dificultades (`cadete`, `comandante`), 4 módulos (`recycler`, `greenhouse`, `shield`, `workshop`), 5 actos con objetivo propio. Cada día el jugador reparte energía (Sol + batería − gasto fijo) y decide un evento como mucho.
- Victoria: llegar al final del día 30 sin causa de derrota. Derrota ("misión abortada"): `dose >= doseLimit` (radiation), `lifeSupport <= 0`, `food <= 0`. La batería nunca causa derrota.
- Estrellas (solo victoria): margen mínimo de la partida (`minMargin`: mínimo de soporte vital, comida y "dosis restante" = 100 − % del límite) frente a `balance.stars.two/three`.
- `src/sim` no conoce DOM, Three ni Preact. Todo número sale de `balance.json`/`light_sequence.json`/tormentas (`config.ts`). Tutorial = Cadete con semilla fija 4242 (`state/mode.ts`).

## 2. Mapa de archivos
| Archivo | Responsabilidad |
|---|---|
| `src/sim/types.ts` | Contrato: `GameState`, `Balance`, `ScheduledEvent`, `StormData`, `ActDef`, `EnergyBudget`… Sin imports de UI |
| `src/sim/engine.ts` | `createGame`, `getLight`, `getEnergyBudget`, `validatePlan`, `fitPlan`, `getStormDose`, `previewDay`, `getEventOptions`, `resolveEvent`, `setRepairToday`, `setCleanToday`, `runDay` (+ `computeDay`, `openEventForToday`, `closeActIfDue`, `applyDayUnlocks`) |
| `src/sim/events.ts` | `scheduleEvents` (calendario por semilla), `stormsForRange`, `breakableModules` |
| `src/sim/acts.ts` | Actos: `actOf`, `isLastDayOfAct`, `actGoalStatus` (progreso para HUD), `actGoalMet`, `isUnlocked`, `maxEnergyFor` |
| `src/sim/fastForward.ts` | `fastForwardStep`, `fastForward`, `stepReason`, `nightSoon`, `REPEAT_ORDER` |
| `src/sim/thresholds.ts` | `resourceLevels`, `anyResourceLow`, `resourceEnteredLow` (Bajo/Crítico) |
| `src/sim/scoring.ts` | `lossCauses`, `minMargin`, `computeResult` (estrellas; `badges` siempre `[]`) |
| `src/sim/verdict.ts` | `planVerdict`: safe/tight/critical de un plan (solo lee `previewDay`) |
| `src/sim/debrief.ts` | `reviewMission`: día decisivo, día de rebobinado (−2), tormentas, apagones, mínimos |
| `src/sim/comms.ts` | `antennaOn`, `stormWarning`: la antena (Taller con energía ayer) avisa de tormentas |
| `src/sim/config.ts` | `buildConfig`, `defaultConfig`, `parseRealStorms`; elige `storms_real.json` o `storms_sample.json` |
| `src/sim/rng.ts` | `createRng(seed)` mulberry32: `next`, `int`, `pick` |
| `src/sim/strategies.ts` | Jugadores automáticos `allRecycler`, `randomPlayer`, `prudent`, `playGame` |
| `src/state/store.ts` | Signals y acciones; único puente motor ↔ UI ↔ escena |
| `src/state/mode.ts` | `gameMode`, `menuMode`, `TUTORIAL_SEED`=4242, `TUTORIAL_DAYS`=5, flag localStorage `halosur:tutorial:v1`, `startTutorial`/`startNormal` |
| `src/state/tutorial.ts` | Guía por pasos (observa el store; no cambia reglas), presentación `halosur:tutorial:intro:v1` |
| `src/state/acts.ts` | Cola de tarjeta de acto y avisos (`actCard`, `toast`, `unlockFlash`); solo presentación |
| `src/state/rewards.ts` | XP visual, números flotantes, cosecha, frase del día, hitos; solo presentación |
| `src/state/crewActivity.ts` | Función pura: qué hace cada tripulante (clave `crew.act.*`) |
| `src/state/spaceWeather.ts` | Cliente de `/api/spaceweather`; `liveStorm()` (ver `docs/domains/datos.md`) |
| `src/state/{crewPanel,loading,sources}.ts` | Señales de UI (panel tripulación, pantalla de carga, panel de fuentes) |
| `scripts/simulate.ts` | `npm run simulate [-- N]`: N partidas por estrategia y dificultad |

## 3. Modelo de estado (`GameState`, `version: 2`)
`seed`, `difficulty`, `day` (1..30, el que se planifica), `battery`, `lifeSupport`, `food` (0..100), `dose` (mSv acumulados, sin tope), `modules[id] = {broken, brokenSinceDay?}`, `roverAvailable` (se escribe pero nadie lo lee), `result`.
- `phase`: `planning` (se puede planificar y `runDay`) → `event` (hay `pendingEvent`; `runDay` lanza error) → `planning` tras `resolveEvent` → … → `ended` (con `result`). `outcome` está en el tipo pero ningún código lo asigna.
- `pendingEvent`: `ScheduledEvent` + `options[]` (`{id, disabledReason?}`); se rellena al empezar el día del evento.
- `scheduledEvents`: calendario completo creado en `createGame` (no se modifica; las tormentas llevan su `StormData` en `payload`). `pendingEffects`: `{day, kind:'rover_water', amount}`.
- `unlocked`: módulos con energía posible; los demás tienen máximo 0. `actsMet`: ids (1..5) de actos cerrados con objetivo cumplido.
- `dust`: polvo en paneles; multiplica la producción solar por `effects.dustSolarFactor` hasta limpiarlo. Lo activa el evento `dust` al abrirse.
- Decisiones del día (se limpian al cerrar el día en `runDay`): `shelterToday`, `stormToday` (nivel `S1..S4` que golpea hoy), `repairToday` (módulo a reparar), `roverSendToday`, `cleanToday`.
- `lastPlan`: plan del día anterior (alimenta la antena y el preset "repetir"). `history[]`: `DaySnapshot` por día jugado (batería, recursos, solar, desperdicio, apagón, refugio, plan). `log[]`: máximo 100 `LogEntry` (`key` i18n + `vars`; el motor nunca guarda texto traducido).

## 4. El ciclo de un día
**`getEnergyBudget`**: `solar = r2(solarMax × getLight(day) × (dust ? dustSolarFactor : 1))`; `raw = battery + solar − baseConsumption`; `available = r2(max(0, raw))`; `blackout = raw < 0`. Claves por dificultad: `difficulty.<d>.{solarMax, baseConsumption, batteryCapacity, nightLightBonus}`.
**`getLight`**: `light_sequence.light[day-1]`; en días de `nightDays` y con `nightLightBonus > 0` (solo Cadete) devuelve `min(0.1, raw + bonus)` (el 0.1 está fijo en código). Día fuera de 1..30 lanza error.
**`validatePlan`**: por módulo valor finito ≥ 0 (`plan.error.negative.<id>`), ≤ `maxEnergyFor` (bloqueado = 0; error `plan.error.over_max.<id>`), 0 si está averiado (`plan.error.broken.<id>`); suma ≤ `available` (`plan.error.over_budget`). **`fitPlan`** recorta un plan deseado en orden de prioridad, con enteros.
**`computeDay`** (compartido por `previewDay` y `runDay`; `previewDay` devuelve deltas + batería final + `wasted` + `blackout`):
1. Módulos bloqueados se ponen a 0. `left = available − Σplan`; `battery = r2(min(batteryCapacity, left))`; `wasted = r2(max(0, left − batteryCapacity))`.
2. Eficiencia `eff = broken ? 0 : plan / modules.<id>.maxEnergy`. Reciclador no depende del refugio; invernadero = 0 si `shelterToday`; blindaje no depende del refugio. El Taller no produce: solo activa acciones.
3. `lifeSupport += recyclerLifeSupport×eRecycler − greenhouseWaterCost×eGreenhouse − crewConsumption.lifeSupportPerPerson×crew − (blackout ? blackoutLifeSupportPenalty : 0)`; luego `+ amount` de cada `rover_water` con `day == hoy`; clamp 0..100.
4. `food += greenhouseFood×eGreenhouse − crewConsumption.foodPerPerson×crew`; clamp 0..100.
5. `dose += doseBaseDaily×(1 − shieldReduction×eShield) + (stormToday ? getStormDose : 0)`; `getStormDose = stormDose[level] × (shelterToday ? shelterDoseFactor : 1)`. Sin clamp.
**`runDay`** (exige `phase==='planning'` y plan válido) en este orden:
1. Avisos de apagón, desperdicio y llegada del agua del rover.
2. `workshopActive = !shelterToday && !workshop.broken && plan.workshop >= effects.workshopMinEnergy`.
3. Reparación (`repairToday`): arregla si hay Taller activo, si no log `log.repair.failed`. Rover (`roverSendToday`) con Taller activo: tirada `createRng((seed ^ imul(day, 0x9e3779b1))>>>0).next() < roverDelayChance[dif]` → llega en día+1 o +2; `roverAvailable=false` hasta que no queden efectos. Limpieza (`cleanToday`) quita `dust` si hay Taller activo y polvo.
4. Recordatorio de avería cuando `day − brokenSinceDay == events.brokenReminderDays`; avisos Bajo/Crítico y de dosis con `thresholds`.
5. Snapshot en `history`, `lastPlan`; se limpian `shelterToday`, `stormToday`, `repairToday`, `roverSendToday`, `cleanToday`.
6. Derrota (`lossCauses`, todas las causas, orden radiation > life_support > food) o `day >= days` → `phase:'ended'` y `computeResult`. En el día 30 la derrota gana a la victoria. En derrota NO se cierra el acto; en victoria del día 30 sí (`closeActIfDue`).
7. Si sigue: `closeActIfDue(day)`, `day+1`, `applyDayUnlocks` (desbloqueos por `acts.unlocks.byDay`) y `openEventForToday`.
**`resolveEvent(state, optionId)`**: lanza error si no hay evento, opción desconocida o con `disabledReason`; vuelve a `planning`. Solo el motor decide efectos (§6). `createGame` NO aplica `byDay`: solo `unlocks.initial`.

## 5. Actos y desbloqueos (`balance.acts`, evaluados en `acts.ts`)
| Acto | Días | key | Objetivo (`goal.type`, métrica) |
|---|---|---|---|
| 1 | 1–5 | `llegada` | `air_food`: `min(lifeSupport, food) >= target` |
| 2 | 6–10 | `sol_despierta` | `battery_pct`: `battery / batteryCapacity × 100 >= target` |
| 3 | 11–17 | `noche_larga` | `no_blackout`: 0 apagones en `history` dentro del acto |
| 4 | 18–24 | `amanecer` | `all_min`: `min(lifeSupport, food, battery%) >= target` |
| 5 | 25–30 | `cuenta_final` | `reach_day`: `history.length >= target` y `result.outcome !== 'loss'` |
Los `target` están en `balance.json` (no copiarlos). El objetivo se evalúa una vez, al cerrar el último día del acto, con el estado ya resuelto; anota `log.act.met`/`log.act.missed` y `actsMet`. `actGoalStatus` da el progreso en vivo (campos `goal`, `vars`, `progress`, `value`, `met`, `pending`).
Desbloqueos: `initial` = recycler + greenhouse; `byDay.workshop` = al empezar ese día (también habilita rover y limpieza); `onFirstStorm` = shield, al abrirse la primera tormenta (el refugio funciona aunque el blindaje esté bloqueado). Cada desbloqueo deja `log.unlock`.

## 6. Eventos
Calendario (`scheduleEvents(seed, difficulty, cfg, {firstStorm?})`): `createRng(seed)`; `place()` filtra días libres de la ventana (nunca el día 1, nunca un día ocupado), `rng.pick(free)` y marca el día; sin hueco se descarta (sin consumir tirada). Orden FIJO de colocación (cambiarlo altera todas las partidas): eventos `events.fixed` → `ice` (`iceWindow`) → tormentas (`events.storms`, cada hueco solo si `levels[dif]` no es null) → averías (`events.breakdowns`). Tormentas: se sortea SIEMPRE `rng.pick(stormsForRange(cfg.storms, range))`, aunque luego `firstStorm` sustituya a la primera (así el resto no cambia). `stormsForRange`: eventos reales cuyo nivel cae en el rango; si no hay, los del nivel más cercano; nunca cambia el nivel. Averías: por cada hueco se tiran `rng.next()` y `rng.pick(breakableModules)` siempre; ocurre si `roll < chance[dif]`. `breakableModules`: Cadete greenhouse/shield; Comandante recycler/greenhouse/shield (el Taller nunca).
| Tipo | Cuándo | Opciones (`id`) | Efecto |
|---|---|---|---|
| `harvest` | día fijo | `ok` | Suma `effects.harvestFood` a comida (clamp 100) |
| `dust` | día fijo | `clean`, `tilt` | Al abrirse: `dust=true` (ya reduce solar ese día). `clean`: `cleanToday` (se resuelve al cerrar el día con Taller activo). `tilt`: sin efecto propio |
| `night_warning` | día fijo | `ok` | Solo `log.night_warning` |
| `ice` | `iceWindow` | `send`, `skip` | `send`: `roverSendToday` (requiere Taller); deshabilitado `event.reason.no_time` si `day >= days` |
| `storm` | por acto | `shelter`, `work` | Fija `stormToday=level`; `shelter` → `shelterToday=true` (invernadero 0, Taller inactivo, dosis ×`shelterDoseFactor`) |
| `breakdown` | por acto | `repair`, `later` | Al abrirse: el módulo ya queda `broken`. `repair` fija `repairToday`; `later` no |
Avería: candidatos `[previsto, greenhouse, shield, recycler]`, el primero no roto; si no hay, o cae en `recycler` sin que fuera el previsto, NO se abre evento. `repair`/`send`/`clean` se deshabilitan con `event.reason.workshop_broken` o `event.reason.workshop_energy` (Taller bloqueado o `available < workshopMinEnergy`). Tipos `earth_message`, `micro_fault`, `supplies` existen en `EventKind` pero ningún código los programa (caen en el `default` de `resolveEvent`: opción `ok`, log `log.<kind>`).
Tormenta real por nivel: el rango de nivel sale de `events.storms[i].levels[dificultad]` (números 1..4 = S1..S4); el pool es `defaultConfig.storms` (`storms_real.json`: solo nivel ≥ 2; sin él, `storms_sample.json`). Tormenta "en vivo": `store.startGame` pasa `firstStorm: liveStorm()`, reemplaza solo la primera.
Reglas: ningún día tiene dos eventos; el aviso de noche ocupa el día 9, por eso la avería de la ventana 8–9 cae siempre el 8. El acto 1 solo trae cosecha y polvo (lo comprueba `balance.test.ts`).

## 7. Avance rápido y umbrales
`fastForwardStep`: si `ended`/`event` no corre. Pone a 0 módulos averiados o bloqueados, ajusta con `fitPlan` en `REPEAT_ORDER` (recycler, shield, greenhouse, workshop); si el plan ajustado suma menos que el deseado → NO ejecuta y devuelve `invalid_plan`. `fastForward` corre hasta `fastForward.maxDays` (`max`).
Razones de parada en `stepReason(prev, next)`, por prioridad: `end` > `event` > `act` (cambió el id del acto) > `low` (algún recurso EMPEORÓ de nivel; si ya estaba bajo, no frena) > `night_soon` (hoy no es noche y hay noche en los próximos `fastForward.nightLookahead` días). Fuera de `stepReason`: `invalid_plan`, `max`.
`thresholds.resourceLevels`: aire y comida 0/1/2 con `thresholds.low`/`critical`; dosis por fracción del límite con `doseCaution`/`doseDanger`; batería solo nivel 1 si `<= capacity × batteryLow`. Los usan HUD, `verdict.ts`, `debrief.ts`, avisos del motor y `resolveMs`.
`verdict.planVerdict` revisa de lo grave a lo leve: apagón, dosis ≥ danger, aire/comida ≤ critical (critical) y luego dosis ≥ caution, aire/comida ≤ low (tight); si no, safe.

## 8. Store (`src/state/store.ts`)
Señales: `screen` (menu/game/debrief), `gameId`, `game`, `plan` (siempre válido para `game`), `resolving`, `fastForwarding`, `ffDays`, `ffStop`, `lastOutcome`, `dayStates` (estado al inicio de cada día jugado, para rebobinar), `nearTarget`, `focusModule`, `skyView`, `tabletOpen`, `realAssets`, `commanderName` (localStorage `halosur:commander:v1`, máx. 20), computadas `budget` y `preview`.
Acciones: `startGame(dif, seed?)` (semilla: argumento ?? `?seed=` de la URL ?? `Date.now()>>>0`), `rewindTo(day)`, `restart()` (misma dificultad, seed+1), `exitToMenu`, `toggleTablet`, `setPlanValue`, `applyPreset('repeat'|'saving'|'zero')`, `executeDay`, `chooseEventOption`, `requestRepair`, `requestClean`, `startFastForward`, `cancelFastForward`, `interact`. En DEV expone `window.__store`.
Temporizadores: `RESOLVE_MS`=1500 (día con algo importante), `QUIET_RESOLVE_MS`=800 (`resolveMs`: sin evento, tormenta, reparación, limpieza, rover ni recurso bajo), `FF_MS`=600 entre días del avance. Con `prefers-reduced-motion` todo es inmediato. `executeDay` calcula `runDay` al instante pero publica `game` al terminar el temporizador.
Qué bloquea a qué: `resolving` o `fastForwarding` bloquean `setPlanValue`, `applyPreset`, `executeDay`, `requestRepair`, `requestClean`, `startFastForward`. `chooseEventOption` solo en fase `event` y sin `disabledReason`. `startFastForward` exige sin `pendingEvent` y plan válido. `startGame`/`rewindTo`/`exitToMenu` llaman a `cancelResolve` (cancela temporizadores y avance). `toggleTablet` no cierra la tablet en fase `event`. Con reparación/limpieza/rover marcados, `reserveWorkshop` sube el Taller a `workshopMinEnergy` y reajusta el plan.
Persistencia: ninguna partida se guarda; solo localStorage de nombre, tutorial hecho y presentación vista.

## 9. Invariantes que no se rompen
1. `src/sim` es puro: sin DOM/Three/Preact/`Math.random`/`Date`; solo `rng.ts`. Misma semilla + mismas decisiones = misma partida (`balance.test.ts`, "determinismo").
2. Las funciones del motor devuelven estado NUEVO; nunca mutan la entrada (tests "no muta").
3. Ningún número de balance en código: todo en `public/data/*.json`. Cambiar `balance.json` obliga a correr `npm run simulate` y `npm test`.
4. Un módulo bloqueado tiene máximo 0 de energía (`maxEnergyFor`); `computeDay` además lo ignora.
5. Nunca dos eventos el mismo día ni evento en el día 1; el orden de colocación en `scheduleEvents` es contrato.
6. Cada `place`/sorteo consume tiradas siempre en el mismo orden (también las tormentas sustituidas por `firstStorm`); alterar el orden cambia todas las semillas.
7. Las reglas viven en el motor; la UI/escena leen estado y llaman acciones del store. Nada de lógica de juego en componentes.
8. `previewDay`/`planVerdict` usan `computeDay`, así que muestran exactamente lo que hará `runDay`.
9. Nunca se cambia el nivel de una tormenta real; solo se elige cuál (`stormsForRange`).
10. El log guarda claves i18n + `vars`, jamás texto; toda clave nueva exige ES y EN (`i18n.test.ts`).
11. Cada commit deja el juego jugable (`npm test && npm run check && npm run build`) y, si tocó reglas, el test de balance en verde.
12. Sin muerte: la derrota es "misión abortada". Con la semilla 4242 y una jugada guiada, el acto 1 se cumple (`tutorial.test.ts`).

## 10. Tests
Correr: `npm test` (Vitest, `src/**/*.test.ts`, entorno node), `npm run check`, `npm run simulate [-- N]`.
| Archivo | Cubre |
|---|---|
| `sim/engine.test.ts` | rng, `createGame`, luz, presupuesto, `validatePlan`, `runDay` (producción, apagón, refugio, tope 100), derrota/victoria, eventos y reparación |
| `sim/acts.test.ts` | actos, objetivos, desbloqueos, polvo, cosecha, versión del estado |
| `sim/balance.test.ts` | calendario en 1000 semillas × 2 dificultades, determinismo, puntuación, balance (abajo) |
| `sim/fastForward.test.ts` | cada razón de parada, prioridad (`stepReason`), equivalencia con `runDay` |
| `sim/verdict.test.ts`, `debrief.test.ts`, `comms.test.ts`, `config.test.ts` | veredicto, lectura de misión, antena, carga de tormentas reales/muestra/en vivo |
| `state/store.test.ts` | plan, `executeDay` y ritmo, eventos, rebobinar, avance rápido, limpieza |
| `state/tutorial.test.ts`, `rewards.test.ts`, `crewActivity.test.ts`, `spaceWeather.test.ts` | guía, recompensas visuales, actividad de tripulación, cliente del proxy |
| `i18n/i18n.test.ts` | ES/EN con las mismas claves, claves usadas en código, textos de todo lo que genera el motor |
Test de balance (1000 partidas, tormentas reales): `todo-al-reciclador` pierde SIEMPRE en Comandante entre los días 12 y 18; `prudente` gana ≥ 70 % Comandante y ≥ 90 % Cadete; la prudente nunca pierde antes del día 6; `aleatoria` ≤ 25 % en ambas.
`npm run simulate`: carga `storms_real.json` a mano (sin `import.meta.glob`) y muestra por dificultad × estrategia: `victorias %`, `día medio derrota`, `actos cumplidos (de 5)` (media de `actsMet`), `derrotas antes del día 6`, `estrellas 1/2/3` (conteos de partidas ganadas) y `causas` (causa principal). Lectura de referencia (300 partidas): reciclador 0 % (muere de comida ~día 14–15), aleatoria 0 %, prudente 100 % en ambas y 4 de 5 actos de media.

## 11. Deudas y trampas conocidas
- La prudente gana 100 % también en Comandante (el test solo exige ≥ 70 %), y en Comandante no saca 3 estrellas (185/115/0 en 300 partidas). DECISIONES.md aún cita 71,3 % (valor previo a v4).
- La avería del acto 2 cae siempre el día 8 (el 9 lo ocupa `night_warning`); no hay azar real en ese hueco.
- `difficulty.*.minorEventChance` está en `balance.json` y `types.ts` pero ningún código lo lee. `earth_message`, `micro_fault`, `supplies` y `badges` (siempre `[]`, tarea A-06) siguen sin implementar. `roverAvailable` se escribe, nadie lo lee.
- No hay persistencia de partidas: recargar pierde la partida; `dayStates` vive en memoria.
- Números en código: `0.1` (tope de luz con `nightLightBonus`, `getLight`), `REWIND_MARGIN = 2` (`debrief.ts`), `MAX_LOG = 100`, constantes de la tirada del rover (`0x9e3779b1`) y de `strategies.ts` (solo pruebas).
- `balance.json` lleva un bloque `sources` que el motor ignora (no está en `Balance`); BVAD y dosis están `simulated`, el resto `game_balance`.
- `stepReason` y `store.ffStepOnce` calculan `max` por separado (uno por días del llamado, otro por `ffDays` acumulado).
- Las tormentas reales dependen de `storms_real.json` (solo nivel ≥ 2; en 2024 hay 9 de nivel 4). Un `firstStorm` en vivo hace que la misma semilla no repita exactamente la partida entre días.
- CLAUDE.md cita "50 tests"; hoy son 184.

## 12. Si cambias X, revisa Y
| Cambias | Revisa |
|---|---|
| Un número de `balance.json` | `npm run simulate`, `npm test` (balance), `docs/domains/datos.md` si es dosis/consumo (`status` en `sources.json`), DECISIONES.md |
| Añadir un tipo de evento | `types.ts` (`EventKind`), `getEventOptions` y `resolveEvent`, `scheduleEvents`/`balance.events`, textos `event.*` ES y EN, `EventPanel.tsx`, `EventInfographic.tsx`, `src/i18n/i18n.test.ts`, `balance.test.ts`, `simulate` y `strategies.ts` (`choose`) |
| Añadir una clave de log o de motivo | `es.json` y `en.json` (claves `log.*`, `event.reason.*`), `i18n.test.ts`, `rewards.ts` y `quipRules.ts` si la usan |
| Orden de `place`/tiradas en `events.ts` | Todas las semillas cambian: `balance.test.ts`, `tutorial.test.ts` (semilla 4242), `simulate` |
| Fórmulas de `computeDay` | `previewDay`, `verdict.ts`, `strategies.prudent`, `rewards.dayYields` (`state/rewards.ts` reproduce rendimientos), `EnergyFlow`/`PowerBoard`, `simulate` |
| Un acto (días, objetivo) | `balance.acts`, `acts.ts`, `ActHud`/`ActCard`, textos `act.*`, `tutorial.ts` (acto 1), `fastForward` (parada por `act`), test de balance (`actOfDay`) |
| Desbloqueos | `acts.unlocks`, `strategies.allocate`, `crewActivity`, escena (`construction.ts`), tutorial |
| `thresholds` | `verdict.ts`, `debrief.ts`, HUD, `fastForward` ("low"), `resolveMs`, tests de umbrales |
| `GameState` (campo nuevo) | `createGame`, `version` y `types.ts`, `store.ts` (`dayStates`/rebobinar), tests; no hay migración (sin persistencia) |
| Acción nueva del store | Respetar los bloqueos de §8, `reserveWorkshop`, `store.test.ts`, equivalente en la tablet (regla 5 de CLAUDE.md) |
| `light_sequence.json` | Debe tener `days` valores en 0..1 (`assertConfig`), `nightDays` (antena, FF `night_soon`, estrategia prudente), `simulate` |
