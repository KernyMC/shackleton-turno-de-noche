# Spec 01 — Motor de simulación (`src/sim`)

Reglas de origen: `00-documento-original.md` §4–6. **El motor está completo y probado** (50 tests).
Este documento es la referencia de su API para quien construya la interfaz y la escena.

## Archivos

| Archivo | Contenido |
|---|---|
| `types.ts` | Todos los tipos. Contrato compartido |
| `rng.ts` | `createRng(seed)` → `next()`, `int(a,b)`, `pick(lista)` |
| `config.ts` | `defaultConfig` (balance + luz + tormentas desde `public/data`) y `stormsStatus` |
| `engine.ts` | Funciones del juego (abajo) |
| `events.ts` | `scheduleEvents`, `breakableModules` |
| `scoring.ts` | `lossCauses`, `minMargin`, `computeResult` |
| `strategies.ts` | Jugadores automáticos (`prudent`, `allRecycler`, `randomPlayer`), `allocate`, `playGame` |

## API (`engine.ts`) — todas puras: devuelven estado nuevo

```ts
createGame(seed, difficulty): GameState          // programa los eventos con la semilla
getLight(day, difficulty): number                // 0..1
getEnergyBudget(state): { solar, base, available, blackout }
validatePlan(state, plan): { ok, errors[] }      // errors = claves i18n
previewDay(state, plan): DayPreview              // deltas de soporte vital, comida, dosis; batería final; desperdicio
runDay(state, plan): GameState                   // lanza error si el plan es inválido o phase !== 'planning'
resolveEvent(state, optionId): GameState         // lanza error si la opción no existe o está deshabilitada
getEventOptions(state, { kind }): EventOption[]
setRepairToday(state, moduleId | null): GameState // reparar un módulo roto en un día posterior
getStormDose(level, sheltered): number           // para mostrar "Dosis estimada: +X mSv"
EMPTY_PLAN
```

## Ciclo de una partida

```
createGame → phase 'planning' (día 1, nunca hay evento)
  runDay(plan) ──► derrota o día 30 → phase 'ended', state.result relleno
               └─► día + 1 ──► ¿evento programado? → phase 'event', state.pendingEvent
                                   resolveEvent(opción) → phase 'planning'
                           └─► sin evento → phase 'planning'
```

El evento se decide **antes** de planificar el día en que ocurre. La fase `'outcome'` del tipo no la
usa el motor: el resumen del día es cosa de la interfaz.

## Eventos y sus opciones

| `kind` | `payload` | Opciones (`id`) | Efecto |
|---|---|---|---|
| `storm` | `{ id, level, date, classType }` | `shelter`, `work` | Fija `stormToday`; `shelter` pone `shelterToday = true` (dosis × 0,15; invernadero y taller no producen) |
| `breakdown` | `{ module }` | `repair`, `later` | El módulo se rompe al abrirse el evento. `repair` pone `repairToday`; se arregla al final del día **solo si el plan da ≥ 10 al taller** |
| `ice` | — | `send`, `skip` | `send` pone `roverSendToday`; sale **solo si el plan da ≥ 10 al taller**; +25 de soporte vital al día siguiente (10 % de retraso de un día en Comandante) |
| `night_warning` | — | `ok` | Solo aviso |

Opciones deshabilitadas traen `disabledReason` (clave i18n): `event.reason.workshop_energy`,
`event.reason.workshop_broken`, `event.reason.no_time`.

**Importante para la interfaz:** tras elegir `repair` o `send`, el plan debe incluir ≥ 10 en el
taller o la acción falla (queda en la bitácora). La interfaz debe prefijar ese valor y avisar.

## Bitácora

`state.log` guarda `{ day, type, key, vars }`; se traduce con `t(key, vars)`. Las claves `log.*`
ya existen en `es.json` y `en.json`. Cuando `vars.module` es un id de módulo, tradúcelo antes con
`t('module.' + id)`.

## Decisiones tomadas al implementar

- El aviso de noche cae siempre el día 8.
- El taller nunca se avería (sin taller no habría forma de reparar). En Cadete tampoco el reciclador.
- Los valores se redondean a 2 decimales en cada día.
- El margen para las estrellas no cuenta la batería.
- Eventos menores aleatorios e insignias: no implementados (tarea A-06). `badges` siempre es `[]`.

## Balance actual (`npm run simulate`, 1000 partidas)

| Estrategia | Cadete | Comandante |
|---|---|---|
| Prudente | 100 % | 71,3 % |
| Todo al reciclador | 0 % (día 14) | 0 % (día 13) |
| Aleatoria | 0 % | 0 % |

Con los números del documento original Comandante era imposible (prudente 0 %), así que se subieron
batería, sol y reservas iniciales en `balance.json`. Pendiente: nadie llega a 3 estrellas y en
Comandante nadie pasa de 1; revisar los umbrales de `stars` si da tiempo.
