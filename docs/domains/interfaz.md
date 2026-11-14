# Dominio: interfaz (HUD, pantallas, textos, avisos, sonido)

Referencia profunda extraída del código el 2026-11-14; ante la duda manda el código. Reglas: `CLAUDE.md` (9, 10, 11, 13), `docs/ARTE.md` §8b, `docs/RUBRICA.md`. Todo diff aquí pasa por el agente `hud` (regla 10) y por `qa` (regla 11).
**Zona en cambio el 2026-11-14:** otro agente edita el tutorial (`Coach.tsx`, `Onboarding.tsx`, `Menu.tsx`, `src/state/tutorial.ts`, `src/state/mode.ts`). Lo marcado «(en cambio)» puede haber cambiado; reléelo antes de tocarlo.

## 1. Propósito y reglas
- La UI **solo lee señales** de `src/state/*` y **llama acciones** de `src/state/store.ts`; las reglas viven en `src/sim`. Los watchers (`startRewardsWatcher`, `startActsWatcher`, `startSoundWatcher`, `startAmbient`, `startTutorialWatcher`) se arrancan en `App.tsx` y solo observan.
- Ningún texto visible en componentes: `t('clave')` con claves en `es.json` y `en.json` (siempre los dos).
- Todo se puede hacer desde el panel (`Tablet`); tocar la maqueta es atajo. Teclado: `Tab` abre el panel (`Scene.tsx`), `Esc` lo cierra (no en evento), foco atrapado en el panel (`trapFocus` en `Tablet.tsx`).
- Piel «Consola de misión Apolo» (regla 13, ARTE §8b): paneles opacos, borde 2 px, sombra dura, botones que se hunden 2 px, Barlow Condensed / B612 / B612 Mono. Sin vidrio. Ámbar = único color cálido; rojo/violeta solo para avería/tormenta.
- Público 7–12 años; sin muerte («misión abortada»); sin rojo ni cuenta regresiva en avisos de acto.

## 2. Pantallas y flujo (`App.tsx` → `CurrentScreen`, señal `screen` = 'menu'|'game'|'debrief')
| Etapa | Componente | Nota |
|---|---|---|
| Portada | `Menu.tsx` (estado local `step='title'`) | Su propio `createWorld` (escena 3D de portada); botón de idioma `lang` |
| Tripulación + modo | `Menu.tsx` (`step='crew'`) | Selector `.segmented--3`: tutorial / Cadete / Comandante (`menuMode`, `mode.ts`) (en cambio) |
| Carga | `Loader.tsx` (fuera de `CurrentScreen`, siempre montado) | z 100; espera `readyScreen` (`state/loading.ts`: la escena llama `markReady`) |
| Presentación | `Onboarding.tsx` vía `Coach.tsx` (paso `welcome`) | 6 tarjetas (normal) / 3 (tutorial) (en cambio) |
| Juego | `.game`: `Scene`, `Hud`, `CrewPanel`, `Rewards`, `StormWarning`, `Alerts`, `Tablet`, `Coach`, `ActLayer`, `SourcesPanel` | El orden en JSX importa para `~` y para empates de z |
| Evento | `EventPanel.tsx` dentro de `Tablet` (`g.phase==='event'`) + `EventInfographic.tsx` | No se puede cerrar el panel ni apartarlo |
| Final | `Debrief.tsx` + `DebriefCinematic.tsx` (CSS/SVG, sin WebGL) | Tarjeta `ScienceCard.tsx` visible |
| Tutorial hecho | `TutorialDone.tsx` (`overlay tut-done`, z 30) | Lee `tutorialEnd` (en cambio) |
Transversales: `SourcesPanel` («¿De dónde salen los datos?», `sourcesOpen`, z 60), `CrewPanel` (`crewOpen`).

