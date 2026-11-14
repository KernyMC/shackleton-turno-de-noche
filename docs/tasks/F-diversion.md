# Área F — Diversión y aprendizaje

Origen y razones: `docs/DIVERSION.md`. Reglas de siempre: `CLAUDE.md` y `docs/NORTE.md`.
Carpetas: `src/components/`, `src/state/`, `src/i18n/`, `src/styles/`; el motor (`src/sim`) solo
recibe funciones puras nuevas con su test. Cada tarea termina con `npm test && npm run check && npm run build`
y una mirada en el navegador (escritorio y 360 px de ancho).

**Sustituyen a tareas antiguas:** F-02 amplía C-03 · F-04 es C-04 · F-05 es C-05 y parte de C-09 · C-02 quedó hecha con el HUD.
**Orden:** F-02 → F-03 → F-04 → F-05 → F-07 → F-06 → F-08.

---

## F-01 · HUD de 5 zonas y maqueta que se toca — HECHA

`src/components/Hud.tsx`, `src/scene/world.ts`, `base.ts`, `Scene.tsx`. La cámara orbita sola
(arrastrar gira, rueda acerca); tocar un módulo abre la tablet con su slider enfocado; la luz ámbar
de cada módulo sigue al plan en vivo; avería = rojo que late lento; refugio = ámbar; el rover sale y vuelve.
**Pendiente de comprobar a mano:** aspecto en celular vertical y que la luz se vea cambiar mientras se arrastra el slider.

## F-02 · Veredicto en una línea y un slider con chips (4 h)

**Problema:** 4 sliders, 4 textos de efecto y 4 números de vista previa a la vez; "+2,1 / −0,4" no dice si sobrevives.

1. **Veredicto** (`src/components/Verdict.tsx`): una línea grande encima de "Ejecutar día", con ícono + palabra, calculada con `previewDay` (store `preview`):
   - `Crítico`: el plan deja soporte vital o comida en ≤ 10, o hay apagón.
   - `Justo`: alguno baja y queda ≤ 25.
   - `Seguro`: el resto.
   - Texto: "Mañana: soporte vital 78 · comida 71 · batería 54 — Seguro". Los valores son los finales (actual + delta), no los deltas.
   - Los 4 deltas actuales pasan a un `<details>` "Ver detalles".
2. **Chips de módulo:** fila de 4 botones (ícono, nombre corto, valor asignado). El chip activo es `focusModule` del store; al tocar un módulo en la maqueta ya cambia solo. Debajo, **un único** `EnergySlider` grande (el del chip activo). En escritorio ≥ 1280 px se pueden mostrar los 4 como hoy.
3. Quitar los presets "Modo ahorro" y "Todo a cero"; queda "Repetir plan de ayer".
4. Barra de presupuesto: una frase ("Quedan 7 de 30 · 5 van a la batería") + la barra; sin leyenda de 3 claves. El aviso de desperdicio solo si es > 0.

**Hecho cuando:** en 360 px se ve a la vez la maqueta, el slider activo, el veredicto y "Ejecutar día" sin hacer scroll; el veredicto cambia de palabra al mover el slider.

## F-03 · Predecir antes de ejecutar y causa en una frase (4 h)

**Idea:** el niño predice, el juego responde, y una frase dice por qué. Es donde ocurre el aprendizaje.

1. **Marcador de la noche** (función pura nueva en `src/sim`, con test): `nightReadiness(state, cfg)` → energía que la base necesita para pasar las noches que quedan (consumo base de cada día de noche menos el sol previsto, más el coste de mantener el reciclador al mínimo que evita llegar a 0) frente a la batería actual. Devuelve `{ needed, have, ready: boolean }`. En el HUD, bajo "Noche lunar en N días": "Batería para la noche: 60 de 95".
2. **Pregunta** solo en días clave (día anterior a la noche y días de noche; máximo una por día): al pulsar "Ejecutar día" aparece "¿Tu batería llega al amanecer?" con dos botones (Sí / No). No bloquea más de un toque.
3. **Respuesta** en el resumen del día (`Outcome`): "Acertaste" o "Esta vez no" + la causa en una frase generada desde el estado: p. ej. "La batería llegó a 0 el día 14: el reciclador gastó más de lo que quedaba." Nunca culpar ("fallaste").
4. **Un titular por día:** el resumen muestra UNA línea (la entrada más importante de `log` de ese día: prioridad warning > event > decision > info), no una tabla.
5. Guardar aciertos en el estado de la interfaz (no en el motor) para el debrief: "Acertaste 4 de 6 predicciones".

