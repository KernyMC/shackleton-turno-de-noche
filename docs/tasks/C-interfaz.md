# Área C — Interfaz y estado

Carpetas: `src/state/`, `src/components/`, `src/i18n/`, `src/styles/`, `src/app/`.
Leer antes: `docs/specs/01-motor-simulacion.md` (API del motor), `docs/specs/03-interfaz-y-estado.md`,
`docs/ARTE.md` §3 y §8. Pantallas en detalle: `docs/specs/00-documento-original.md` §7–12.

**Reglas de toda tarea de esta área**
- Ningún texto en componentes: todo con `t('clave')`; cada clave nueva va en `es.json` **y** `en.json`.
- Los componentes no calculan reglas: leen signals y llaman acciones del store.
- Colores solo por variables CSS de `src/styles/global.css`. Nada de degradados, sombras difusas ni emojis como íconos (ARTE §10).
- Verificar: `npm test && npm run check && npm run build`, y mirar el resultado en `npm run dev` en Chrome.
- Hoy `App.tsx` contiene `Menu`, `Hud` y `Tablet` provisionales: cada tarea mueve el suyo a `src/components/` y borra el provisional.

**Orden:** C-01 → (C-02, C-03, C-06 en paralelo) → C-04 → C-05 → el resto.

---

## C-01 · Store y bucle del día (P0) — **HECHA**

Implementado en `src/state/store.ts` con tests. Ver el estado real en `docs/specs/03-interfaz-y-estado.md`.
`App.tsx` tiene una tablet y un debrief **provisionales** (marcados así en el código) que usan el
store: con ellos ya se juega una partida entera. C-03, C-04 y C-05 los reemplazan.
Lo que sigue es la especificación original, como referencia.

### Especificación original

**Archivo:** `src/state/store.ts` (existe una versión mínima; ampliarla sin romper lo que ya exporta).

**Signals nuevos**
```ts
plan: Signal<Plan>                  // plan en edición; empieza en EMPTY_PLAN cada día
resolving: Signal<boolean>          // true durante la animación del día
lastOutcome: Signal<{ day: number; preview: DayPreview } | null>  // para el resumen del día
nearTarget: Signal<TargetId | null> // sustituye a nearModule; TargetId = ModuleId | 'shelter' | 'rover'
budget: computed(() => game.value ? getEnergyBudget(game.value) : null)
preview: computed(() => game.value?.phase === 'planning' ? previewDay(game.value, plan.value) : null)
```
`screen` pasa a ser `'menu' | 'game' | 'debrief'`.

**Acciones**
- `setPlanValue(id, value)`: redondea a entero, limita a `0..maxEnergy` del módulo y a lo que queda de `budget.available` (suma de los otros tres). Si el módulo está roto, ignora. Nunca deja un plan inválido. Devuelve `true` si tuvo que recortar (la interfaz muestra `plan.error.over_budget`).
- `applyPreset('repeat' | 'saving' | 'zero')`: `zero` → `EMPTY_PLAN`; `saving` → solo reciclador al máximo posible; `repeat` → `game.lastPlan` ajustado con `allocate` de `src/sim/strategies.ts` en el orden reciclador → blindaje → invernadero → taller si ya no alcanza. Devuelve `true` si hubo ajuste.
- `executeDay()`: si `resolving` o `phase !== 'planning'`, no hace nada. Guarda `lastOutcome`, pone `resolving = true`, llama `runDay`, y tras 1500 ms (0 con movimiento reducido) asigna el nuevo estado y `resolving = false`. Si el nuevo estado es `ended` → `screen = 'debrief'`. Al empezar el día siguiente: `plan = EMPTY_PLAN`, y si `repairToday` o `roverSendToday` están activos, prefijar taller en 10.
- `chooseEventOption(id)`: llama `resolveEvent`; protegido contra doble llamada (si `phase !== 'event'`, nada). Tras `repair` o `send`, prefija `plan.workshop = 10`.
- `requestRepair(id)`: `setRepairToday` + prefija taller en 10.
- `interact(target)`: por ahora, abre la tablet. B-05 le añadirá el significado según el evento pendiente.
- `restart()`: nueva partida, misma dificultad, semilla nueva.

Semilla: si la URL trae `?seed=123`, usarla.

**Hecho cuando:** desde la consola del navegador (exponer `window.__store` solo en `import.meta.env.DEV`) se juega una partida entera con `executeDay()` y `chooseEventOption()` hasta llegar a `screen === 'debrief'`; llamar `executeDay()` dos veces seguidas avanza un solo día.

---

## C-02 · Visor de casco (P0)

**Archivos:** `src/components/Visor.tsx`, `src/components/icons.tsx` (íconos SVG de trazo, `stroke="currentColor"`, grosor 1.5, 20×20: batería, soporte vital, hoja, radiación, sol, luna, alerta).