## 3. Mapa de componentes
| Componente | Muestra | Señales / estado | CSS |
|---|---|---|---|
| `Hud.tsx` | `.topbar` (dosis `Dose`, día `Scoreboard`, `EnergyFlow` + `Tools`), `.feed`, `.resources`, botón `.hud__plan` | `game`, `tabletOpen`, `skyView`, `muted`, `crewOpen`, `helpOpen`, `sourcesOpen` | `global.css` |
| `EnergyFlow.tsx` | Sol → Batería → Para repartir | `game`, `budget` | `global.css` (`.eflow*`) |
| `ActHud.tsx` | `ActGoal` (`.act-pill`), `ActToast`, `FastForwardBar` (`.ff-bar`); `useStack` mide la barra | `game`, `toast`, `fastForwarding`, `ffDays` | `acts.css` |
| `ActCard.tsx` | Tarjeta de acto a pantalla completa | `actCard` | `acts.css` |
| `Tablet.tsx` | Panel `.tablet` (lateral ≥1024, hoja <1024) | `game`, `tabletOpen`, `resolving`, `reacting`, `fastForwarding`, `tutorialStep` | `global.css` |
| `PowerBoard.tsx` | Barra de reparto, 4 columnas, sello con 3 medidores, polvo/reparación | `plan`, `preview`, `budget`, `focusModule`, `unlockFlash` | `global.css`, `acts.css` (`.meter--locked/--flash`) |
| `EventPanel.tsx`, `EventInfographic.tsx` | Evento y sus opciones; infografía SVG | `game.pendingEvent`, `sourcesOpen` | `global.css`, `infographic.css` |
| `Rewards.tsx` | `.float` (números), `.harvest`, `.daydone`, `.voice`, `.celebrate` | `floats`, `harvest`, `dayDone`, `dayNote`, `milestone` | `global.css` |
| `Alerts.tsx` | `.alert-toast`, `.alert-vignette`, `.storm-veil` | `game`, `gameId` | `alerts.css` |
| `StormWarning.tsx` | `.warn` (aviso de la Tierra por antena) | `game` (`stormWarning` de `sim/comms`) | `warning.css` |
| `Coach.tsx` / `Onboarding.tsx` | Burbuja de guía `.coach`; presentación (en cambio) | `tutorialStep`, `onboardingOpen`, `tutorialWarn`, `gameMode` | `global.css`, `onboarding.css`, `tutorial.css` |
| `CrewPanel.tsx`, `CrewPortrait.tsx` | `.crewp` panel plegable, retratos | `crewOpen`, `crewFocus`, `crewActivity` | `crew.css` |
| `Loader.tsx` | Pantalla de carga | `readyScreen`, `screen` | `loader.css` |
| `SourcesPanel.tsx`, `SunStatus.tsx`, `ScienceCard.tsx` | Fuentes, estado del Sol, ciencia real | `sourcesOpen`, `spaceWeather` | `sources.css`, `science.css` |
`icons.tsx` = todos los íconos SVG (`<Icon name=…>`); `format.ts` = `num()` y locale (`es-EC`/`en-US`).

## 4. Mapa de zonas del HUD (lo más importante)
Contenedor: `.game` (relativo a la ventana). `.hud` (`position:absolute; inset:0; pointer-events:none; z 4`) crea contexto de apilado: topbar, feed, resources, `.act-pill` (z 3) y `.hud__plan` viven dentro; solo sus botones capturan toques.
Tokens de posición: `--gutter` (10 px; 6 px <900), `--topbar-h` (82 px), `--panel-w` (`clamp(380px,28vw,440px)`), `--act-top`/`--act-below` (los **mide** `useStack` en `ActHud.tsx` con `ResizeObserver` y los escribe inline en `.game`: `act-top` = fondo de `.topbar` + 8 px; `act-below` = `act-top` + alto de la pastilla + 8 px; `acts.css :root` solo da un respaldo).

