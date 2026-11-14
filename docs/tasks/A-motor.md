# Área A — Motor (`src/sim`)

Spec y API: `docs/specs/01-motor-simulacion.md`. Nada de DOM, Three, Preact ni `Math.random`.
Verificación de toda tarea de esta área: `npm test && npm run check`.

## Hechas

- **A-01** `previewDay` y `runDay` · **A-02** `scheduleEvents` · **A-03** `resolveEvent`, `getEventOptions`, `setRepairToday` · **A-04** `computeResult` · **A-05** estrategias, `npm run simulate`, test de balance con 1000 semillas y ajuste de `balance.json`.

## A-06 · Eventos menores e insignias (P2)

**Contexto.** El motor solo tiene eventos garantizados. Faltan los menores aleatorios y las insignias
del debrief. Es contenido extra: no bloquea nada.

**Eventos menores** (`00-documento-original.md` §6.1–6.2):
1. En `events.ts`, función nueva `rollMinorEvent(state, cfg): ScheduledEvent | null`. Usa un rng derivado de semilla y día, igual que el retraso del rover en `engine.ts` (`createRng((seed ^ Math.imul(day, CONSTANTE)) >>> 0)`). Probabilidad: `difficulty.minorEventChance`.
2. Solo si el día no tiene evento garantizado, no es el día 1 y no es 29 ni 30.
3. Tipos: `harvest` (+8 comida), `earth_message` (sin efecto; `payload.factIndex` elegido con el rng), `micro_fault` (−5 batería, solo Comandante), `supplies` (+10 comida y +10 soporte vital, solo Cadete). Los valores van en `balance.json` dentro de un bloque nuevo `minorEvents`, no en el código.
4. En `engine.ts`, `openEventForToday` llama a `rollMinorEvent` cuando no hay evento programado. Todos tienen una sola opción `ok`; el efecto se aplica en `resolveEvent` (limitando a 0–100 y a la capacidad de la batería).
5. Claves i18n `log.harvest`, `log.earth_message`, `log.micro_fault`, `log.supplies` en ES y EN.

**Insignias** (`§4.9`), en `scoring.ts`, calculadas desde `state.history` y `state.log`:
- `night_guardian`: ningún `blackout` en los días de `light.nightDays`.
- `solar_shield`: todas las entradas de tormenta de la bitácora son `log.storm.shelter` (y hubo al menos una).
- `ice_hunter`: existe `log.rover.arrived`.
- `steady_hand`: existe un `log.repair.done` el mismo día que su `log.breakdown`.
- `zero_waste`: `wasted === 0` en todo el historial.
`computeResult` necesita entonces `state.log`: amplía su primer parámetro. Máximo 3 insignias, en ese orden.

**Hecho cuando:** tests nuevos para cada evento menor y cada insignia; `npm run simulate` sigue cumpliendo los objetivos (si no, ajustar solo `balance.json` y anotarlo en `DECISIONES.md`); el test de 1000 semillas de eventos garantizados sigue pasando.

## A-07 · Umbrales de estrellas (P2)

`npm run simulate` muestra que la jugadora prudente nunca saca 3 estrellas y en Comandante nunca
pasa de 1. Probar umbrales más bajos en `balance.json` → `stars` (por ejemplo 8 y 18) hasta que
prudente obtenga 2 estrellas en ~30 % de sus victorias de Comandante. Actualizar el test de
estrellas en `balance.test.ts` para que lea los umbrales de `defaultConfig` en vez de 15 y 30.
