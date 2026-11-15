# Vídeo de demostración (30 s) — Shackleton: Turno de Noche

Proyecto [Remotion](https://www.remotion.dev) aparte del juego. **No toca el código del juego**: graba clips del
juego en marcha y los monta con rótulos de la piel «Consola de misión Apolo» (`docs/ARTE.md`: paleta,
Barlow Condensed y B612) y la música del juego (`minigames.mp3`, Suno).

Salidas (en `out/`, ignorado por git):

| Archivo | Formato |
|---|---|
| `shackleton-demo-es.mp4` | 1920×1080, español |
| `shackleton-demo-es-vertical.mp4` | 1080×1920, español |
| `shackleton-demo-en.mp4` | 1920×1080, inglés |
| `shackleton-demo-en-vertical.mp4` | 1080×1920, inglés |

Guion (30 s, 30 fps): portada → intro (vídeo de la intro del juego) → tripulación → la base entra en escena y la
maqueta 3D → plan de energía con + y − y el sello → pasar el día → tormenta solar real (NASA DONKI) con sus dos
opciones → noche lunar → 3 minijuegos (rover, cables, micrometeoritos) → victoria con la nave de relevo → cierre.
Las escenas, los recortes y los textos ES/EN están en `src/scenes.ts`; el montaje en `src/Demo.tsx`.

## Volver a renderizar

Requisitos: Node 22+, ffmpeg en el PATH y Google Chrome instalado (`C:/Program Files/Google/Chrome/Application/chrome.exe`;
otra ruta con la variable `CHROME_PATH`).

```bash
cd video
npm install
```

### 1. Grabar los clips del juego (solo si el juego cambió)

Con el juego en marcha en la raíz del repo (`npm run dev`, puerto 4321; hace falta el modo dev porque el script usa
`window.__store` y la jugadora «prudente» del motor):

```bash
node capture/run.mjs
```

```bash
LANG_GAME=en node capture/run.mjs
```

Abre Chrome con GPU (ventana visible, 1280×720 a escala 1,5) y graba con el screencast de DevTools a
`public/clips/<clip>.mp4` (y `<clip>-en.mp4`). Se puede grabar solo un clip: `node capture/run.mjs storm`.
Clips: `title crew launch base plan pass storm night victory rover cables micro relay`.
Los clips (`public/clips`, ≈265 MB) no van al repo (`.gitignore`): hay que grabarlos antes del primer render en otra máquina.
`public/audio` y `public/video` son copias de `../public/audio/music/minigames.mp3` y `../public/video/intro-*.mp4`.
La partida usa la semilla por defecto: la tormenta del día 6 es la de NASA DONKI que sirva el proxy ese día
(o la de respaldo del JSON). Los minijuegos se juegan de verdad desde «Minijuegos» de la portada (práctica).
Si el servidor de desarrollo recarga a mitad (otro agente editando), repite el clip.

### 2. Renderizar

```bash
npx remotion render src/index.ts Demo out/shackleton-demo-es.mp4 --crf=18
```

```bash
npx remotion render src/index.ts DemoVertical out/shackleton-demo-es-vertical.mp4 --crf=18
```

```bash
npx remotion render src/index.ts DemoEN out/shackleton-demo-en.mp4 --crf=18
```

```bash
npx remotion render src/index.ts DemoVerticalEN out/shackleton-demo-en-vertical.mp4 --crf=18
```

Vista previa y ajustes en vivo: `npm run dev` (Remotion Studio).

## Notas

- Licencia de Remotion: gratis para personas y equipos de hasta 3; el equipo Halo Sur son 4. Revisar
  https://www.remotion.dev/docs/license antes de uso fuera del reto.
- Sin logos de NASA: solo se nombra el reto y la fuente de datos (DONKI), como en el juego.
- La skill oficial de Remotion para agentes se instaló con `npx skills add remotion-dev/skills` (repo
  `github.com/remotion-dev/skills`).