- Franja superior fina con 4 indicadores + "Día 7 / 30". Cada indicador: ícono, nombre, valor en monoespaciada, barra de 2 px de alto, tendencia (`▲ +3` / `▼ −5`, diferencia entre los dos últimos `history`).
- Estados (`§4.7`): soporte vital o comida ≤ 25 → texto "Bajo" + ícono de alerta en `--warn`; ≤ 10 → "Crítico" en `--danger`. Dosis ≥ 70 % → "Precaución"; ≥ 90 % → "Peligro". Batería: `actual / capacidad`; si `getLight` de hoy < 0,1 añade "Sin sol".
- Cada barra: `role="progressbar"` con `aria-valuenow/min/max` y `aria-label`.
- Valores animados con transición CSS de `width` (300 ms); desactivada con `prefers-reduced-motion`.
- Claves i18n nuevas: `hud.status.low`, `hud.status.critical`, `hud.status.caution`, `hud.status.danger`, `hud.no_sun`.

**Hecho cuando:** a 320 px de ancho los 4 indicadores caben sin scroll horizontal (2 × 2), y los estados se distinguen sin color (texto + ícono).

---

## C-03 · Tablet: planificador (P0) — **HECHA**

Implementada en `src/components/Tablet.tsx`, `EnergySlider.tsx`, `icons.tsx` (íconos SVG reutilizables para C-02) y `format.ts`. `EventPanel.tsx` es **provisional** (lo reemplaza C-04). Atajos: `Tab` abre la tablet; dentro, `Tab` mueve el foco (atrapado) y `Esc` la cierra; Enter ejecuta el día si el foco no está en un botón o slider. El efecto previsto de cada slider se calcula en la interfaz solo para mostrar; los números de la vista previa vienen de `previewDay`.

### Especificación original

**Archivos:** `src/components/Tablet.tsx`, `src/components/EnergySlider.tsx`.

Contenido, de arriba abajo:
1. **Encabezado:** "Energía disponible hoy: X" y debajo, siempre visible, el desglose `hud.breakdown` (batería + sol − base).
2. **Cuatro sliders** (`<input type="range" min=0 max=maxEnergy step=1>`), cada uno con ícono, nombre, `asignado / máximo` y efecto previsto calculado del lado de la interfaz **solo para mostrar** a partir de `balance.effects` (p. ej. "+11 soporte vital"). Al cambiar llaman `setPlanValue`; si devuelve `true`, mostrar "No hay más energía disponible" 2 s.
   - Roto: deshabilitado, etiqueta "Averiado" y botón "Reparar (taller ≥ 10)" → `requestRepair(id)`. Si ya está pedida: "Reparación programada".
   - Si `shelterToday`: invernadero y taller muestran "La tripulación está en el refugio" y efecto 0.
   - Teclado: flechas ±1 (nativo); Shift + flechas ±5; Home/End. `aria-valuetext` = "12 de 30, +5,6 soporte vital".
3. **Barra de presupuesto:** segmentos asignado / a batería. Si `preview.wasted > 0`: "Se desperdiciarán N (batería llena)" en ámbar.
4. **Vista previa:** una línea desde `preview`: "Soporte vital +2 · Comida +3 · Dosis +0,6 · Batería → 38".
5. **Presets:** "Repetir plan de ayer" (oculto si no hay `lastPlan`), "Modo ahorro", "Todo a cero".
6. **"Ejecutar día":** botón grande ámbar; deshabilitado con `resolving`. Atajo Enter cuando el foco no está en un slider ni en otro botón.
7. Si `repairToday`/`roverSendToday` y `plan.workshop < 10`: aviso "El taller necesita 10 de energía o no se podrá reparar / enviar el rover".
8. Si `budget.available === 0`: sliders deshabilitados y "Sin energía hoy: los sistemas funcionan en mínimo"; el botón sigue activo.

Contenedor: `role="dialog"`, `aria-modal`, foco al título al abrir, foco atrapado, Esc cierra (salvo con evento pendiente). Escritorio: panel inferior de máx. 720 px. Bajo 1024 px: pantalla completa con scroll interno. Zonas táctiles ≥ 44 px.

**Hecho cuando:** se planifica y ejecuta un día solo con teclado; a 320 px no hay scroll horizontal; es imposible construir un plan que `validatePlan` rechace.

---

## C-04 · Panel de evento (P0)

**Archivo:** `src/components/EventPanel.tsx`. Se muestra dentro de la tablet cuando `game.phase === 'event'`, en lugar del planificador, y **abre la tablet automáticamente**.

- Título y texto por tipo: claves `event.<kind>.title` y `event.<kind>.text` (crear para `storm`, `breakdown`, `ice`, `night_warning`; textos en `00-documento-original.md` §6.2). Variables: `{nivel}`, `{modulo}`.
- Un botón por `pendingEvent.options`: etiqueta `event.<kind>.option.<id>` y debajo su consecuencia. Tormenta: "Dosis estimada: +X mSv" con `getStormDose(level, id === 'shelter')`; en `shelter` añadir "Invernadero y taller no producen hoy".
- Opción con `disabledReason`: botón deshabilitado y la razón visible debajo (`t(disabledReason)`).
- Teclas `1` y `2` eligen; al elegir, todos los botones se deshabilitan y aparece una línea de resultado (la última entrada de `game.log`); a los 1200 ms vuelve al planificador.
- No se cierra con Esc ni con clic fuera.
- Tormentas: etiqueta de fuente según `payload.origin`: `sample` → "Tormenta de ejemplo (simulada)"; `real` o `live` → "Basada en un evento real del {fecha}, registrado por NASA DONKI" (claves `storm.origin.*` ya existen; el panel provisional ya lo muestra).