| Zona | Bloque (selector) | Escritorio ≥1541 | 900–1540 | Móvil <900 |
|---|---|---|---|---|
| Arriba | `.topbar` | fila, 3 columnas | igual; 900–1279 compacta | 2–3 filas (`'dose tools' 'day day' 'flow flow'`) |
| Bajo la barra, centro | `.act-pill` | `left:50%`, `top:var(--act-top)` | igual | ancho completo |
| Centro con panel abierto (≥1024) | `.act-pill`, `.daydone`, `.celebrate`, `.act-toast`, `.warn`, `.alert-toast`, `.coach` | `left: calc((100% - var(--panel-w))/2)` (centrado en lo libre; vía `.game:has(.tablet:not(.tablet--away))` o `.hud--tablet ~ …`) | igual | no aplica (hoja inferior) |
| Izquierda arriba | `.feed` | `top` = fondo de la columna (ver apilado), `left:gutter`, `width:min(20rem,30vw)`; se desvanece a los 7 s | igual | `bottom: gutter*2+10.8rem`, 1 línea; oculto con hoja abierta |
| Abajo izquierda | `.resources` (3 `.res`) | `left/bottom:gutter` | tarjetas 10,4 rem (≤1279) | fila de 3 a todo el ancho; con hoja abierta pasan a `top:var(--act-below)` sin barras |
| Abajo centro | `.hud__plan` (botón principal) | `left:50%`, centrado | `left:auto; right:gutter` | `bottom: gutter*2+6.4rem`, centrado. Solo existe con el panel cerrado |
| Derecha | `.tablet` | `top: gutter*2+topbar-h … bottom:gutter`, ancho `--panel-w` | igual (≥1024) | <1024: hoja inferior, `max-height` 60 % (52 % <900) |
| Abajo derecha | `.ff-bar` | `left:50%` abajo | `right:gutter` (≥900); sin puntos 900–1099 | `bottom: gutter*2+6.4rem`, sin puntos |
| Abajo izq. sobre recursos | `.voice` (burbuja de voz) | `bottom: gutter*2+8.4rem` | igual | `top: gutter+6.4rem`; **oculta** con hoja abierta |
| Abajo izq. | `.crewp` (panel de tripulación) | `bottom: gutter*2+7.4rem`, 23 rem | igual | <1024: hoja inferior `bottom:gutter`, `max-height:52%` |
| Sobre la maqueta | `.harvest` (fixed, sigue a `sceneBridge.project`), `.float` (fixed) | — | — | — |
| Centro, tarjeta | `.scene__hint`/`.scene__label` | apilado (abajo) | igual | `top:auto; bottom:16.5rem` |
| Pantalla completa | `.actcard`, `.celebrate--big`, `.overlay`, `.src-overlay`, `.loader`, `.storm-veil`, `.alert-vignette` | | | |

**Apilado de los avisos centrados de arriba** (`acts.css`, de arriba abajo): barra → pastilla → [recursos móvil con hoja: `--stk-res` 4.2 rem] → `.warn` (`--stk-warn` 5.4 rem; móvil 6.8, o 3.7 con hoja) → `.alert-toast` (`--stk-alert` 4.2) → `.coach` (`--stk-coach` 6.4; móvil 0 porque va abajo) → `.daydone` / `.act-toast` / `.celebrate:not(--big)` (`--stk-msg` 4.6; comparten hueco `--stk-msgtop`; el hito baja +3.8 rem si hay `.daydone`; en móvil con hito se oculta `.daydone`) → `.scene__hint/.label` y `.feed` (`top` = suma de todo). Cada `--stk-*` se activa con `.game:has(.warn|.alert-toast|.coach|…)`. Cada bloque nuevo que salga arriba al centro necesita su variable aquí.
Doble especificidad `.game.game …` / `.game.game.game …`: es deliberada, para ganar a los `top` antiguos de `global.css`, `warning.css`, `alerts.css`.

**z-index** (dentro de `.game` salvo `fixed`): `.act-pill` 3 (en `.hud`) · `.storm-veil` 3 · `.hud` 4 · `.tablet` 5 · `.warn` 5 · `.scene__*` 5 · `.rewards` 6 (voz, hito, día hecho; `.celebrate--big` incluido) · `.crewp` 6 · `.alert-vignette` 7 · `.ff-bar` 8 · `.act-toast` 9 · `.alert-toast` 9 · `.onb-spot` 9 (fixed) · `.coach` 10 · `.overlay` 20 · `.eflow__tip` 30 · `.tut-done` 30 · `.actcard` 40 (fixed) · `.src-overlay` 60 (fixed) · `.loader` 100 (fixed). Empates (5, 9): gana el último en el DOM (`Tablet` va después de `StormWarning`).

