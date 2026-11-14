# Shackleton: Turno de Noche — guía para agentes y personas

Juego web en **primera persona** para NASA Space Apps Challenge 2026 (equipo Halo Sur). Diriges una
base en el polo sur lunar durante 30 días: repartes energía, sobrevives a la noche lunar y a las
tormentas solares. Público: 10–15 años, ES/EN.

## Antes de tocar nada, lee

1. `docs/NORTE.md` — prioridades del proyecto. **Manda sobre todo lo demás.**
2. `docs/GDD.md` — qué juego es y qué entra en el MVP.
3. `docs/ARTE.md` — dirección de arte. **Obligatorio antes de cualquier trabajo visual o de sonido.**
4. `docs/tasks/TABLERO.md` — qué hay que hacer y quién lo tiene.
5. La spec de tu área en `docs/specs/`.

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
5. **Toda acción física tiene su equivalente en la tablet** (teclado, celular, sin WebGL).
6. **El juego funciona sin red.** Datos NASA históricos en JSON del repo (`status` honesto: `verified` / `simulated` / `game_balance`). La única llamada en vivo es `/api/spaceweather` (proxy propio, opcional, con respaldo). **La clave `NASA_API_KEY` nunca va al navegador ni al repo**: vive en `.env` (local) y en las variables de Cloudflare Pages (producción).
7. **Nada de logos de NASA. Nada de muerte:** la derrota es "misión abortada".
8. **Arte:** paleta, luz y lista anti-slop de `docs/ARTE.md`. Movimiento con matemáticas (amortiguación, senos), no saltos de valor.

## Cómo trabajar una tarea

1. `git pull`. Elige una tarea `libre` en `docs/tasks/TABLERO.md` cuyas dependencias estén `hecha`.
2. Pon tu nombre y `en curso` en el tablero; haz commit y push **solo de ese cambio** antes de empezar (evita que dos personas tomen la misma).
3. Trabaja solo en las carpetas de tu área (tabla del tablero). Si necesitas cambiar un contrato compartido (`src/sim/types.ts`, `src/state/store.ts`), avisa al equipo.
4. Antes de cada commit: `npm test && npm run check && npm run build`.
5. Commits pequeños, mensaje en español: `A-01: runDay con producción y consumo`.
6. Marca `hecha` en el tablero. Decisiones no previstas → una línea en `DECISIONES.md`. Uso de IA → una línea en `AI_USAGE.md`.

Para una capa visual: constrúyela, mírala en el navegador y compárala con `docs/ARTE.md` antes de pasar a la siguiente.

## Modo director (Fable planifica, Sonnet implementa)

Subagentes en `.claude/agents/`: **builder** (Sonnet, implementa una tarea) y **verificador** (Sonnet,
revisa sin tocar código). El modelo principal es el director:

1. Elige la tarea en `docs/tasks/TABLERO.md` y la marca `en curso`.
2. Si es grande, la parte en trozos independientes con archivos distintos.
3. Delega cada trozo al `builder` con un encargo autocontenido: ID de tarea, archivos, criterio de "hecho" y lo que no debe tocar.
4. Pasa el resultado al `verificador`; corrige con el `builder` lo que salga.
5. El director revisa el diff, mira el resultado en el navegador si es visual, marca la tarea `hecha`, hace commit y push.

Ejemplo de encargo: "Usa el subagente builder para la tarea C-02 (visor de casco) de docs/tasks/C-interfaz.md.
Solo src/components/Visor.tsx, icons.tsx, i18n y estilos. Después pasa el diff al verificador."

## Si eres un agente que retoma el trabajo

- No hay memoria de sesiones anteriores: **todo el contexto está en el repo**. Empieza por `docs/tasks/TABLERO.md`, sección "Siguiente paso recomendado".
- Haz **una tarea por sesión**, completa: código, verificación, tablero, commit y push. No dejes tareas a medias; si no puedes terminarla, escribe en su archivo de área qué falta y por qué.
- No reescribas `src/sim`: está probado con 50 tests. Si la interfaz necesita algo del motor, añade una función pura con su test.
- No cambies números de `public/data/balance.json` sin correr `npm run simulate` y `npm test` (hay un test de balance).
- Trabajo visual: una capa cada vez, mirándola en el navegador contra `docs/ARTE.md`. Pointer Lock no funciona en vistas previas embebidas; usa una pestaña normal o el respaldo de arrastre (tarea B-02).
- Datos: nunca inventes cifras, citas ni URLs de NASA. Lo que no puedas comprobar queda `simulated`.
- Ante una duda no resuelta por los documentos: elige lo más simple que respete `docs/GDD.md` y `docs/ARTE.md`, y anótalo en `DECISIONES.md`.

## Mapa del código

| Carpeta | Qué es |
|---|---|
| `src/sim/` | Motor del juego (puro) y sus tests |
| `src/state/store.ts` | Signals globales y acciones: el único puente entre motor, UI y escena |
| `src/scene/` | Mundo 3D en primera persona (Three.js) |
| `src/components/` | Interfaz Preact (visor, tablet, eventos, debrief) |
| `src/i18n/` | Textos ES/EN |
| `public/data/` | Balance, luz, eventos y datos NASA |
| `scripts/` | Descarga de datos y simulación de balance |
| `docs/` | GDD, arte, specs y tareas |
