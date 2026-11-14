# PROMPT — Construir "Shackleton: Turno de Noche" completo con datos simulados

> **Para Claude Code.** Construye el juego completo descrito aquí, de principio a fin, usando **solo datos simulados locales**. **No llames a ninguna API externa** (ni NASA, ni DONKI, ni ninguna otra). Todo vive en archivos JSON del proyecto, marcados como simulados, para reemplazarlos después por datos reales sin tocar el código.
>
> Trabaja de forma autónoma, fase por fase (sección 19). Al terminar cada fase: corre los tests, corre el build, corrige errores y haz commit. No me hagas preguntas: si algo no está definido, toma la decisión más simple que respete este documento y anótala en `DECISIONES.md`.

---

## 1. Visión

**Juego:** *Shackleton: Turno de Noche*
**Equipo:** Halo Sur (NASA Space Apps Challenge 2026, sede Sangolquí, Ecuador)
**Reto:** Build a Junior Astronaut Mission Trainer — un juego donde estudiantes manejan una base lunar o marciana equilibrando soporte vital, blindaje contra radiación, energía y producción de comida, y viven en carne propia las decisiones que hacen que una misión fracase o tenga éxito.

**Fantasía del jugador:** "Soy la comandante de la primera base humana en el polo sur de la Luna. Cuatro personas dependen de mis decisiones."

**Público:** estudiantes de 7 a 12 años (corregido según el texto oficial del reto; antes ponía 10 a 15), en español e inglés. También lo van a jugar jueces adultos durante 2–3 minutos: el juego tiene que enganchar en los primeros 30 segundos.

**Duración de una partida:** 6–8 minutos (30 días de juego, unos 12–15 segundos por día).

**Pilares de diseño (en orden de prioridad):**
1. **Decisiones con consecuencias claras.** Cada decisión produce un resultado visible y explicable.
2. **Aprender jugando.** Al terminar, el jugador sabe *por qué* ganó o perdió y cómo lo resuelve una misión real.
3. **Honestidad con los datos.** Cada número muestra de dónde viene. Si es simulado o de diseño, lo dice.
4. **Accesible y amable.** Lenguaje claro, nada de muerte explícita, jugable en celular, teclado y mouse.

---

## 2. Stack técnico (obligatorio)

- **Astro** (sitio estático) + **Preact** + **@preact/signals** para toda la interfaz.
- **Three.js** para la escena 3D, dentro de una isla Preact con `client:only="preact"`.
- **TypeScript** estricto.
- **Vitest** para el motor de simulación.
- **Sin backend, sin APIs, sin base de datos.** Deploy estático (Cloudflare Pages o Vercel).
- Sin librerías de UI pesadas. CSS propio con variables (custom properties).
- Sonido: generado con **Web Audio API** (osciladores), sin archivos de audio.
- Gráficas del debrief: **SVG hecho a mano**, sin librerías de gráficos.

### Estructura de carpetas
```
/src
  /pages/index.astro
  /app/App.tsx                 → máquina de estados de pantallas
  /components/                 → HUD, Planner, EnergyBudget, ForecastStrip, LogPanel,
                                 EventModal, CrewPanel, SourceSheet, Debrief, Tutorial,
                                 Menu, Settings, Credits, Toast, ConfirmDialog
  /scene/                      → Scene.tsx, terrain.ts, base.ts, sky.ts, effects.ts,
                                 quality.ts, fallback2d.tsx
  /sim/                        → MOTOR PURO (sin DOM, sin Three, sin Preact)
     types.ts
     rng.ts                    → PRNG con semilla (mulberry32)
     config.ts                 → carga y valida los JSON de datos
     engine.ts                 → createGame, getEnergyBudget, validatePlan, runDay, resolveEvent
     events.ts                 → catálogo y programación de eventos
     scoring.ts                → estrellas, insignias, causa de derrota
     *.test.ts
  /state/store.ts              → signals globales + persistencia
  /i18n/es.json, en.json, index.ts
  /audio/sfx.ts
  /styles/tokens.css, global.css
/public/data/
  balance.json                 → todos los números del juego
  light_sequence.json          → luz de los 30 días
  events.json                  → textos y efectos de eventos
  storms_sample.json           → tormentas solares de EJEMPLO (simuladas)
  sources.json                 → fichas del panel "¿De dónde sale este número?"
  facts.json                   → datos curiosos (con fuente)
DECISIONES.md
AI_USAGE.md
CREDITS.md
README.md
```

### Regla de oro
**Toda la lógica del juego está en `/src/sim` como funciones puras y deterministas.** Con la misma semilla, el mismo plan y las mismas decisiones, el resultado es idéntico. La UI solo lee estado y envía acciones. La escena 3D solo refleja estado. Ningún número de balance va hardcodeado: todo sale de `/public/data`.

---

## 3. Datos simulados — reglas

- Todos los archivos de `/public/data` tienen en la raíz: `"simulated": true` y `"version": 1`.
- Cada valor numérico que se muestre al jugador tiene `source_id` y `status`:
  - `"simulated"` → valor inventado para probar el juego. Se mostrará como **"Dato simulado (temporal)"**.
  - `"game_balance"` → decisión de diseño. Se mostrará como **"Decisión de diseño del juego"**.
  - `"verified"` → dato real confirmado (todavía ninguno).
