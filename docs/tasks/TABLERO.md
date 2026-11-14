# Tablero de tareas

**Cómo tomar una tarea:** `git pull` → pon tu nombre y `en curso` → commit y push solo de este
archivo → trabaja → marca `hecha`. Detalle de cada tarea en el archivo de su área.

Estados: `libre` · `en curso` · `hecha` · `bloqueada`. Prioridades: P0 imprescindible, P1 importante, P2 si sobra tiempo.

## Áreas (cada una toca solo sus carpetas → sin conflictos de merge)

| Área | Carpetas | Archivo |
|---|---|---|
| A · Motor | `src/sim/`, `scripts/simulate.ts` | [A-motor.md](A-motor.md) |
| B · Mundo 3D | `src/scene/`, `src/audio/` | [B-mundo-3d.md](B-mundo-3d.md) |
| C · Interfaz | `src/components/`, `src/state/`, `src/i18n/`, `src/styles/`, `src/app/` | [C-interfaz.md](C-interfaz.md) |
| F · Diversión y aprendizaje | las de C, más funciones puras en `src/sim/` | [F-diversion.md](F-diversion.md) |
| D · Datos NASA | `scripts/fetch-*.ts`, `public/data/` | [D-datos-nasa.md](D-datos-nasa.md) |
| E · Entrega | raíz, `docs/`, deploy, video | [E-entrega.md](E-entrega.md) |

## Hitos (horas desde que el equipo empieza)

| Hora | Hito | Tareas |
|---|---|---|
| 6 | Motor completo con tests · se camina por una base que respeta ARTE | A-01…A-04, B-01, B-02, C-01 |
| 14 | **Partida completa de 30 días jugable** (eventos por tablet) | B-03, B-04, C-02…C-06 |
| 24 | Eventos físicos, datos NASA, debrief completo, sonido, deploy | P1 |
| 28 | **Congelar funciones.** Solo errores, video y entrega | E-02…E-04 |

## Tareas