**Hecho cuando:** los 4 tipos de evento se resuelven con mouse y con teclado; doble clic aplica la opción una sola vez.

---

## C-05 · Resumen del día y debrief básico (P0)

**Archivos:** `src/components/Outcome.tsx`, `src/components/Debrief.tsx`.

- **Outcome:** tarjeta pequeña arriba al centro durante `resolving` y 2 s después: "Día N completado" + los 3 cambios de mayor valor absoluto de `lastOutcome.preview`. Clic la cierra. `role="status"`.
- **Debrief** (`screen === 'debrief'`): título "Misión cumplida" + estrellas (SVG, no emoji) o "Misión abortada en el día X"; frase de causa principal sin culpar (claves `debrief.cause.radiation|life_support|food`, p. ej. "La noche fue más larga que la batería"); causas secundarias en lista; texto fijo de derrota: "La misión fue abortada. La tripulación regresó a la Tierra en la nave de emergencia."; botones "Jugar de nuevo" (`restart`), "Menú". Si ganó en Cadete: sugerir Comandante.

**Hecho cuando:** se ve el debrief correcto tras ganar y tras perder por cada causa (usar `?seed=` y planes extremos).

---

## C-06 · Menú y dificultad (P0)

**Archivos:** `src/components/Menu.tsx`, `src/components/DifficultySelect.tsx`.
Menú: título grande, subtítulo, "Nueva partida", selector ES/EN, pie de no afiliación. Dificultad: dos tarjetas con 3 diferencias en lenguaje simple leídas de `balance.json` (batería, tormentas, noche), Cadete marcada "Recomendado para empezar". Sin 3D de fondo por ahora.

---

## C-07 · Pronóstico de luz (P1)
`src/components/ForecastStrip.tsx`: bajo el visor, hoy + 4 días siguientes (los que queden). Ícono sol/luna + porcentaje de `getLight`. Noche (`light.nightDays`) con fondo `--void` y ícono de luna. Texto accesible "Día 12: noche, 3 % de luz".

## C-08 · Ficha "¿De dónde sale este número?" (P1)
**Depende de D-02.** `src/components/SourceSheet.tsx`: botón ⓘ (SVG) en cada indicador del visor → panel lateral (hoja inferior en celular) con nombre, valor, explicación de 1–2 frases, fuente, enlace en pestaña nueva y etiqueta de estado con ícono + texto: "Dato verificado" / "Dato simulado (temporal)" / "Decisión de diseño del juego". Lee `public/data/sources.json`. Cierra con Esc, ✕ o clic fuera.

## C-09 · Debrief completo (P1)
**Depende de C-05, D-02.** Añadir a `Debrief.tsx`:
- **Gráfica SVG a mano** (sin librerías) de `history`: 4 líneas (batería como % de capacidad, soporte vital, comida, dosis como % del límite), cada una con color **y** patrón de trazo distinto (`stroke-dasharray`), leyenda con texto; franja sombreada en `nightDays`; marca sobre el eje en los días con tormenta; botón "Ver datos en tabla" que muestra una `<table>` equivalente.
- **Línea de tiempo de decisiones:** entradas de `log` con `type === 'decision'`.
- **"Así lo resuelve una misión real":** 2–3 tarjetas de `facts.json` elegidas por causa de derrota y eventos vividos.
- **Copiar resultado:** `navigator.clipboard.writeText` dentro de try/catch.

## C-10 · Guardado, ajustes, pausa e inglés (P1)
- `src/state/persist.ts`: guardar `game` en `localStorage` clave `halosur:save:v1` tras cada `runDay` y `resolveEvent`; todo en try/catch; al cargar validar `version === 1` y forma básica, si falla descartar con `console.warn`. "Continuar" en el menú solo si hay partida válida; restaura también un evento pendiente.
- Ajustes (idioma, sonido, volumen, calidad, movimiento reducido) en clave aparte `halosur:settings:v1`.
- Pausa con Esc fuera de la tablet: Continuar, Reiniciar (con confirmación), Salir al menú (con confirmación).
- Repasar todo el juego en inglés: ningún texto cortado ni fuera de su botón.

## C-11 · Tutorial, bitácora, créditos y debug (P2)
- `LogPanel.tsx`: `state.log` en orden inverso agrupado por día, ícono por tipo, `aria-live="polite"`.
- Tutorial días 1–3 (`§8.4`), siempre con "Saltar tutorial".
- `Credits.tsx` desde `sources.json` y `CREDITS.md`.
- `?debug=1`: panel con estado JSON, semilla, eventos programados, saltar al día N, exportar partida.