- **Las tormentas de ejemplo NO deben presentarse como eventos reales.** Sus fechas son ficticias y el texto dice "Tormenta de ejemplo (simulada)". Cuando se carguen datos reales, el mismo campo `status: "verified"` cambiará el texto a "Basada en un evento real del [fecha]".
- `config.ts` valida los JSON al cargar (tipos y rangos). Si un archivo falla, usa los valores por defecto embebidos en código y muestra un aviso discreto solo en modo debug.

---

## 4. Modelo de la simulación

### 4.1 Estado
```ts
type Difficulty = 'cadete' | 'comandante';
type ModuleId = 'recycler' | 'greenhouse' | 'shield' | 'workshop';

interface GameState {
  version: 1;
  seed: number;
  difficulty: Difficulty;
  day: number;                    // 1..30 (día que se está planificando)
  phase: 'planning' | 'event' | 'outcome' | 'ended';
  battery: number;                // 0..batteryCapacity (unidades de energía)
  lifeSupport: number;            // 0..100 (%)
  food: number;                   // 0..100 (%)
  dose: number;                   // mSv acumulados
  modules: Record<ModuleId, { broken: boolean; brokenSinceDay?: number }>;
  roverAvailable: boolean;
  shelterToday: boolean;          // decisión de tormenta activa
  pendingEvent: PendingEvent | null;
  scheduledEvents: ScheduledEvent[];
  history: DaySnapshot[];         // una entrada por día resuelto
  log: LogEntry[];
  lastPlan: Plan | null;
  result: null | { outcome: 'win' | 'loss'; causes: LossCause[]; day: number; stars: 0|1|2|3; badges: string[] };
}
```

### 4.2 Valores iniciales (`balance.json`, todos `simulated` o `game_balance`)

| Parámetro | Cadete | Comandante |
|---|---|---|
| Tripulación | 4 | 4 |
| Capacidad de batería | 120 | 100 |
| Batería inicial | 90 | 70 |
| Soporte vital inicial | 85 | 75 |
| Comida inicial | 70 | 60 |
| Producción solar máxima por día (luz 100%) | 70 | 60 |
| Consumo base de la base por día (calefacción, computadoras) | 8 | 10 |
| Límite de dosis de la misión (mSv) | 120 | 100 |
| Dosis base diaria sin blindaje (mSv) | 1.2 | 1.4 |
| Probabilidad de evento menor aleatorio por día | 0.20 | 0.30 |

### 4.3 Módulos (energía máxima que aceptan por día)
| Módulo | Máx. energía | Efecto con eficiencia `e = asignado / máx` |
|---|---|---|
| ♻️ Reciclador (O₂ + agua) | 30 | Soporte vital `+14 × e` |
| 🌱 Invernadero | 25 | Comida `+9 × e`; consume soporte vital (agua) `2 × e` |
| 🛡️ Blindaje | 20 | Reduce la dosis base del día en `60% × e` |
| 🔧 Taller | 15 | Permite reparar (necesita ≥ 10) y preparar el rover (necesita ≥ 10) |

Un módulo **averiado** tiene eficiencia 0 y su slider se bloquea.

### 4.4 Consumo de la tripulación (por día)
- Soporte vital: `2.5 × tripulación` = 10.
- Comida: `1.5 × tripulación` = 6.

Con reciclador al 100% e invernadero al 100%: soporte vital `+14 − 10 − 2 = +2`; comida `+9 − 6 = +3`. El margen es pequeño a propósito.

### 4.5 Energía de cada día (orden exacto)
1. `solar = solarMax × luz[día]` (luz de 0 a 1).
2. `disponible = batería + solar − consumoBase`. Si es menor que 0, queda en 0 y se registra **"apagón parcial"**: el soporte vital baja 3 extra ese día.
3. El jugador reparte energía entre los módulos. Regla: `suma(plan) ≤ disponible`.
4. `batería = min(capacidad, disponible − suma(plan))`.
5. Si `disponible − suma(plan) > capacidad`, el sobrante es **energía desperdiciada** y se muestra en la UI (enseña que la batería tiene límite).

### 4.6 Resolución del día (`runDay`), orden exacto
1. Validar el plan. Si es inválido, lanzar error (la UI nunca debe permitir uno inválido).
2. Calcular energía (4.5).
3. Si `shelterToday`: invernadero y taller producen 0 aunque tengan energía asignada (la tripulación está en el refugio). El reciclador funciona normal (es automático).
4. Producción de módulos.
5. Consumo de la tripulación.
6. Dosis del día: `base × (1 − 0.6 × eBlindaje)` + dosis de tormenta (si hay) `× (shelterToday ? 0.15 : 1)`.
7. Efectos pendientes de eventos (por ejemplo, agua del rover que llega hoy).
8. Limitar recursos: soporte vital y comida entre 0 y 100.
9. Guardar `DaySnapshot` en el historial y generar las entradas de la bitácora.
10. Comprobar derrota (4.8). Si no hay derrota y `día == 30`, victoria.
11. Si la partida sigue: `día += 1`, `shelterToday = false`, y revisar si hay un evento programado para el nuevo día o sortear uno aleatorio (sección 6). Si hay evento → `phase = 'event'`.

