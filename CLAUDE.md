# Shackleton: Turno de Noche — guía para agentes y personas

Juego web para NASA Space Apps Challenge 2026 (equipo Halo Sur). Diriges una base en el polo sur lunar
durante 30 días tocando una **maqueta 3D viva**: repartes energía, sobrevives a la noche lunar y a las
tormentas solares. No hay personaje caminando. Público: 7–12 años, ES/EN.

## Antes de tocar nada, lee

0. `docs/STATUS.md` — dónde quedó todo la última vez. **Empieza siempre por aquí.**
1. `docs/NORTE.md` — prioridades del proyecto. **Manda sobre todo lo demás.**
   `docs/RUBRICA.md` — cómo califican los jueces, las penalizaciones y la hora de entrega.
2. `docs/GDD.md` — qué juego es y qué entra en el MVP.
3. `docs/ARTE.md` — dirección de arte. **Obligatorio antes de cualquier trabajo visual o de sonido.**
4. `docs/tasks/TABLERO.md` — qué hay que hacer y quién lo tiene.
5. La spec de tu área en `docs/specs/`.

## Memoria del proyecto (se mantiene sola; léela y actualízala)

El proyecto recuerda entre sesiones con estos archivos. Ninguno se deja desactualizado.

| Pieza | Para qué | Cuándo se toca |
|---|---|---|
| `docs/STATUS.md` | Tablero corto: hecho, en curso, siguiente, bloqueos, trampas | **Se lee al empezar** y se reescribe al cerrar (`/wrap-up`) |
| `DECISIONES.md` | Decisiones no previstas, una línea con fecha. Solo crece | Cada vez que se decide algo |
| `docs/domains/` (`motor`, `interfaz`, `escena`, `datos`) | Referencia profunda por dominio: mapa de archivos, invariantes, deudas y «si cambias X, revisa Y» | Antes de trabajar en ese dominio se lee; al cambiar su comportamiento se actualiza |
| `.claude/rules/` | Reglas que se cargan solas al tocar ciertas carpetas | Al descubrir una regla permanente (se propone al equipo) |
| `docs/RUBRICA.md` | Cómo califican y qué penalizan | Antes de aceptar cualquier cambio (regla 12) |
| `AI_USAGE.md` | Declaración de uso de IA | Una línea por bloque de trabajo |
| Skills `/wrap-up` y `/fix` | Cerrar la sesión guardando la memoria · arreglar un fallo de punta a punta | Al terminar · al reportarse un fallo |

### Las aristas: todo cambio se mira desde todos estos lados

Antes de dar algo por hecho, recorre la lista. Un cambio que solo se pensó desde un lado es el que rompe otro.

| Arista | Pregunta | Dónde se comprueba |
|---|---|---|
| **Motor y balance** | ¿Cambian las reglas o los números? ¿Sigue siendo determinista? | `npm test`, `npm run simulate`, `docs/domains/motor.md` |
| **Interfaz** | ¿La pantalla muestra lo nuevo? ¿Se pisa algo? ¿Los botones responden? | agente `hud`, `__hudCheck()`, `docs/domains/interfaz.md` |
| **Textos** | ¿Está en español **y** en inglés, corto y sin jerga para 7–12 años? | `src/i18n/i18n.test.ts` |
| **Escena 3D** | ¿Algún efecto depende de esto? ¿Cuánto cuesta en rendimiento? | `docs/domains/escena.md`, `window.__renderer.info` |
| **Tutorial y onboarding** | ¿La guía sigue diciendo la verdad y señalando algo que existe? | agente `qa` (primera partida desde cero) |
| **Datos y rigor** | ¿Hay un dato nuevo? ¿Está comprobado, enlazado y con su estado? | `docs/domains/datos.md`, panel de fuentes, README ES y EN |
| **Accesibilidad** | ¿Funciona con teclado, en móvil, con movimiento reducido y sin 3D? | agentes `hud` y `qa` |
| **Rúbrica y entrega** | ¿Qué pregunta sube y qué arriesga? ¿Toca alguna penalización? | `docs/RUBRICA.md` |
| **Memoria** | ¿Hay que actualizar `STATUS.md`, un dominio o `DECISIONES.md`? | `/wrap-up` |