**Hecho cuando:** hay test de `nightReadiness`; la pregunta aparece solo en días clave; el resumen de cada día es una frase.

## F-04 · Tormenta solar con tensión justa (3 h) — reemplaza el `EventPanel` provisional

1. Textos humanos por tipo de evento (`event.<kind>.title`, `.text`, `.option.<id>`) en ES y EN; nada de ids internos. Variables: nivel, módulo, fecha.
2. Cada botón grande muestra su consecuencia antes de elegir. Tormenta: "Refugiarse — dosis +{X} mSv · invernadero y taller no producen hoy" / "Seguir trabajando — dosis +{Y} mSv" (`getStormDose`). Avería y hielo: coste de 10 de energía en el taller; opción deshabilitada con su razón (`disabledReason`).
3. **Barra de 30 s** que se vacía (solo tormenta). Opción segura con etiqueta "Recomendada". Al llegar a 0 se elige la segura y la bitácora lo dice sin reproche. Botón "Sin tiempo" que la detiene. Sin barra con `prefers-reduced-motion`.
4. Línea de fuente con `payload.origin` (claves `storm.origin.*`, ya existen): "Basada en un evento real del {fecha}, registrado por NASA DONKI".
5. Teclas `1` y `2`; tras elegir, botones bloqueados y una línea de resultado; a los 1,2 s vuelve el planificador.
6. La maqueta ya se tiñe con la tormenta (`setStorm`). Añadir alarma de dos tonos (Web Audio, una vez, respetando el ajuste de sonido) solo si sobra tiempo.

**Hecho cuando:** los 4 eventos se resuelven con mouse, teclado y toque; la barra nunca castiga; doble toque aplica una vez.

## F-05 · Debrief de una frase y "volver al día N" (3 h)

1. **Store:** guardar el `GameState` del inicio de cada día (`dayStates: GameState[]`, en memoria). Acción `rewindTo(day)` que restaura ese estado y limpia el plan.
2. **Debrief** (`src/components/Debrief.tsx`, reemplaza el provisional de `App.tsx`): título, estrellas en SVG, causa principal en una frase amable (`debrief.cause.*`), el día en que "se decidió" (primer día en que el recurso perdedor bajó de 25, calculado desde `history`), y botón primario **"Volver al día N"** (2 días antes de ese día, mínimo 1). Secundarios: "Jugar de nuevo", "Menú".
3. Tarjeta "Así lo resuelve una misión real" elegida por la causa, desde `public/data/facts.json` (tarea D-02; mientras no exista, omitir la tarjeta, no inventar el texto).
4. Derrota: "La misión fue abortada. La tripulación regresó a la Tierra en la nave de emergencia."

**Hecho cuando:** tras perder, un toque devuelve a un día jugable con la causa visible; test del store para `rewindTo`.

## F-07 · Demo de 3 minutos (3 h)

1. Menú con dos entradas: **"Misión completa"** y **"Demo de 3 minutos"**; Cadete por defecto, Comandante como opción secundaria.
2. La demo empieza en el día 9. El estado inicial NO se escribe a mano: se obtiene jugando los días 1–8 con la estrategia `prudent` de `src/sim/strategies.ts` (función pura `demoStart(seed, cfg)` con test) para que sea coherente con el motor.
3. La demo termina tras el día 18 (amanecer) con un mini-debrief y la invitación a jugar la misión completa.

**Hecho cuando:** un jugador nuevo vive aviso de noche, noche y amanecer en ~3 minutos.

## F-06 · Módulos que se desbloquean (1–2 h)

Días 1–3: solo reciclador e invernadero. Día 4: blindaje (con una línea de radio que lo presenta). Día 6 o el día de la avería, lo que ocurra antes: taller. Es una regla de interfaz: los chips bloqueados no se pueden usar y dicen "Se activa el día N"; en la maqueta esos módulos se ven apagados. Los días de desbloqueo van en `balance.json` (`unlockDay` por módulo), no en el código. No aplica a la demo.
**Cuidado:** comprobar con `npm run simulate` (añadiendo la restricción a la estrategia prudente) que no rompe el balance.

## F-08 · Voz de Control de Misión (1–2 h)

Una línea de radio en el feed del HUD en los momentos clave (día 1, aviso de noche, primera noche, amanecer, cada evento). Frases cortas, cálidas, que repiten la causa. Decisión pendiente del equipo: una voz o dos personajes con nombre (ingeniería y salud). Todos los textos en i18n.