### 4.7 Advertencias (no son derrota)
- Soporte vital o comida ≤ 25 → estado **"Bajo"** (amarillo + ícono ⚠ + texto).
- ≤ 10 → **"Crítico"** (rojo + ícono ⛔ + pulso + sonido).
- Dosis ≥ 70% del límite → **"Precaución"**; ≥ 90% → **"Peligro"**.
- Batería ≤ 15% de la capacidad con la noche dentro del pronóstico → aviso **"La noche se acerca y tu batería está baja"**.

### 4.8 Derrota
Se evalúa al **final** de cada día, nunca a mitad.
- Soporte vital = 0 → causa `life_support`.
- Comida = 0 → causa `food`.
- Dosis ≥ límite → causa `radiation`.

Si hay varias causas el mismo día, se guardan **todas**, y la principal se elige por prioridad: `radiation > life_support > food`.

**Lenguaje para niños:** nunca hablar de muerte. La derrota es: *"La misión fue abortada. La tripulación regresó a la Tierra en la nave de emergencia."*

### 4.9 Victoria y puntuación
- Victoria: terminar el día 30 sin derrota (si el día 30 termina con derrota, es derrota).
- **Estrellas** según el **margen mínimo** de la partida (el valor más bajo que tuvo cualquier recurso, contando la dosis como `100 − % del límite`):
  - ⭐ ganar.
  - ⭐⭐ ganar con margen mínimo ≥ 15.
  - ⭐⭐⭐ ganar con margen mínimo ≥ 30.
- **Insignias** (máximo 3 en pantalla):
  - 🌑 *Guardiana de la Noche*: atravesar la noche lunar sin apagón parcial.
  - ☀️ *Escudo Solar*: refugiarse en todas las tormentas.
  - 🧊 *Cazadora de Hielo*: completar la expedición del rover.
  - 🔧 *Mano Firme*: reparar una avería el mismo día.
  - ♻️ *Cero Desperdicio*: no desperdiciar energía en toda la partida.

---

## 5. Luz solar y pronóstico (`light_sequence.json`, `game_balance`)

Secuencia fija de 30 valores (0 a 1) que crea la historia de la partida:
```
Días  1–9:   0.85, 0.90, 0.80, 0.85, 0.75, 0.80, 0.85, 0.70, 0.60   (buen sol)
Días 10–11:  0.40, 0.20                                              (atardecer: AVISO)
Días 12–17:  0.03, 0.00, 0.00, 0.02, 0.00, 0.05                      (NOCHE LUNAR)
Días 18–20:  0.30, 0.55, 0.75                                        (amanecer)
Días 21–24:  0.85, 0.90, 0.85, 0.80                                  (buen sol)
Días 25–27:  0.45, 0.35, 0.40                                        (sombra parcial)
Días 28–30:  0.80, 0.85, 0.90                                        (buen sol)
```
- En modo **Cadete** se suma 0.05 a cada día de noche (máximo 0.10).
- **Pronóstico:** la UI siempre muestra los próximos 5 días (o los que queden). Los días de noche se marcan con 🌑 y fondo oscuro.
- La primera vez que la noche entra en el pronóstico aparece un **aviso narrativo** (sin decisión): *"Control de Misión: en 3 días el Sol se esconderá tras el borde del cráter. Carga tus baterías."*

**Comprobación de balance (escribe un test):** un plan que pone todo al reciclador y nada a la batería **debe perder** en Comandante entre los días 12 y 18. Un plan que guarda energía los días 8–11 y reduce módulos en la noche **debe poder ganar**.

---

## 6. Eventos

### 6.1 Programación
Al crear la partida, con la semilla, se programan los **eventos garantizados**, para que toda partida enseñe todo:

| Evento | Ventana de días | Cantidad |
|---|---|---|
| ☀️ Tormenta solar | 5–8, 18–21, 24–27 | 1 en cada ventana (3 en total). En Cadete, solo 2 (sin la tercera) |
| 🔧 Avería | 7–10 | 1 |
| 🧊 Hielo detectado | 20–23 | 1 |
| 🌑 Aviso de noche | cuando el día 12 entra al pronóstico (día 8 o 9) | 1 |

**Eventos menores aleatorios** (con la probabilidad diaria de 4.2), solo en días sin evento garantizado: 🌱 Cosecha extra, 📡 Mensaje de la Tierra, ⚙️ Micro-falla (solo Comandante), 🛰️ Paquete de suministros (solo Cadete).

**Reglas de programación (edge cases):**
- Nunca dos eventos el mismo día. Si chocan, el garantizado gana y el otro se mueve al siguiente día libre de su ventana; si no hay hueco, se descarta.
- Nunca un evento en el día 1 (el jugador primero aprende).
- La avería **nunca** cae sobre el reciclador durante la noche lunar en modo Cadete.
- No hay eventos menores en los días 29–30 (el final no debe sentirse injusto).
- La tormenta de la ventana 18–21 no puede caer el mismo día que el hielo.

### 6.2 Catálogo (`events.json`)