## 5. Hojas de estilo
Orden: `index.astro` importa fuentes `@fontsource` (B612 400/700, B612 Mono 400/700, Barlow Condensed 600/700) → `global.css` → `skin.css`. Las hojas de componente (`acts`, `alerts`, `warning`, `crew`, `onboarding`, `tutorial`, `loader`, `infographic`, `cinematic`, `sources`, `science`) las importa cada componente (`import '../styles/x.css'`) y **su orden respecto a `global.css` no está garantizado**: `skin.css` y `acts.css` ganan por especificidad (`html .x`, `.game.game .x`), no por orden.
- `global.css` (933 líneas): tokens base (`--bg --panel --text --accent #ffb347 --ok --warn --danger --radius --tap`), portada/tripulación, HUD (`:root` con `--glass --line --r-panel --shadow --gutter --topbar-h --panel-w`), recompensas, guía, tablet, tablero de energía, eventos, debrief.
- `skin.css`: **sobrescribe tokens** en `html:root` (`--panel #1b1d21`, `--line/--panel-border #3a3e45`, `--r-panel 6px`, `--shadow 0 4px 0 …`, `--font-display/title/mono`, `--glass` opaco), mata `backdrop-filter` (`html * {…!important}`), define paneles, botones físicos, barras LED. Sus comentarios citan «ARTE §9»; la sección vigente es **§8b**.
- `acts.css`: actos, pastilla, avisos, `ff-bar`, andamios de columna bloqueada, polvo, apilado `--stk-*`. Declara aún `background: var(--glass)` y `backdrop-filter` (anulados por skin).
- Tokens de fuente: `--font-display` Barlow Condensed (títulos, etiquetas, botones; mayúsculas), `--font-title` B612 (texto; el nombre es heredado), `--font-mono` B612 Mono (números, `b`).
- Breakpoints (px): **480** (opciones del evento y botones −/+ apilados) · **520** (debrief, panel tripulación 1 col.) · **600** (tarjetas, panel) · **760** (portada, selector de modo) · **899/900** (móvil ↔ escritorio: gutter 6, topbar 2–3 filas, recursos en fila, plan centrado arriba de recursos, feed abajo, voz arriba) · **1023/1024** (hoja inferior ↔ panel lateral; `crewp`; centrado en lo libre) · 1099 (`ff-bar` sin puntos) · 1150 (`eflow` compacto) · **1279/1280** (recursos más estrechos, sin `.hud__sun`; 900–1279 topbar compacta) · **1540/1541** (botón principal a la derecha ↔ centrado; `skin.css` ajusta su `:active`).
- Movimiento reducido: cada hoja tiene su `@media (prefers-reduced-motion: reduce)` que quita animaciones; en `skin.css` botones sin desplazamiento.

## 6. Textos
- `src/i18n/index.ts`: `lang` (signal `'es'|'en'`), `t(key, vars)`; reemplaza `{var}`; si falta en el idioma activo avisa en DEV y cae a español, luego a la clave. Leer `lang.value` dentro de `t` hace reactivos los textos.
- Convención de prefijos (548 claves): `menu/title/crew/onb/coach/tut/help` (portada, tripulación, presentación, guía, ayuda) · `hud/eflow/sun/sunfc/board/tablet/module/plan/repair/dust/lock/unlock` (HUD y panel) · `event/info/storm/warn/alert/fx` (eventos, infografías, avisos) · `log` (bitácora; **lo emite el motor**) · `act/ff` (actos, avance rápido) · `rewards/quip` (recompensas; `quip.*` lo usa la escena) · `debrief/science/sources` (final, ciencia, fuentes) · `loading/scene/app/debug`.
- Reglas para 7–12 años (NORTE.md): frases cortas, un concepto por frase, términos (radiación, mSv, tormenta solar) explicados donde aparecen, tono cálido; nunca «muerte» ni culpa. Globos de la tripulación ≤ 6 palabras.
- Test guardián `src/i18n/i18n.test.ts` comprueba: mismas claves en ES y EN; ninguna vacía y mismas `{variables}`; toda `t('literal.clave')` del código existe (las claves dinámicas con plantilla **no** se comprueban); todo evento/opción/`disabledReason`/entrada de bitácora que genera el motor (40 semillas × 2 dificultades × 3 estrategias) tiene texto; módulos, tripulación y actos (`act.N.name/goal/pill`, `ff.stopped.*`) tienen texto. Falla → añade el texto, no lo silencies.

