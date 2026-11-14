# Spec 01 — Motor de simulación (`src/sim`)

Reglas completas: `00-documento-original.md`, secciones 4, 5, 6 y 16. Aquí va solo el contrato y
lo que cambia.

## Estado actual

Hecho y con tests: `types.ts`, `rng.ts`, `config.ts`, y en `engine.ts`: `createGame`, `getLight`,
`getEnergyBudget`, `validatePlan`.

## API que falta (firmas obligatorias)

```ts
// engine.ts — todas puras: devuelven un estado NUEVO, nunca mutan el que reciben.
previewDay(state, plan, cfg?): DayPreview        // deltas previstos, sin eventos ni azar
runDay(state, plan, cfg?): GameState             // orden exacto de la sección 4.6 del original
resolveEvent(state, optionId, cfg?): GameState   // aplica la decisión del evento pendiente
getEventOptions(state, plan, cfg?): PendingEvent['options'] // con disabledReason

// events.ts
scheduleEvents(seed, difficulty, cfg?): ScheduledEvent[]    // garantizados + reglas de choque

// scoring.ts
computeResult(state, cfg?): GameResult           // causas, estrellas, insignias
```

`DayPreview = { lifeSupport: number; food: number; dose: number; battery: number; wasted: number; blackout: boolean }` (deltas, salvo `battery` que es el valor final).

## Reglas clave (resumen)

- Energía: `disponible = max(0, batería + solarMax × luz − base)`. Negativo → apagón parcial, −3 de soporte vital.
- `batería = min(capacidad, disponible − suma(plan))`; lo que no cabe es energía desperdiciada.
- Eficiencia `e = asignado / máximo`. Reciclador `+14e` soporte vital. Invernadero `+9e` comida y `−2e` soporte vital. Blindaje reduce la dosis base `60 % × e`.
- Refugio: invernadero y taller producen 0; dosis de tormenta × 0,15.
- Tripulación consume 10 de soporte vital y 6 de comida al día.
- Derrota al final del día: soporte vital 0, comida 0 o dosis ≥ límite. Prioridad `radiation > life_support > food`. Día 30 sin derrota → victoria.
- El motor guarda **claves i18n** en la bitácora, nunca texto.

## Cambios respecto al original

- Las tormentas salen de `public/data/storms.json` (reales) si existe; si no, de `storms_sample.json` (simuladas). El motor solo usa `level`; `date`, `classType` y `status` viajan en el `payload` para la ficha de fuente.
- La acción física y el botón de la tablet llaman a la misma `resolveEvent`. El motor no sabe de cronómetros.

## Tests mínimos

Los de la sección 16 del original. Imprescindibles para P0: `previewDay` coincide con `runDay`,
determinismo, cada causa de derrota, día 30, eventos garantizados sin choques (1000 semillas),
y el test de balance (todo al reciclador pierde en Comandante entre los días 12–18; el plan prudente gana).