**☀️ Tormenta solar** (decisión obligatoria)
- Texto: *"¡Alerta! Una tormenta de partículas solares llegará en horas. Intensidad: {nivel}."*
- Intensidad tomada de `storms_sample.json` (nivel S1–S4 → dosis extra 8 / 15 / 25 / 35 mSv).
- Opción A — **"¡Todos al refugio!"**: `shelterToday = true`. Dosis de tormenta × 0.15. Invernadero y taller no producen hoy. Ícono 🛡️.
- Opción B — **"Seguir trabajando"**: producción normal, dosis de tormenta completa. Ícono ⚒️.
- Cada opción muestra su consecuencia **antes** de elegir: "Dosis estimada: +X mSv".
- Ficha de fuente: "Tormenta de ejemplo (simulada)".

**🔧 Avería** (decisión obligatoria)
- Se rompe un módulo elegido con la semilla, entre los que no están rotos, con las restricciones de 6.1.
- Opción A — **"Reparar hoy"**: solo se puede elegir si el plan de hoy puede asignar ≥ 10 al taller (comprobar contra la energía disponible). Si no se puede, la opción aparece **deshabilitada con la razón**: "Necesitas al menos 10 de energía para el taller". El módulo queda reparado **al final** de este día; hoy no produce.
- Opción B — **"Dejarlo para después"**: el módulo sigue roto. En días siguientes, el planificador muestra el botón **"Reparar (requiere taller ≥ 10)"** junto al módulo roto.
- Si un módulo pasa **5 días** roto, se manda un recordatorio en la bitácora.

**🧊 Hielo detectado** (decisión obligatoria)
- Opción A — **"Enviar el rover"**: requiere taller ≥ 10 hoy. Mañana llega `+25` de soporte vital. En Comandante, 10% de probabilidad de que el rover tarde un día más (llega pasado mañana, con aviso en la bitácora). No hay riesgo de perder el rover.
- Opción B — **"No arriesgar"**: no pasa nada.
- Si no se puede asignar ≥ 10 al taller, la opción A aparece deshabilitada con su razón.

**🌑 Aviso de noche** (sin decisión, solo un botón "Entendido")

**🌱 Cosecha extra:** +8 comida. **📡 Mensaje de la Tierra:** texto motivador con un dato curioso (de `facts.json`), sin efecto. **⚙️ Micro-falla:** −5 de batería. **🛰️ Suministros:** +10 comida y +10 soporte vital.

### 6.3 Comportamiento del modal de evento
- No se puede cerrar con Esc ni haciendo clic fuera si requiere decisión.
- El foco va al título del modal y se mantiene dentro del modal (focus trap).
- Las opciones se pueden elegir con teclas `1`, `2` y con Tab + Enter.
- Al elegir, el botón se deshabilita de inmediato (evita doble clic) y aparece un resumen de 1 línea del resultado.

---

## 7. Máquina de estados de la app

```
BOOT → (cargar datos y detectar WebGL)
  → MENU
      ├─ Nueva partida → SELECCIONAR_DIFICULTAD → (TUTORIAL si es la primera vez) → PLANNING
      ├─ Continuar (solo si hay partida guardada válida) → PLANNING o EVENT según la partida
      ├─ Ajustes → SETTINGS → MENU
      └─ Créditos → CREDITS → MENU
PLANNING → (Ejecutar día) → RESOLVING (animación, 1.5 s) → OUTCOME (resumen del día, 2 s o clic)
  → EVENT (si hay) → PLANNING
  → DEBRIEF (si la partida terminó)
DEBRIEF → Jugar de nuevo (misma dificultad, nueva semilla) | Menú
En cualquier momento de la partida: PAUSA (botón ⏸ o Esc fuera de un modal) → Continuar | Reiniciar (con confirmación) | Ajustes | Salir al menú (con confirmación)
```

---

## 8. Pantallas y UI/UX

### 8.1 Dirección visual
- Estética de **consola de control de misión sobria**, no neón de ciencia ficción.
- Paleta: negro y grises carbón, blanco hueso, y **un solo acento cálido ámbar** (la luz de la base). Estados: verde (bien), amarillo (bajo), rojo (crítico).
- **Nunca usar solo color** para comunicar estado: siempre ícono + texto o patrón.
- Tipografías: una sans-serif amplia para títulos (por ejemplo, Archivo o Space Grotesk) y una monoespaciada para números (IBM Plex Mono). Cargadas desde Google Fonts, con fuente del sistema como respaldo.
- Contraste mínimo WCAG AA.
- **Prohibido:** logos de NASA (meatball, worm, sello), banderas o insignias oficiales de misiones.

### 8.2 Menú principal
- Título grande, subtítulo "Un turno de 30 días en el polo sur de la Luna".
- Escena 3D de fondo girando lentamente.
- Botones: **Nueva partida**, **Continuar** (oculto si no hay partida guardada), **Ajustes**, **Créditos**.
- Selector de idioma ES/EN siempre visible.
- Pie: *"Proyecto independiente creado para NASA Space Apps Challenge 2026. No afiliado ni avalado por NASA."*

### 8.3 Selección de dificultad
- **Cadete** (recomendado para empezar): más batería, menos tormentas, noche menos oscura.
- **Comandante**: el reto completo.
- Cada tarjeta muestra 3 diferencias en lenguaje simple.

