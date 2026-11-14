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
| B-02 | Jugador: caminar, salto lunar, colisiones | P0 | — | | libre |
| B-03 | Base: módulos, refugio, panel solar, rover | P0 | B-01 | | libre |
| B-04 | La escena refleja el estado (luces, noche, avería) | P0 | B-03, C-01 | | libre |
| B-05 | Acciones físicas de eventos | P1 | B-04, A-03 | | libre |
| B-06 | Partículas, tormenta y postprocesado | P1 | B-04 | | libre |
| B-07 | Sonido por proximidad (Web Audio) | P1 | B-03 | | libre |
| B-08 | Calidad automática y pérdida de WebGL | P2 | B-04 | | libre |
| B-09 | Controles táctiles | P2 | B-02 | | libre |
| C-01 | Store completo y bucle del día | P0 | A-01 | Claude | hecha |
| C-02 | Visor de casco | P0 | C-01 | | libre |
| C-03 | Tablet: planificador con vista previa | P0 | C-01 | Claude | hecha |
| C-04 | Panel de evento en la tablet | P0 | C-03, A-03 | | libre |
| C-05 | Resumen del día y debrief básico | P0 | C-01, A-04 | | libre |
| C-06 | Menú y selección de dificultad | P0 | — | | libre |
| C-07 | Pronóstico de luz y aviso de noche | P1 | C-02 | | libre |
| C-08 | Ficha "¿De dónde sale este número?" | P1 | C-02, D-02 | | libre |
| C-09 | Debrief completo: gráfica SVG y tarjetas | P1 | C-05, D-02 | | libre |
| C-10 | Guardado, ajustes, pausa, inglés completo | P1 | C-03 | | libre |
| C-11 | Tutorial, bitácora, créditos, modo debug | P2 | C-03 | | libre |
| D-01 | Tormentas reales DONKI → `storms.json` | P1 | — | | libre |
| D-02 | `sources.json` y `facts.json` con citas | P1 | — | | libre |
| D-03 | Contrastar consumos y dosis con fuentes NASA | P1 | D-02 | | libre |
| D-04 | Elevación real del polo sur (LOLA) | P2 | B-01 | | libre |
| E-01 | Repo en GitHub (hecho) y deploy automático | P0 | — | | libre |
| E-02 | Prueba de juego con checklist | P1 | hito hora 14 | | libre |
| E-03 | Video de demo y página del proyecto en Space Apps | P0 | hito hora 24 | | libre |
| E-04 | README, CREDITS, AI_USAGE y DECISIONES finales | P0 | — | | libre |

## Siguiente paso recomendado (para quien retome, persona o agente)

El motor está completo. Lo que más acerca a un juego jugable, en este orden:

1. ~~C-01~~ hecha: la partida completa ya se juega con la tablet provisional.
2. En paralelo: **C-03** tablet · **C-02** visor · **B-01** terreno, sol y cielo.
3. **C-04** eventos · **C-05** resumen y debrief · **C-06** menú → *partida completa jugable*.
4. **B-02**, **B-03**, **B-04** → el mundo responde al juego.
5. P1: D-01, D-02, C-07, C-08, C-09, B-05, B-06, B-07, C-10, E-01.

Cada tarea está escrita para hacerse sin más contexto que su archivo de área, la spec que cita y
`CLAUDE.md`. Una sesión = una tarea: terminarla, verificarla, marcarla y hacer commit antes de
empezar otra.

## Reparto sugerido

- **2 personas:** una A + C, otra B + D. E entre las dos al final.
- **3 personas:** A + D · B · C. E quien termine antes.
- **4 personas:** A · B · C · D + E.
