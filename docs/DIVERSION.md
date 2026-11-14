# Cómo hacer el juego divertido y que enseñe — debate de expertos (14-11-2026)

Tres agentes expertos (`.claude/agents/`: **gamificacion**, **ux**, **neuropsicologia**) opinaron por
separado y luego se moderó un debate entre sus posiciones. Este documento es el resultado.
Las tareas concretas están en `docs/tasks/F-diversion.md`.

> Nota honesta: son opiniones de modelos de IA en un rol, no de profesionales ni de estudios citados.
> Sirven para ordenar ideas; lo que decide es probarlo con niños reales (tarea E-02).

## Diagnóstico común

Los tres coincidieron sin verse: **"el juego es una hoja de cálculo con sliders"**. El niño mueve
números, pulsa "Ejecutar" y lee texto; no ve la causa de nada.

- **Gamificación:** no hay suspense entre decidir y ver la consecuencia; la noche lunar (el mejor momento) llega tarde para un juez que juega 3 minutos.
- **UI/UX:** el estado vital desaparecía bajo la tablet; la consecuencia era texto, no algo visible.
- **Neuropsicología:** ensayo y error ciego; 4 sliders + 4 medidores + eventos superan lo que un niño atiende a la vez; el debrief llega tarde para unir causa y efecto.

## Lo que el niño debe poder decir al terminar

1. "En la Luna la energía se guarda antes de la noche, porque la batería tiene límite y sin sol no se recarga."
2. "Cada módulo gasta energía para darme algo; repartir es elegir qué sacrifico hoy."
3. "En una tormenta solar te refugias: pierdes producción pero evitas casi toda la radiación."
4. "Una misión real revisa el plan antes de ejecutarlo, y el agua y el aire se reciclan."

Toda idea nueva se mide contra estas cuatro frases.

## Los 5 puntos en conflicto y su acuerdo

| Conflicto | Posiciones | Acuerdo |
|---|---|---|
| Cuenta atrás en la tormenta | G: 8 s · N: no menos de 25 s · U: ninguna | **30 s** como barra que se vacía, opción segura marcada "Recomendada"; al vencer se aplica la segura, sin castigo; botón "sin tiempo". La tensión sale de la consecuencia escrita en cada botón, no del reloj |
| Tripulación | G: 4 caras · N: 2 con nombre · U: solo Control de Misión | Sin caras fijas. **Una línea de radio** en el feed; si hay tiempo, dos voces con nombre (ingeniería y salud) que dicen la causa en una frase |
| Sliders a la vez | G: los 4 · U: 1 con chips · N: andamiaje 2→3→4 | **Un slider visible** (el del módulo tocado) y módulos que se desbloquean por días; los bloqueados se ven apagados en la maqueta con "Se activa el día N" |
| Modo demo para jueces | G: empezar en el día 9 · N: no saltarse el aprendizaje | Dos entradas en el menú: **"Misión completa"** y **"Demo 3 min"** (día 9, 4 módulos, Cadete). La demo conserva una predicción, la noche y una tormenta |
| HUD estilo shooter | Petición del equipo; U y N piden austeridad | Hecho con 5 zonas (abajo). Reglas: no tapa toques, solo un elemento en rojo a la vez, en celular se pliega |

## HUD estilo shooter (hecho)

Los niños ya saben leer esta distribución; se reutiliza con significado de misión:

| Zona | En un shooter | Aquí |
|---|---|---|
| Arriba al centro | Marcador y tiempo | Día, tira de 30 días con la noche en negro, "Noche lunar en N días" |
| Abajo a la izquierda | Salud y armadura | Soporte vital (número grande) y comida, con barra, ícono y palabra de estado |
| Abajo a la derecha | Munición | Batería actual / capacidad y el sol de hoy |
| Arriba a la izquierda | Minimapa | Dial circular de dosis de radiación |
| Arriba a la derecha | Feed de eventos | Últimas 3 líneas de la bitácora |

Prohibido (acuerdo): mira central, efectos de daño o sangre, armas, contador "de balas", y más de un elemento parpadeando a la vez.

## Plan acordado (orden de construcción)

| # | Qué | Horas | Estado |
|---|---|---|---|
| 1 | HUD de 5 zonas + maqueta que se toca | 5 | **Hecho** (falta comprobarlo en celular) |
| 2 | Veredicto en una línea + un slider con chips de módulo | 4 | F-02 |
| 3 | Predicción antes de ejecutar + causa del día en una frase | 4 | F-03 |
| 4 | Tormenta: 30 s, opción segura, sin tiempo, consecuencias | 3 | F-04 |
| 5 | Debrief de una frase + "volver al día N" | 3 | F-05 |
| 6 | Andamiaje: módulos que se desbloquean | 1–2 | F-06 |
| 7 | Demo de 3 minutos desde el día 9, Cadete por defecto | 3 | F-07 |
| 8 | Voz de Control de Misión | 1–2 | F-08 |

Total restante: 19–21 h. Si no alcanza, se recortan primero F-08 y F-06.

## Qué se descarta

- Fichas coleccionables y partida diaria "el Sol de hoy": puntos sin decisión. Se queda el botón "¿De dónde sale este número?" y el aviso del menú.
- Rachas, premios por velocidad, popups de "¡Bien hecho!", tutoriales emergentes.
- Presets "Modo ahorro" y "Todo a cero" (queda "Repetir plan de ayer").
- Caminar en primera persona (prohibido por `docs/NORTE.md`).

## Decisiones que quedan para el equipo

1. **Voces:** ¿dos personajes con nombre (más emoción, +1 h) o una sola voz de Control de Misión?
2. **HUD en celular:** hoy se pliega en una franja superior (dial y feed se ocultan con el panel abierto). ¿Se acepta, o deben verse las 5 zonas siempre?