### 8.4 Tutorial
- Guiado dentro de la partida, en los días 1–3 de la primera partida (o si el jugador lo pide en Ajustes).
- Día 1: resaltar las barras → resaltar los sliders → resaltar "Ejecutar día". Máximo 1 frase por paso.
- Día 2: resaltar el pronóstico de luz.
- Día 3: resaltar el ícono ⓘ de "¿De dónde sale este número?".
- Botón "Saltar tutorial" siempre visible. El progreso se guarda (si el almacenamiento está disponible).
- El tutorial nunca bloquea el juego: si el jugador hace otra cosa, el paso avanza o se descarta.

### 8.5 Pantalla de juego (layout)
**Escritorio (≥ 1024 px):**
- Fondo: escena 3D a pantalla completa.
- Arriba: **HUD** con 4 indicadores (Energía/batería, Soporte vital, Comida, Dosis) + día "Día 7 / 30" + botón ⏸.
- Debajo del HUD: **franja de pronóstico** de 5 días con ícono de luz y porcentaje.
- Abajo: **panel del planificador** (4 sliders + presupuesto de energía + botón "Ejecutar día").
- Derecha (plegable): **bitácora** y **tripulación** (4 retratos ilustrados simples con estado: 🙂 bien, 😐 cansada, 😟 preocupada según los recursos).

**Tablet y celular (< 1024 px):**
- La escena 3D ocupa la parte superior (aprox. 40% de la altura).
- HUD compacto encima de la escena.
- Panel del planificador abajo, fijo, con sliders grandes (zona táctil ≥ 44 px).
- Bitácora y tripulación en una pestaña o hoja deslizable.
- En celular horizontal muy bajo (< 420 px de alto): mostrar el aviso "Gira tu dispositivo o amplía la ventana para una mejor experiencia", pero permitir seguir.

### 8.6 HUD — cada indicador
- Ícono + nombre + valor numérico + barra + tendencia del último día (▲ +3 / ▼ −5).
- Estado textual cuando aplica ("Bajo", "Crítico").
- Ícono ⓘ que abre la ficha de fuente (8.9).
- Energía muestra: batería actual / capacidad, y en la noche un pequeño texto "Sin sol".
- Dosis muestra: acumulada / límite, en mSv.
- Animación suave al cambiar los valores (desactivada con reduced motion).

### 8.7 Planificador de energía (la interacción central)
- Encabezado: **"Energía disponible hoy: X"** = batería + solar de hoy − consumo base, con un desglose al pasar el mouse o tocar: "Batería 54 + Sol 51 − Base 10".
- Un slider por módulo, de 0 a su máximo, en pasos de 1. Muestra: nombre, ícono, energía asignada / máximo, y **efecto previsto** ("+11 soporte vital").
- **Barra de presupuesto:** cuánta energía se asignó y cuánta irá a la batería. Si va a haber desperdicio, se muestra en ámbar: "Se desperdiciarán 6 (batería llena)".
- **Regla de límite:** si al mover un slider la suma supera lo disponible, ese slider se **detiene** en el máximo posible (los demás no se mueven solos). Un pequeño aviso explica: "No hay más energía disponible".
- **Vista previa del día:** debajo de los sliders, una línea con los cambios previstos: "Soporte vital +2 · Comida +3 · Dosis +0.6 · Batería → 38". Se recalcula en vivo (el motor expone una función `previewDay(state, plan)` pura).
- **Botones rápidos:**
  - "Repetir plan de ayer" (si existe y sigue siendo válido; si no, se ajusta al máximo posible y se avisa).
  - "Modo ahorro": reciclador al 100% y todo lo demás en 0.
  - "Todo a cero".
- Módulo roto: slider bloqueado, con etiqueta "Averiado" y botón "Reparar" si corresponde.
- Si hay refugio hoy: el invernadero y el taller muestran "La tripulación está en el refugio" y su efecto previsto es 0 (pero el jugador puede asignar energía igualmente; se avisa que se perderá).
- Si `disponible = 0`: todos los sliders deshabilitados, mensaje "Sin energía hoy: los sistemas funcionan en mínimo", y el botón Ejecutar día sigue activo.
- **"Ejecutar día"**: botón grande. Se deshabilita mientras se resuelve el día (evitar doble clic y teclas repetidas). Atajo: Enter (cuando el foco no está en un campo de texto).
- Teclado: Tab entre sliders; flechas ±1; Shift + flechas ±5; Home/End al mínimo/máximo.

### 8.8 Resumen del día (OUTCOME)
- Toast o tarjeta breve: "Día 7 completado" con los 3 cambios más importantes y una línea narrativa ("El invernadero dio su primera cosecha de lechugas 🥬").
- Se cierra solo a los 2 s o con clic. Con reduced motion, aparece sin animación.

### 8.9 Ficha "¿De dónde sale este número?"
- Panel lateral (escritorio) u hoja inferior (celular).
- Contenido: nombre del valor, valor y unidad, explicación sencilla de 1–2 frases, fuente y etiqueta de estado:
  - 🟡 "Dato simulado (temporal)"
  - 🔵 "Decisión de diseño del juego"
  - 🟢 "Dato verificado" (cuando lo haya)
- Enlace a la fuente si existe (se abre en una pestaña nueva).
- Se cierra con Esc, botón ✕ o clic fuera.

