# Área A — Motor (`src/sim`)

Spec: `docs/specs/01-motor-simulacion.md`. Reglas: `docs/specs/00-documento-original.md` §4–6.
Forma de trabajo: test primero. Nada de DOM, Three, Preact ni `Math.random`.

## A-01 · `previewDay` y `runDay` (P0)
- **Archivos:** `engine.ts`, `engine.test.ts`.
- **Hacer:** `previewDay` devuelve los deltas del día. `runDay` sigue el orden exacto de §4.6: validar, energía, refugio, producción, consumo, dosis, efectos pendientes, limitar 0–100, guardar `DaySnapshot` y bitácora (claves i18n), comprobar derrota/victoria, avanzar día.
- **Hecho cuando:** tests de producción, consumo, apagón, desperdicio, refugio, límites, derrota por cada causa, dos causas con prioridad, victoria y derrota en el día 30, y `previewDay` = `runDay`. `runDay` no muta el estado recibido.

## A-02 · Programación de eventos (P0)
- **Archivos:** `events.ts`, `events.test.ts`, `public/data/events.json`, `public/data/storms_sample.json`.
- **Hacer:** `scheduleEvents(seed, difficulty)` con las ventanas y reglas de §6.1 (nunca dos el mismo día, nunca día 1, avería nunca en el reciclador de noche en Cadete, tormenta 18–21 distinta del día del hielo). Conectar en `createGame`. Lee tormentas de `storms.json` si existe; si no, de `storms_sample.json`.
- **Hecho cuando:** test con 1000 semillas: todos los garantizados dentro de su ventana y sin choques, en ambas dificultades.

## A-03 · `resolveEvent` y opciones (P0)
- **Depende de:** A-01, A-02.
- **Hacer:** al llegar a un día con evento, `phase = 'event'` y `pendingEvent` con sus opciones. `getEventOptions` marca `disabledReason` (taller < 10, rover el día 30). `resolveEvent` aplica: refugio, reparar (queda arreglado al final del día), rover (+25 mañana; 10 % de retraso en Comandante), avisos sin decisión.
- **Hecho cuando:** tests de cada opción y cada razón de deshabilitado; una partida completa se resuelve solo con llamadas al motor.

## A-04 · Resultado (P0)
- **Archivos:** `scoring.ts`, `scoring.test.ts`.
- **Hacer:** `computeResult`: causas ordenadas, estrellas por margen mínimo (≥ 15 → 2, ≥ 30 → 3).
- **Hecho cuando:** tests de 0, 1, 2 y 3 estrellas.

## A-05 · Balance (P1)
- **Archivos:** `balance.test.ts`, `scripts/simulate.ts`, script `simulate` en `package.json`.
- **Hacer:** tres estrategias automáticas (todo al reciclador, prudente, aleatoria) × 1000 semillas. Objetivos: prudente ≥ 70 % en Comandante y ≥ 90 % en Cadete; todo al reciclador ≤ 10 % en Comandante; aleatoria ≤ 25 %.
- **Hecho cuando:** objetivos cumplidos tocando **solo** `balance.json`; cambios anotados en `DECISIONES.md`.

## A-06 · Insignias y eventos menores (P2)
- Insignias de §4.9 y eventos menores aleatorios de §6.1 (no en días 29–30).
