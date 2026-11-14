# Shackleton: Turno de Noche — guía para agentes y personas

Juego web en **primera persona** para NASA Space Apps Challenge 2026 (equipo Halo Sur). Diriges una
base en el polo sur lunar durante 30 días: repartes energía, sobrevives a la noche lunar y a las
tormentas solares. Público: 10–15 años, ES/EN.

## Antes de tocar nada, lee

1. `docs/GDD.md` — qué juego es y qué entra en el MVP.
2. `docs/ARTE.md` — dirección de arte. **Obligatorio antes de cualquier trabajo visual o de sonido.**
3. `docs/tasks/TABLERO.md` — qué hay que hacer y quién lo tiene.
4. La spec de tu área en `docs/specs/`.

## Comandos

```bash
npm install        # una vez
npm run dev        # http://localhost:4321
npm test           # tests del motor (Vitest)
npm run check      # tipos TypeScript
npm run build      # build estático en dist/
npm run fetch:nasa # descarga datos reales a public/data (ver docs/specs/04-datos-nasa.md)
```

## Reglas que no se rompen

1. **`src/sim` es puro y determinista.** Sin DOM, Three, Preact ni `Math.random` (usa `rng.ts`). Misma semilla + mismas decisiones = mismo resultado.
2. **Ningún número de balance en el código.** Todo sale de `public/data/*.json`.
3. **La escena solo refleja estado; la UI solo lee estado y llama acciones** de `src/state/store.ts`. Las reglas del juego viven en el motor.
4. **Ningún texto visible en componentes.** Todo en `src/i18n/es.json` y `en.json`.
5. **Toda acción física tiene su equivalente en la tablet** (teclado, celular, sin WebGL).
6. **El juego no llama a ninguna API.** Los datos NASA se descargan con un script y se guardan como JSON con `status` honesto (`verified` / `simulated` / `game_balance`).
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