### 8.10 Bitácora
- Lista cronológica inversa, agrupada por día.
- Tipos: info, advertencia, evento, decisión, logro. Cada uno con ícono.
- Máximo 100 entradas en memoria (las viejas se resumen).
- Accesible: es una región `aria-live="polite"` que anuncia solo la entrada más importante de cada día.

### 8.11 Escena 3D
- **Cámara:** órbita lenta automática alrededor de la base. El jugador puede arrastrar para girar (límites: no ir bajo el suelo, zoom limitado). La rotación automática se pausa mientras arrastra y vuelve a los 5 s.
- **Terreno:** plano con ruido procedural (no hay datos reales todavía) que simule regolito y bordes de cráter. Gris, rugoso. Preparado para cambiarse luego por una textura y un mapa de elevación reales (`terrain.ts` recibe `heightmapUrl` opcional).
- **Base:** 4 módulos con geometrías simples (cilindros y cúpulas bajas), cada uno con una luz que representa su energía:
  - Intensidad proporcional a la eficiencia.
  - Averiado: luz roja parpadeante + humo simple (partículas pocas).
  - Refugio activo: luces de los módulos de trabajo apagadas y el refugio brilla en ámbar.
- **Panel solar** que se orienta hacia el Sol.
- **Rover** pequeño que sale de la base en la expedición de hielo y vuelve.
- **Cielo:** negro, sin estrellas. **Tierra** pequeña y baja en el horizonte.
- **Sol:** luz direccional muy rasante (sombras largas). Su intensidad sigue la luz del día. En la noche lunar, casi 0.
- **Tormenta solar:** el cielo se tiñe levemente y aparece un brillo en el horizonte; alerta visual.
- **Transición entre días:** el Sol se mueve un poco en el horizonte durante la animación de resolución.

### 8.12 Debrief (pantalla final)
- Título: "Misión cumplida" ⭐⭐⭐ o "Misión abortada en el día X".
- **Causa principal** explicada en una frase simple, y causas secundarias si las hay.
- **Gráfica SVG** de los 4 recursos por día (líneas con colores distintos **y** patrones distintos), con la noche lunar sombreada y las tormentas marcadas con ☀️ sobre la línea de tiempo. Accesible con una tabla alternativa ("Ver datos en tabla").
- **Línea de tiempo de decisiones:** tormentas (refugio o no), averías, rover.
- **"Así lo resuelve una misión real"**: 2–3 tarjetas según las causas y los eventos de la partida (almacenamiento de energía para la noche, refugios contra tormentas solares, uso de hielo lunar, reciclaje de agua y oxígeno). Textos en `facts.json` con su fuente.
- Insignias ganadas.
- Botones: **Jugar de nuevo**, **Cambiar dificultad**, **Menú**, **Copiar resultado** (texto tipo "Sobreviví 30 días en el polo sur lunar con ⭐⭐ en Shackleton: Turno de Noche").
- Si se ganó en Cadete, sugerir probar Comandante.

### 8.13 Ajustes
- Idioma (ES/EN).
- Sonido on/off y volumen.
- Calidad gráfica: Auto / Alta / Baja.
- Movimiento reducido: Auto (sigue el sistema) / Activado / Desactivado.
- Repetir tutorial.
- Borrar partida guardada (con confirmación).

### 8.14 Créditos
- Equipo Halo Sur.
- Datos: lista de `sources.json` con su estado (por ahora casi todo "simulado").
- Librerías usadas y sus licencias.
- Uso de IA: "Desarrollado con ayuda de Claude Code (Anthropic). Ver AI_USAGE.md".
- Aviso de no afiliación a NASA.

---

## 9. Textos y tono

- Segunda persona, frases cortas, verbos de acción.
- Control de Misión habla en un tono cálido y profesional.
- Nunca culpar al jugador: "La noche fue más larga que la batería", no "Lo hiciste mal".
- Datos curiosos con toque ecuatoriano, por ejemplo: "La temperatura afuera es mucho más baja que en la cima del Chimborazo." Todos los datos curiosos van en `facts.json` con `status`.
- **Todos** los textos en `/src/i18n/es.json` y `en.json`. Ninguna cadena visible hardcodeada en componentes.
- Si falta una clave en inglés, usar la de español y registrar un aviso en consola (solo en desarrollo).
- Interpolación de variables `{nivel}`, `{dia}` y plurales simples.

---

## 10. Sonido (Web Audio, generado)

- Clic suave al mover sliders (con límite de frecuencia para no saturar).
- Tono de confirmación al ejecutar el día.
- Alarma de 2 tonos para tormenta y estado crítico (máximo una vez por día).
- Acorde ascendente al ganar; tono descendente y suave al perder.
- Zumbido ambiental muy bajo de la base (opcional).
- El audio arranca **solo después de la primera interacción** (política de autoplay de los navegadores).
- Respeta el ajuste de sonido y se silencia al ocultar la pestaña.

---

## 11. Persistencia

- Guardar la partida en `localStorage` al final de cada día y al resolver cada evento. Clave `halosur:save:v1`.
- **Todas** las lecturas y escrituras dentro de try/catch. Si el almacenamiento no existe o falla (modo privado, bloqueado), el juego funciona igual sin guardar y el botón "Continuar" no aparece.
- Al cargar, validar la versión y la estructura. Si no coincide o está corrupta: descartarla sin error visible y registrar un aviso en consola.
- También se guardan aparte: idioma, ajustes, tutorial visto, mejores estrellas por dificultad.
- Si el jugador abre el juego en dos pestañas, la última que guarda gana (no hace falta sincronizar). Documentarlo en DECISIONES.md.

