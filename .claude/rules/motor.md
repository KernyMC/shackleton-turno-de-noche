---
paths:
  - "src/sim/**"
  - "src/state/store.ts"
  - "src/state/store.test.ts"
  - "public/data/balance.json"
  - "public/data/light_sequence.json"
  - "scripts/simulate.ts"
---

# Reglas del motor del juego

Referencia profunda: `docs/domains/motor.md` (léela antes de cambiar nada aquí).

- **Puro y determinista.** Sin DOM, Three, Preact ni `Math.random` (usa `rng.ts`). Misma semilla + mismas decisiones = mismo resultado.
- **Ningún número de balance en el código.** Todo sale de `public/data/balance.json`; si hace falta un número nuevo, se añade ahí con su tipo en `types.ts`.
- **No reescribas el motor**: añade funciones puras con su test. Las firmas que usa la interfaz (`getEnergyBudget`, `previewDay`, `runDay`, `resolveEvent`, `planVerdict`, `actGoalStatus`, `fastForward`…) no cambian; solo se les añaden campos.
- **Todo cambio de balance o de eventos** se comprueba con `npm run simulate` y `npm test` (hay un test de balance y uno de ventanas de eventos con 1000 semillas).
- **Un evento, opción o línea de bitácora nueva no existe hasta que tiene texto en español e inglés** y su vista en `EventPanel.tsx`. El test `src/i18n/i18n.test.ts` lo exige. **No se sube el motor sin su interfaz** (regla 11).
- Un módulo bloqueado recibe 0 de energía en todas las rutas (`validatePlan`, `fitPlan`, `previewDay`).
- Las tormentas son eventos reales de DONKI: se eligen por nivel, **nunca se les cambia el nivel ni los datos**.
- Nada de muerte: la derrota es «misión abortada».

## Antes de dar por hecho un cambio (aristas)
Motor → ¿cambió el balance (simulate)? · Interfaz → ¿la UI muestra el campo/evento nuevo? · Textos → ¿ES y EN? · Escena → ¿algún efecto 3D depende de este estado? · Tutorial → ¿la guía sigue siendo cierta? · Rúbrica → ¿sigue siendo una decisión con costo (3.1)? · `qa` antes del commit.