## 7. Avisos y colas (quién muestra qué, cuándo)
- `rewards.ts` (solo observa el store): al cerrar un día (si no hay avance rápido) → `floats` (números por módulo, `dayYields`), `dayDone`, `reacting=true` 1,9 s (`REACT_MS`; aparta el panel), `harvest` (si el invernadero trabajó; se recoge sola), `dayNote` (voz: habla el más preocupado ≤25; si no, días impares). Hitos `first_harvest|first_night|storm_safe` → `milestone`. **Avance rápido:** nada de flotantes/cosecha/voz/día hecho; hitos se guardan (`deferred`) y salen uno al parar. Volver atrás en el tiempo no repite recompensas.
- `acts.ts`: cola con **un solo aviso a la vez** (`actCard` o `toast`). Tarjeta de acto (`ACT_CARD_MS` 4,5 s; una por acto y partida; no en tutorial), avisos `met/missed/unlock/stop` (2,5/2,5/3/4 s) desde entradas de bitácora `log.act.met|missed|unlock` y desde `ffStop`. Espera: `settled` (1,3 s tras la carga), `resolving`, `fastForwarding`, `reacting`, `dayDone`, `milestone`, `tutorialEnd`, partida acabada. La **tarjeta** además espera a que no haya evento, ni paso `welcome`, ni presentación; los avisos cortos no. Un aviso `stop` se retira si el día cambió. `unlockFlash` hace destellar la columna 3,5 s.
- `Alerts.tsx`: avería nueva (no al cargar ni al volver atrás) → `.alert-toast` con «Ir al módulo» (`sceneBridge.centerOn` + abre panel) y borde rojo que pulsa 2 veces; velo violeta `.storm-veil` con tormenta pendiente u hoy. `StormWarning.tsx`: solo con antena (Taller con energía ayer); sin antena no se muestra.
- Guía (`Coach.tsx` + `tutorial.ts`) (en cambio): una burbuja con paso `tutorialStep`; se apoya en selectores del panel (`.tablet[data-coach=…] .meter[data-module=…]`, `.btn--execute`, en `global.css`).
- Escena: globos `crewQuips` (`Scene.tsx` decide: máx. uno cada 2 días, nunca con evento, tormenta, resolución ni avance rápido).
- Regla general: **nunca interrumpir** una decisión (evento), la guía, el día que acaba ni el avance rápido; lo que llega durante eso espera o se descarta.

## 8. Sonido
- `audio/sfx.ts`: efectos **sintetizados** (Web Audio) `playTick/Commit/Yield/Collect/DayDone/Milestone/Breakdown/StormAlarm/Repair*/EnergyFlow`; `playSample(id, fallback)` usa muestras opcionales de `public/audio/sfx/` declaradas en `index.json` (hoy `ids: []`: no hay muestras, suena el respaldo). `npm run sfx` (`scripts/generate-sfx.mjs`, ElevenLabs): la clave actual dio 401 (sin permiso `sound_generation`).
- Silencio: señal `muted` (localStorage `halosur:mute:v1`), `toggleMute`; pestaña oculta → sin sonido; el contexto nace con la primera interacción. `sharedContext()` lo comparte el ambiente.
- `audio/watch.ts` (`startSoundWatcher`): clic por bloque de energía, alarma de tormenta, zumbido de avería, reparación, reparto. `audio/ambient.ts` (`startAmbient`): capa por acto, volumen máx. 0,02, fundido 2 s, respeta `muted` y pestaña oculta.

## 9. Verificación
- `window.__hudCheck()` (solo DEV, `src/dev/hudCheck.ts`) devuelve `{ok, viewport, overlaps, buttons, offscreen}`. `BLOCKS` (no deben pisarse): `.topbar`, `.topbar__dose/day/right`, `.feed`, `.resources`, `.hud__plan`, `.tablet:not(.tablet--away)`, `.voice`, `.daydone`, `.warn`, `.alert-toast`, `.coach`, `.celebrate:not(.celebrate--big) .celebrate__card`, `.harvest`, `.scene__hint`, `.scene__label`, `.crewp-panel`, `.act-pill`, `.ff-bar`, `.act-toast`. `NESTED`: topbar con sus tres hijos. Umbral de solape 24 px²; botones: tamaño mínimo 24 px (40 en táctil/<900), nombre accesible, tapado (`elementFromPoint`; bajo `.tablet__actions` no cuenta); `offscreen` incluye scroll horizontal. **No** están en BLOCKS: `.crewp` (el selector `.crewp-panel` no coincide con la clase real `.crewp`), `.actcard`, `.celebrate--big`, `.eflow`.
- `window.__store` (DEV, `store.ts`): `startGame(dif, seed)`, `toggleTablet`, `setPlanValue`, `executeDay`, `chooseEventOption`, `startFastForward`, etc.
- Agentes `.claude/agents/hud.md` (1600×900, 1280×720, 1024×700, 375×812; cada estado; pulsa botones) y `.claude/agents/qa.md` (partidas completas, ES/EN, móvil; corre test/check/build/simulate).