---

## 12. Accesibilidad

- Todo jugable solo con teclado. Orden de foco lógico y foco visible.
- Componentes con roles ARIA correctos (`slider` con `aria-valuemin/max/now/valuetext`, `dialog` con `aria-modal`, `progressbar` en el HUD).
- `prefers-reduced-motion`: sin órbita automática de cámara, sin parpadeos, transiciones instantáneas.
- Ningún parpadeo más rápido que 3 veces por segundo.
- Texto mínimo de 16 px en celular. Soporta zoom del navegador al 200% sin romper el layout.
- Indicadores de estado con ícono + texto, no solo color.
- La escena 3D es decorativa para lectores de pantalla (`aria-hidden`); toda la información está también en el HUD y la bitácora.

---

## 13. Rendimiento y robustez gráfica

- **Detección de WebGL al arrancar.** Si no hay WebGL o falla la creación del contexto: usar `fallback2d.tsx` (ilustración SVG estática de la base que también cambia según el estado: luces, noche, tormenta) y avisar una vez: "Tu dispositivo no soporta 3D; usamos la vista 2D". El juego es 100% jugable sin 3D.
- **Pérdida de contexto WebGL** (`webglcontextlost`): mostrar el respaldo 2D sin perder la partida, e intentar restaurar.
- **Calidad automática:** medir FPS los primeros 3 s; si < 30, bajar calidad (sin sombras, menos partículas, `pixelRatio` 1).
- Limitar `devicePixelRatio` a 2.
- Pausar el render cuando la pestaña está oculta (`visibilitychange`) y cuando la escena no está en pantalla.
- Redimensionar con `ResizeObserver` sin recrear la escena.
- Liberar geometrías, materiales y texturas al desmontar (sin fugas de memoria al reiniciar muchas veces).
- Tamaño del bundle inicial: lo más pequeño posible. Three.js se carga en la isla, no bloquea el primer render del menú.
- Lighthouse: Performance ≥ 80 en escritorio, Accesibilidad ≥ 90.

---

## 14. Modo debug (`?debug=1`)

- Panel flotante con el estado interno en JSON, la semilla, los eventos programados y el FPS.
- Botones: saltar al día N, forzar evento, poner un recurso en un valor, ganar, perder, cambiar dificultad en caliente.
- Parámetro `?seed=12345` para reproducir partidas exactas.
- Nunca visible sin el parámetro.

---

## 15. Edge cases que DEBEN funcionar (crear un test o una verificación manual para cada uno)

**Simulación**
1. El plan suma exactamente lo disponible → válido, batería queda igual a 0 + nada.
2. El plan supera lo disponible → `validatePlan` lo rechaza; la UI nunca lo permite.
3. Disponible negativo (batería 0, noche, consumo base) → se fija en 0, apagón parcial, −3 extra de soporte vital.
4. Batería llena y mucho sol → la energía sobrante se desperdicia y se registra.
5. Dos causas de derrota el mismo día → se guardan ambas y la principal sigue la prioridad.
6. Derrota en el día 30 → es derrota, no victoria.
7. Recurso que subiría por encima de 100 → se limita a 100.
8. Refugio activo con energía asignada al invernadero → produce 0 y la UI lo avisa antes.
9. Avería de un módulo ya roto → elegir otro; si todos están rotos (solo posible con debug), no hay avería.
10. Reparación sin energía suficiente para el taller → la opción aparece deshabilitada con su razón.
11. Expedición del rover con retraso → el agua llega un día después y la bitácora lo explica.
12. Expedición del rover el día 30 → el agua llegaría después del final; la opción se deshabilita con la razón "No hay tiempo antes del relevo".
13. Misma semilla y mismas decisiones → resultado idéntico (test de determinismo).
14. Eventos garantizados → siempre aparecen todos en sus ventanas, sin chocar (test con 1000 semillas).
15. Balance: plan "todo al reciclador" pierde en Comandante entre días 12 y 18; un plan de referencia "prudente" gana (test).

**UI e interacción**
16. Doble clic o Enter repetido en "Ejecutar día" → se resuelve un solo día.
17. Doble clic en una opción de evento → se aplica una sola vez.
18. Cambiar de idioma en mitad de la partida → todo se traduce sin perder el estado.
19. Redimensionar o rotar el celular en mitad de un evento → el modal sigue abierto y bien ubicado.
20. Pestaña oculta durante la animación de resolución → al volver, el estado es correcto y no hay animaciones acumuladas.
21. Recargar la página en mitad de un evento → al "Continuar", el evento sigue pendiente (no se pierde ni se repite).
22. Partida guardada de una versión vieja o corrupta → se descarta sin romper el menú.
23. `localStorage` bloqueado → el juego funciona y "Continuar" no aparece.
24. "Repetir plan de ayer" cuando ya no alcanza la energía → se ajusta al máximo posible, en el orden reciclador → blindaje → invernadero → taller, y se avisa.
25. Teclado: se puede jugar una partida completa sin mouse.
26. Reduced motion activado → sin órbita automática ni parpadeos.
27. Sin WebGL → respaldo 2D completo y jugable.
28. Reiniciar 10 partidas seguidas → sin fugas de memoria visibles ni caída de FPS.
29. Pantalla muy angosta (320 px) → todo usable, sin scroll horizontal.
30. Textos largos en inglés → no se cortan ni se salen de los botones.