### A quién delegar (tabla de ruteo)

| Tema o síntoma | Agente | Lee antes |
|---|---|---|
| Implementar una tarea o arreglar un fallo ya entendido | `builder` | el documento de dominio que toque |
| Revisar un diff contra la tarea y las reglas | `verificador` | `CLAUDE.md`, `docs/NORTE.md` |
| **Interfaz**: solapes, botones, tamaños de pantalla (obligatorio si se tocó la UI) | `hud` | `docs/domains/interfaz.md` |
| **Que todo funcione**: partidas reales de principio a fin (obligatorio antes de commit y despliegue) | `qa` | `docs/STATUS.md`, `docs/GDD.md` |
| ¿Es divertido? Ritmo, dificultad, recompensas, dilemas | `gamificacion` | `docs/DIVERSION.md` |
| Claridad de pantallas, flujo, diseño visual de juego | `ux` | `docs/ARTE.md` §8b |
| Tono, miedo, carga de lectura, error como aprendizaje (7–12 años) | `psicologia-infantil` | `docs/NORTE.md` |
| ¿Realmente enseña? Carga cognitiva, atención, motivación | `neuropsicologia` | `docs/NORTE.md` |

Si los expertos chocan: **seguridad emocional del niño > claridad > diversión > espectáculo.**
Un fallo reportado se arregla con `/fix <síntoma>`.

## Comandos

```bash
npm install        # una vez
npm run dev        # http://localhost:4321
npm test           # tests del motor (Vitest)
npm run check      # tipos TypeScript
npm run build      # build estático en dist/
npm run simulate   # 1000 partidas automáticas: mide el balance
npm run data:donki  # descarga tormentas reales de un año (NASA DONKI) a public/data/storms_real.json
npm run check:nasa  # prueba el proxy /api/spaceweather: API ok, caída y sin internet
```

## Reglas que no se rompen