## 10. Invariantes de interfaz
1. Sin texto fuera de `i18n`; toda clave nueva en ES y EN en el mismo cambio.
2. La UI no calcula reglas: lee `game`, `plan`, etc. y llama acciones.
3. Todo botón ≥ 40 px en táctil, con nombre accesible; foco visible ámbar.
4. Todo diálogo: `role`, `Esc` (salvo evento), foco inicial y atrapado, devuelve foco.
5. Un solo aviso de acto a la vez; nada se monta sobre evento, guía, día que acaba o avance rápido.
6. Todo bloque flotante de arriba al centro entra en el apilado `--stk-*` y en `BLOCKS`.
7. Sin `backdrop-filter`, sombras difusas ni degradados decorativos; ámbar único cálido.
8. Con movimiento reducido no hay animaciones ni desplazamientos al pulsar.
9. Nada depende de la red (fuentes auto-alojadas; `localStorage` siempre en `try/catch`).
10. Sin scroll horizontal en 375 px; sin solapes en 1600×900, 1280×720, 1024×700, 375×812.
11. Con el panel abierto en ≥1024 los avisos centrales se centran en lo libre (no tras el panel).
12. Ningún aviso que dependa de hardware (antena) se muestra si el jugador no lo ha ganado.

## 11. Deudas y trampas
- Especificidad doble/triple (`.game.game.game`) en `acts.css` para ganar a `top` antiguos de `global.css`/`warning.css`/`alerts.css` (dead-ish: `.warn{top:82px}`, `.alert-toast` calc, `.coach`/`.daydone`/`.celebrate` top, `.game:has(.warn) .scene__hint{top:11.5rem}`). Limpiar con cuidado.
- Orden de hojas de componente vs `global.css` no garantizado: p. ej. `.tablet{max-height:60%}` (global, <1024) vs `.tablet{max-height:52%}` (acts, <900) tienen igual especificidad.
- Rango 900–1023: el panel ya es hoja inferior pero el botón principal está a la derecha (regla 900–1540) y `.ff-bar` a la derecha; revisar con `hud` en 1000 px.
- `.voice` (bottom 8.4 rem) y `.crewp` (bottom 7.4 rem) comparten esquina en escritorio y ninguna regla los excluye entre sí.
- Selectores de guía (`.tablet[data-coach]…`) ligados a `.meter`, `.meter__head`, `.meter__steps button:last-child`, `.btn--execute`: renombrar clases del panel rompe la guía. (en cambio)
- CSS duplicado/sin uso probable: `--glass`/`backdrop-filter` en acts/crew/alerts (anulados por skin), `.glass`, `.hud__plan` animación `plan-breathe` (anulada: `animation:none`). No comprobado con una herramienta de cobertura.
- `skin.css` cita «ARTE §9» (ahora §8b); `warning.css` comentario «62 px» vs `--topbar-h` 82 px.
- `tutorial.css` usa `background:#0f1114` y colores fijos (fuera de tokens). `--font-title` apunta a B612 (nombre heredado de «Space Grotesk»; `repairFx` aún nombra Space Grotesk en canvas).
- `i18n.test.ts` no valida claves dinámicas (`t(\`module.${id}\`)`) fuera de las listas del test.
- `hudCheck` solo existe en DEV y no cubre `.crewp`.