---

## 16. Tests del motor (Vitest) — mínimo

- `createGame` respeta los valores iniciales por dificultad.
- `getEnergyBudget` calcula bien solar, base y disponible (incluye el caso negativo).
- `validatePlan`: límites por módulo, módulos rotos, suma total.
- `runDay`: producción, consumo, refugio, dosis, límites 0–100.
- `previewDay` coincide con `runDay` para el mismo plan (sin eventos).
- Derrota: cada causa y combinaciones; prioridad.
- Victoria en el día 30; derrota en el día 30.
- Eventos: programación garantizada, sin choques, restricciones (1000 semillas).
- Determinismo con semilla.
- Puntuación: estrellas e insignias.
- Balance: los dos planes de referencia de la sección 15 (punto 15).

---

## 17. Telemetría local (solo para ajustar el balance)

- Sin enviar nada a ningún servidor.
- En modo debug, botón "Exportar partida" que descarga un JSON con el historial completo, para analizar el balance.
- Script `npm run simulate` que corre 1000 partidas con 3 estrategias automáticas (todo al reciclador, prudente, aleatoria) y muestra en consola el % de victorias por dificultad y el día promedio de derrota. **Objetivo:** prudente gana ≥ 70% en Comandante y ≥ 90% en Cadete; todo al reciclador gana ≤ 10% en Comandante; aleatoria gana ≤ 25%.
- Si el script no cumple los objetivos, ajustar **solo** `balance.json` y documentar el cambio en DECISIONES.md.

---

## 18. Criterios de aceptación (el juego está terminado cuando…)

- [ ] Se puede jugar una partida completa de 30 días en Cadete y en Comandante, ganar y perder.
- [ ] Aparecen todos los eventos garantizados con sus decisiones y consecuencias.
- [ ] La noche lunar se siente: se ve en el pronóstico, en la escena y en la batería.
- [ ] Cada indicador tiene su ficha "¿De dónde sale este número?" con estado honesto.
- [ ] El debrief explica la causa, muestra la gráfica y las tarjetas educativas.
- [ ] Todo funciona en español e inglés.
- [ ] Funciona en Chrome, Firefox y Safari recientes, en escritorio y celular.
- [ ] Funciona sin WebGL (respaldo 2D) y con almacenamiento bloqueado.
- [ ] Los 30 edge cases de la sección 15 están cubiertos.
- [ ] `npm test` pasa y `npm run build` no tiene errores ni warnings de TypeScript.
- [ ] `npm run simulate` cumple los objetivos de balance.
- [ ] No hay ninguna llamada de red a APIs externas (solo fuentes de Google Fonts, con respaldo del sistema).
- [ ] No aparece ningún logo ni marca de NASA.
- [ ] `README.md` (cómo correrlo y desplegarlo), `CREDITS.md`, `AI_USAGE.md` y `DECISIONES.md` están completos.

---

## 19. Fases de construcción

Trabaja en este orden. Al terminar cada fase: `npm test`, `npm run build`, commit con mensaje claro en español y una línea en `AI_USAGE.md`.

1. **Esqueleto:** Astro + Preact + Three + TS + Vitest, tokens de diseño, i18n básico, máquina de estados vacía con pantallas placeholder.
2. **Motor:** `/src/sim` completo con datos simulados, tests y script `simulate`. Ajustar balance hasta cumplir objetivos.
3. **Juego jugable en 2D:** HUD, planificador completo con vista previa, pronóstico, eventos, bitácora, outcome y debrief básico. Respaldo 2D como "escena". **En este punto el juego se puede jugar de principio a fin.**
4. **Escena 3D:** terreno procedural, base, luces por estado, Sol, Tierra, noche, tormenta, rover, calidad automática, pérdida de contexto.
5. **UX completa:** tutorial, menú, dificultad, ajustes, créditos, fichas de fuente, debrief con gráfica y tarjetas, insignias, copiar resultado.
6. **Sonido, persistencia y accesibilidad:** Web Audio, guardado y carga robustos, teclado, ARIA, reduced motion.
7. **Pulido y edge cases:** recorrer la lista de la sección 15, responsive en 320 px, textos en inglés, rendimiento, modo debug.
8. **Documentación:** README, CREDITS, AI_USAGE, DECISIONES. Revisión final contra la sección 18.

---

## 20. Preparado para datos reales (no implementar llamadas ahora)

Deja el código listo para que después solo cambien los JSON:
- `storms_sample.json` → lista de eventos reales de DONKI con fecha y clase (`status: "verified"`).
- `balance.json` → consumos verificados del BVAD de NASA.
- `terrain.ts` → acepta `heightmapUrl` y `colorMapUrl` del CGI Moon Kit.
- `base.ts` → acepta modelos GLB opcionales (NASA 3D Resources) con respaldo a las geometrías simples.
- Deja documentado en `README.md` dónde va cada dato real y qué campo cambiar.