1. **`src/sim` es puro y determinista.** Sin DOM, Three, Preact ni `Math.random` (usa `rng.ts`). Misma semilla + mismas decisiones = mismo resultado.
2. **Ningún número de balance en el código.** Todo sale de `public/data/*.json`.
3. **La escena solo refleja estado; la UI solo lee estado y llama acciones** de `src/state/store.ts`. Las reglas del juego viven en el motor.
4. **Ningún texto visible en componentes.** Todo en `src/i18n/es.json` y `en.json`.
5. **Todo se puede hacer desde la tablet** (teclado, celular, sin WebGL); tocar la maqueta es un atajo, nunca la única vía.
6. **El juego funciona sin red.** Datos NASA históricos en JSON del repo (`status` honesto: `verified` / `simulated` / `game_balance`). La única llamada en vivo es `/api/spaceweather` (proxy propio, opcional, con respaldo). **La clave `NASA_API_KEY` nunca va al navegador ni al repo**: vive en `.env` (local) y en las variables de entorno del proyecto de Vercel (producción).
7. **Nada de logos de NASA. Nada de muerte:** la derrota es "misión abortada".
8. **Commits y PRs sin autoría de IA.** No añadir `Co-Authored-By: Claude…`, "Generated with Claude Code" ni ninguna firma de un modelo en mensajes de commit, descripciones de PR, ni como autor o committer de git. El uso de IA se declara solo en `AI_USAGE.md` (lo exige el reto).
9. **Arte:** paleta, luz y lista anti-slop de `docs/ARTE.md`. Movimiento con matemáticas (amortiguación, senos), no saltos de valor.
10. **El agente `hud` revisa SIEMPRE la interfaz antes del commit.** Todo cambio en `src/components`, `src/styles` o en textos de `src/i18n` pasa por el subagente `hud` (`.claude/agents/hud.md`): abre el juego en el navegador en 1600×900, 1280×720, 1024×700 y 375×812, ejecuta `__hudCheck()` (`src/dev/hudCheck.ts`) en cada estado del juego y pulsa los botones. No se hace commit si hay elementos superpuestos, botones tapados o que no responden, texto cortado o sin traducir, o scroll horizontal. Si añades un bloque nuevo de interfaz, añade su selector a `BLOCKS` en `src/dev/hudCheck.ts`.
11. **El agente `qa` comprueba SIEMPRE que todo funciona antes del commit y del despliegue.** Todo cambio del juego (motor, interfaz, escena, textos, datos) pasa por el subagente `qa` (`.claude/agents/qa.md`): corre tests, check, build y simulate, y juega partidas reales en el navegador —primera partida con tutorial, cada evento con sus dos opciones, reparaciones, avance rápido, derrota y victoria, inglés y móvil—. No se hace commit ni se despliega con un veredicto NO APTO. **Nunca se sube una parte del juego sin la otra** (p. ej. un evento del motor sin sus textos e interfaz): un commit deja el juego jugable de principio a fin. El test `src/i18n/i18n.test.ts` falla si falta una clave de texto en ES o EN.
12. **Toda petición de cambio se cuestiona con la rúbrica antes de implementarla.** Lee `docs/RUBRICA.md` y responde en dos líneas: qué pregunta de la rúbrica sube y qué pone en riesgo (estabilidad de la demo, rigor científico, alineación con el reto, tiempo hasta la entrega, las seis penalizaciones). Si no sube nada o el riesgo supera la ganancia, avísalo y propón la alternativa más barata; decide el equipo.
13. **La interfaz usa SIEMPRE diseño de juego, no de aplicación.** Toda pantalla nueva o cambiada sigue la piel «Consola de misión Apolo» de `docs/ARTE.md` §8b (`src/styles/skin.css`): paneles opacos de hardware con borde de 2 px y sombra dura, botones físicos que se hunden, Barlow Condensed para rótulos y B612 para texto y números. Prohibido el vidrio/desenfoque, las pastillas blandas, las sombras difusas y las tipografías por defecto. Si un componente nuevo no hereda la piel, añade su selector a `skin.css`.

## Cómo trabajar una tarea

1. `git pull`. Elige una tarea `libre` en `docs/tasks/TABLERO.md` cuyas dependencias estén `hecha`.
2. Pon tu nombre y `en curso` en el tablero; haz commit y push **solo de ese cambio** antes de empezar (evita que dos personas tomen la misma).
3. Trabaja solo en las carpetas de tu área (tabla del tablero). Si necesitas cambiar un contrato compartido (`src/sim/types.ts`, `src/state/store.ts`), avisa al equipo.
4. Antes de cada commit: `npm test && npm run check && npm run build`. Si tocaste la interfaz, además la revisión del agente `hud` (regla 10); y siempre la del agente `qa` (regla 11).
5. Commits pequeños, mensaje en español: `A-01: runDay con producción y consumo`.
6. Marca `hecha` en el tablero. Decisiones no previstas → una línea en `DECISIONES.md`. Uso de IA → una línea en `AI_USAGE.md`.

Para una capa visual: constrúyela, mírala en el navegador y compárala con `docs/ARTE.md` antes de pasar a la siguiente.

## Modo director (Fable planifica, Sonnet implementa)

Subagentes en `.claude/agents/`: **builder** (Sonnet, implementa una tarea) y **verificador** (Sonnet,
revisa sin tocar código). El modelo principal es el director:

1. Elige la tarea en `docs/tasks/TABLERO.md` y la marca `en curso`.
2. Si es grande, la parte en trozos independientes con archivos distintos.
3. Delega cada trozo al `builder` con un encargo autocontenido: ID de tarea, archivos, criterio de "hecho" y lo que no debe tocar.
4. Pasa el resultado al `verificador`; corrige con el `builder` lo que salga. **Si el trozo tocó la interfaz, pásalo también al `hud` (regla 10), y siempre al `qa` (regla 11): son obligatorios, no opcionales.**
   Para dudas de diseño hay tres expertos que solo opinan: `gamificacion`, `ux` y `neuropsicologia` (su último debate está en `docs/DIVERSION.md`).
