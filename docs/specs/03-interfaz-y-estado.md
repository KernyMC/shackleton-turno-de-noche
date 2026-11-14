# Spec 03 — Interfaz y estado (`src/state`, `src/components`, `src/i18n`)

Detalle de cada pantalla: `00-documento-original.md` secciones 7–12. Estilo: `docs/ARTE.md` §3 y §8.

## Store (`src/state/store.ts`) — contrato compartido

Es el único puente entre motor, interfaz y escena. Cambiarlo afecta a todos: avisa antes.

```ts
// Signals
screen: 'menu' | 'game' | 'debrief'
game: GameState | null
plan: Plan                       // plan en edición del día actual
tabletOpen: boolean
nearTarget: TargetId | null      // 'recycler' | ... | 'shelter' | 'rover'
resolving: boolean               // true durante la animación del día
settings: { lang, sound, volume, quality, reducedMotion }

// Acciones
startGame(difficulty, seed?)
setPlanValue(moduleId, value)    // se detiene en el máximo posible; nunca deja un plan inválido
applyPreset('repeat' | 'saving' | 'zero')
executeDay()                     // ignora llamadas mientras resolving sea true
chooseEventOption(optionId)      // una sola vez por evento
interact(targetId)               // la escena llama aquí; decide qué significa según el estado
exitToMenu(), toggleTablet()
```

**Estado: implementado (C-01)** con 13 tests en `src/state/store.test.ts`. Además de lo anterior exporta
`lastOutcome`, `budget` y `preview` (computed), `restart()`, `requestRepair(id | null)` y la constante
`RESOLVE_MS`. Todas las acciones devuelven `boolean` (true = tuvo efecto; en `setPlanValue` y
`applyPreset`, true = hubo que recortar). Detalles de comportamiento:

- El plan vuelve a `EMPTY_PLAN` al empezar cada día; "Repetir plan de ayer" lo recupera.
- Tras elegir `repair`/`send` o llamar `requestRepair`, el store reserva 10 de energía en el taller automáticamente.
- Al abrirse un evento, `tabletOpen` pasa a true y `toggleTablet` no la cierra hasta decidir.
- Con `prefers-reduced-motion` el día se resuelve sin espera.
- `?seed=123` en la URL fija la semilla. En desarrollo, `window.__store` da acceso desde la consola.

## Componentes

| Componente | Prioridad | Qué hace |
|---|---|---|
| `Visor` | P0 | 4 indicadores finos + día. Ícono + valor + barra + estado en texto ("Bajo", "Crítico") + tendencia |
| `Tablet` | P0 | Planificador: energía disponible con desglose, 4 sliders, barra de presupuesto, vista previa en vivo (`previewDay`), presets, "Ejecutar día" |
| `EventPanel` | P0 | Evento pendiente dentro de la tablet: texto, opciones con su consecuencia, razón si está deshabilitada. Teclas `1` y `2` |
| `Outcome` | P0 | Resumen breve del día (3 cambios + una línea narrativa) |
| `Debrief` | P0 básico, P1 completo | Causa en una frase, estrellas; luego gráfica SVG, línea de tiempo y tarjetas educativas |
| `Menu` | P0 | Título, nueva partida, idioma, aviso de no afiliación |
| `ForecastStrip` | P1 | Luz de los próximos 5 días, noche marcada |
| `SourceSheet` | P1 | "¿De dónde sale este número?" con estado verificado / simulado / diseño |
| `LogPanel`, `Settings`, `Credits`, `Pause` | P1 | Como en el original |
| `Tutorial` | P2 | Guía de los días 1–3 |

## Reglas

- Todo texto por `t('clave')`. Claves nuevas en `es.json` y `en.json` a la vez.
- Estado nunca solo por color: ícono + texto.
- Sliders: `role="slider"` con `aria-valuetext`; flechas ±1, Shift ±5, Home/End. Zona táctil ≥ 44 px.
- La tablet es un `dialog` con foco atrapado; con un evento que exige decisión no se cierra con Esc.
- Bajo 1024 px o sin WebGL: la tablet ocupa toda la pantalla y el juego se completa sin caminar.
- Guardado en `localStorage` (`halosur:save:v1`) tras cada día y cada evento, siempre en try/catch.