| ID | Tarea | Prio | Depende de | Responsable | Estado |
|---|---|---|---|---|---|
| A-01 | `previewDay` y `runDay` | P0 | — | Claude | hecha |
| A-02 | Programación de eventos (`events.ts`) | P0 | — | Claude | hecha |
| A-03 | `resolveEvent` y opciones con razón | P0 | A-01, A-02 | Claude | hecha |
| A-04 | Resultado: causas, estrellas (`scoring.ts`) | P0 | A-01 | Claude | hecha |
| A-05 | Test de balance y `npm run simulate` | P1 | A-03 | Claude | hecha |
| A-06 | Insignias y eventos menores | P2 | A-03 | | libre |
| A-07 | Umbrales de estrellas | P2 | — | | libre |
| B-01 | Terreno procedural, sol rasante y cielo | P0 | — | | libre |
| B-02 | ~~Jugador: caminar, salto lunar, colisiones~~ | — | — | | cancelada (NORTE) |
| B-03 | Base: módulos, refugio, rover (hecho simple); falta panel solar y detalle | P1 | — | | libre |
| B-04 | La escena refleja el estado (luces, noche, avería, refugio, rover, tormenta) | P0 | — | Claude | hecha |
| B-05 | ~~Acciones físicas de eventos~~ | — | — | | cancelada (NORTE) |
| B-06 | Partículas, tormenta y postprocesado | P1 | B-04 | | libre |
| B-07 | Sonido por proximidad (Web Audio) | P1 | B-03 | | libre |
| B-08 | Calidad automática y pérdida de WebGL | P2 | B-04 | | libre |
| B-09 | ~~Controles táctiles de caminar~~ (la maqueta ya es táctil) | — | — | | cancelada |
| C-01 | Store completo y bucle del día | P0 | A-01 | Claude | hecha |
| C-02 | Visor → HUD de 5 zonas estilo shooter | P0 | C-01 | Claude | hecha |
| C-03 | Tablet: planificador con vista previa | P0 | C-01 | Claude | hecha |
| C-04 | Panel de evento → ver F-04 | P0 | — | | ver F-04 |
| C-05 | Resumen del día y debrief → ver F-03 y F-05 | P0 | — | | ver F-03, F-05 |
| C-06 | Menú con la base 3D de fondo y tarjetas de misión | P0 | — | Halo Sur | hecha |
| C-07 | Pronóstico de luz y aviso de noche | P1 | C-02 | | libre |
| C-08 | Ficha "¿De dónde sale este número?" | P1 | C-02, D-02 | | libre |
| C-09 | Debrief completo: gráfica SVG y tarjetas | P1 | C-05, D-02 | | libre |
| C-10 | Guardado, ajustes, pausa, inglés completo | P1 | C-03 | | libre |
| C-11 | Tutorial, bitácora, créditos, modo debug | P2 | C-03 | | libre |
| F-01 | HUD de 5 zonas y maqueta que se toca | P0 | — | Claude | hecha |
| F-02 | Veredicto en una línea y un slider con chips | P0 | — | Halo Sur | hecha |
| F-03 | Predecir antes de ejecutar y causa en una frase | P0 | F-02 | | libre |
| F-04 | Panel de evento real (hecho); falta la barra de 30 s y la alarma | P1 | — | | libre |
| F-05 | Debrief con causa, día decisivo, gráfica y "volver al día N" | P0 | — | Halo Sur | hecha |
| F-06 | Módulos que se desbloquean por días | P1 | F-02 | | libre |
| F-07 | Demo de 3 minutos desde el día 9 | P1 | F-05 | | libre |
| F-08 | Voz de Control de Misión | P1 | — | | libre |
| F-09 | Bienvenida, guía del día 1 y ayuda "¿Cómo se juega?" | P0 | — | Halo Sur | hecha |
| F-10 | Módulos con forma propia y rótulo, suelo con cráteres, Tierra y estrellas | P0 | — | Halo Sur | hecha |
| G-P1 | Tripulación: pantalla de inicio, 4 astronautas, vuelo a la base | P0 | — | Halo Sur | hecha |
| G-P2 | Base viva: pasillos de vidrio con astronautas, reacciones, mini-panel por módulo, números flotantes, hitos | P0 | G-P1 | Kevin | hecha |
| G-P3 | Pulido: cámara isométrica, polvo, sonidos, caras en el HUD, tripulación en el debrief | P1 | G-P2 | Kevin | hecha |
| D-01 | Tormentas reales DONKI → `storms_real.json` + proxy en vivo | P1 | — | Claude | hecha |
| D-02 | `sources.json` y `facts.json` con citas | P1 | — | | libre |
| D-03 | Contrastar consumos y dosis con fuentes NASA (ver D-06) | P1 | D-02 | | libre |
| D-04 | Terreno real CGI Moon Kit: código y script listos, faltan los archivos | P2 | — | | libre |
| D-05 | Modelos GLB con Blender por script (`npm run models:build`): los 7 hechos según las referencias del equipo | P1 | — | Halo Sur | hecha |
| D-06 | Pegar valores del BVAD en DECISIONES.md y verificar balance | P1 | — | | libre |
| E-01 | Repo en GitHub (hecho) y deploy automático | P0 | — | | libre |
| E-02 | Prueba de juego con checklist | P1 | hito hora 14 | | libre |
| E-03 | Video de demo y página del proyecto en Space Apps | P0 | hito hora 24 | | libre |
| E-04 | README, CREDITS, AI_USAGE y DECISIONES finales | P0 | — | | libre |

## Siguiente paso recomendado (para quien retome, persona o agente)

Motor, store, tablet, HUD, maqueta 3D y datos NASA están hechos. La partida se juega entera.
Lo que falta para que sea divertida y enseñe está en el **área F** (`docs/DIVERSION.md` explica el porqué):

1. **F-03** predicción y causa en una frase · **F-07** demo de 3 minutos para los jueces.
2. Resto de F-04 (barra de 30 s) · **D-02** fuentes y datos curiosos · **C-08** ficha "¿De dónde sale este número?".
3. **F-07** demo de 3 minutos (lo que verán los jueces) · **C-06** menú.
4. **D-02** fuentes y datos curiosos · **C-08** ficha "¿De dónde sale este número?" (función estrella del Norte).
5. Si sobra: F-06, F-08, B-01 (terreno bonito), B-06, B-07, C-10, E-01 deploy.

Una sesión = una tarea: terminarla, verificarla, marcarla y hacer commit antes de empezar otra.
En modo director: el modelo principal reparte F-02 y F-04 al subagente `builder` y revisa con `verificador`.
## Reparto sugerido

- **2 personas:** una A + C, otra B + D. E entre las dos al final.
- **3 personas:** A + D · B · C. E quien termine antes.
- **4 personas:** A · B · C · D + E.