5. El director revisa el diff, mira el resultado en el navegador si es visual, marca la tarea `hecha`, hace commit y push.

Ejemplo de encargo: "Usa el subagente builder para la tarea C-02 (visor de casco) de docs/tasks/C-interfaz.md.
Solo src/components/Visor.tsx, icons.tsx, i18n y estilos. Después pasa el diff al verificador."

## Si eres un agente que retoma el trabajo

- No hay memoria de sesiones anteriores: **todo el contexto está en el repo**. Empieza por `docs/STATUS.md` y, para el dominio que vayas a tocar, su documento en `docs/domains/`. Al terminar, `/wrap-up`.
- Haz **una tarea por sesión**, completa: código, verificación, tablero, commit y push. No dejes tareas a medias; si no puedes terminarla, escribe en su archivo de área qué falta y por qué.
- No reescribas `src/sim`: está cubierto por tests (`npm test`). Si la interfaz necesita algo del motor, añade una función pura con su test.
- No cambies números de `public/data/balance.json` sin correr `npm run simulate` y `npm test` (hay un test de balance).
- Trabajo visual: una capa cada vez, mirándola en el navegador contra `docs/ARTE.md`. Pointer Lock no funciona en vistas previas embebidas; usa una pestaña normal o el respaldo de arrastre (tarea B-02).
- Datos: nunca inventes cifras, citas ni URLs de NASA. Lo que no puedas comprobar queda `simulated`.
- Ante una duda no resuelta por los documentos: elige lo más simple que respete `docs/GDD.md` y `docs/ARTE.md`, y anótalo en `DECISIONES.md`.

## Mapa del código

| Carpeta | Qué es |
|---|---|
| `src/sim/` | Motor del juego (puro) y sus tests |
| `src/state/store.ts` | Signals globales y acciones: el único puente entre motor, UI y escena |
| `src/scene/` | Maqueta 3D de la base (Three.js): solo refleja estado y avisa de toques |
| `src/components/` | Interfaz Preact (visor, tablet, eventos, debrief) |
| `src/i18n/` | Textos ES/EN |
| `public/data/` | Balance, luz, eventos y datos NASA |
| `scripts/` | Descarga de datos y simulación de balance |
| `docs/` | GDD, arte, specs y tareas |

## Conocido (trampas ya pagadas)

- **No subir por partes.** El 14-nov se subió el evento de polvo del motor sin sus textos y en pantalla salió `event.dust.title`. Motor + interfaz + textos van en el mismo commit.
- **Varios agentes a la vez**: archivos distintos para cada uno; los JSON de `src/i18n` se editan con un script Node de una pasada (leer → `Object.assign` → escribir), nunca a mano en paralelo.
- **Con agentes editando**, el servidor de desarrollo recarga la página y `npm run build` puede fallar a medias (`UV_HANDLE_CLOSING`): verifica al final, con el árbol estable.
- **El visor embebido del asistente** va a pocos fps, recorta `dt` (las animaciones se ven a cámara lenta) y pausa `requestAnimationFrame` cuando está oculto. No sirve para medir fps.
- **CSS**: las hojas de componentes se cargan en orden no garantizado; `src/styles/skin.css` va la última desde `index.astro` y usa el prefijo `html` para ganar. Una clase global genérica (`.hud`, `.sun`) en un CSS de componente ya rompió el HUD una vez: usa prefijos.
- **`git pull --rebase --autostash`** antes de cada commit: Christopher también sube. Un stash mal resuelto dejó marcadores de conflicto en `DECISIONES.md`.
- **Windows**: Python no está disponible (usa scripts Node); los heredocs con comillas dentro fallan en Git Bash (escribe el script a un archivo).
- **ElevenLabs**: la clave necesita el permiso *Sound Generation*; sin él `npm run sfx` devuelve 401 y el juego usa los efectos sintetizados.
- **Desplegar**: `npx vercel deploy --prod --yes` desde un árbol limpio; la clave de NASA vive en las variables del proyecto de Vercel.