## 12. Si cambias X, revisa Y
| Cambias | Revisa |
|---|---|
| Añadir un bloque flotante | `BLOCKS` en `hudCheck.ts` · apilado `--stk-*` en `acts.css` (si va arriba al centro) · z-index (§4) · móvil <900 · `skin.css` (regla 13) · agente `hud` |
| Cambiar un texto | ES **y** EN · largo en 375 px · `i18n.test.ts` · tono 7–12 años |
| Nueva pantalla o diálogo | Teclado, `Esc`, foco inicial/atrapado, `role`, z-index, `Loader` y `readyScreen`, `hud` |
| Cambiar `--topbar-h`, `--gutter`, `--panel-w` | `useStack` (mide), recursos/feed/plan/voz/`crewp` (usan `calc`), `Scene.tsx` (`setViewShift` usa 380–440 px y 28 % codificados) |
| Cambiar breakpoints | Las 3 familias: 900, 1024, 1541; `skin.css` (`hud__plan:active`); `Scene.tsx` (umbral 1024) |
| Renombrar clases del panel | Guía (`global.css` `.tablet[data-coach]`), `hudCheck`, `skin.css` |
| Nuevo aviso con cola | `acts.ts` (`TOAST_MS`, condiciones de `blocked`), `ActHud.tsx`, `--stk-msg`, textos |
| Nuevo sonido | `sfx.ts` + `watch.ts`, respeta `muted`/pestaña oculta, `public/audio/sfx/index.json` |
| Nueva animación CSS | Bloque `prefers-reduced-motion` de su hoja |
| Nuevo evento/log del motor | Textos ES/EN + `i18n.test.ts` + infografía/`EventPanel` (regla 11: nunca motor sin interfaz) |

## 13. Intro en cómic y retos diarios (añadido el 2026-11-14)
- **Cómic**: `IntroComic.tsx` + `comic.css` (prefijo `comic-`). `Menu.tsx` tiene `Step = title | comic | crew`; «Comenzar» abre el cómic, terminar o Saltar (Esc) lleva a la tripulación; siempre se muestra. 5 viñetas SVG en código; textos `comic.*`.
- **Retos**: `src/components/challenges/` + `challenge.css` (prefijo `chl-`). `ChallengeModal.tsx` (montado en `App.tsx` tras `ActLayer`; `.chl-overlay` z 35, `role=dialog`, foco atrapado y en el botón principal, Esc no cierra) lee `activeChallenge` y pasa por Misión → Juego → Resultado → `completeChallenge`. El panel de fuentes (z 60) se abre por encima.
- `registry.ts`: un componente por `ChallengeId` con el contrato `{ params, assist, difficulty, options?, onDone(score 0..1, optionId?) }`; si falta, el modal salta o da parcial sin colgar. `shared.tsx`: `numParam`, `useCountdown`, `TimeBar`, `effectLine`, `EffectList`.
- Minijuegos: `RoverIce` (2), `SolarRadar` (4), `HullSeals` (6), `CommCables` (8), `RoboticArm` (12), `BiomedCheck` (14), `RegolithTrench` (16), `Micrometeorites` y `SuperStorm` sobre `SectorDefense` (18, 24), `RelayDocking` (30; con movimiento reducido usa botones Subir/Bajar).
- Ningún número de balance en los componentes: tiempos, tamaños y tolerancias vienen de `def.params[dificultad]`; las puntuaciones fijas de `defaultConfig.challenges.scores`.
- Textos por reto: `challenge.<id>.title|text|how|science|learn` (+ `.assist` si tiene ayuda), comunes `challenge.*`, internos `challenge.<corto>.*`. `logText` de `Hud.tsx` y `Debrief.tsx` traduce `vars.challenge` al título.
- Con el reto abierto, `acts.ts` no muestra tarjetas ni avisos. `__hudCheck()` ignora el HUD de detrás si hay `.chl-overlay` o `.comic-page`.
- Deudas: revisión `hud` pendiente tras los arreglos de móvil (días 16, 18, 24, 30) y de colores del día 8; clases sin estilo propio `chl-sector-fx*` y `chl-relay-nudge/up/down`; `skin.css` pisa fondos de `chl-*` si no llevan prefijo `html`.
- Si cambias: clases `chl-*` → `challenge.css` y `hudCheck` · el contrato de `registry.ts` → los 10 minijuegos y el modal · un reto nuevo → ver `docs/domains/motor.md` §13.
