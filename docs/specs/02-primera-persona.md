# Spec 02 — Mundo en primera persona (`src/scene`)

**Lee `docs/ARTE.md` antes.** Esta spec dice qué construir; ARTE dice cómo debe verse y sentirse.

## Estado actual

`world.ts` es un prototipo: suelo con senos, 4 módulos cilíndricos, sol direccional, caminar con
pointer lock, colisión circular, detección de módulo cercano y tecla `E`. `Scene.tsx` lo monta y
lo conecta al store. Sirve para probar; casi todo se reemplaza siguiendo el orden de ARTE §11.

## Estructura objetivo

```
scene/
  Scene.tsx        isla Preact: monta, conecta con el store, muestra retícula y avisos
  world.ts         orquesta: renderer, bucle, redimensionado, dispose
  player.ts        movimiento, salto con g lunar, balanceo, colisiones
  terrain.ts       geometría procedural + shader de regolito (acepta heightmapUrl)
  base.ts          módulos, refugio, panel solar, rover (acepta GLB opcional)
  sky.ts           sol, Tierra, estrellas nocturnas, tinte de tormenta
  effects.ts       partículas y postprocesado
  interact.ts      puntos de interacción (módulos, refugio, rover) y "mantener E"
  quality.ts       detección de WebGL, calidad automática por FPS
```

## Distribución de la base

Zona plana de ~40 m. Cuatro módulos en cuadro unidos por pasillos, **refugio** en el centro
(semienterrado, cubierto de regolito: así se blindan las bases reales), panel solar y rover al sur.
El jugador empieza afuera, mirando la base con la Tierra detrás: es la primera imagen del juego.
Cualquier punto de interacción queda a menos de 10 s caminando desde el centro.

## Contrato con el store (lo único que la escena conoce)

Lee: `game` (día, plan del último día, módulos rotos, `shelterToday`, `pendingEvent`), ajustes de
calidad y movimiento reducido. Escribe: `nearTarget`. Llama: `interact(targetId)`.

| Estado | Reflejo en el mundo |
|---|---|
| `getLight(día)` | Altura e intensidad del sol, exposición, estrellas |
| Eficiencia de cada módulo (último plan) | Intensidad de su luz ámbar y tono de su zumbido |
| `modules[id].broken` | Luz `--alert` pulsando lento, chispas |
| `shelterToday` | Módulos de trabajo apagados, refugio en ámbar |
| `pendingEvent.kind === 'storm'` | Tinte y ruido de tormenta, baliza hacia el refugio |
| Rover enviado | El rover sale, deja huellas y vuelve |

La escena **nunca** modifica `game` ni calcula reglas.

## Robustez (P1/P2)

Sin WebGL o contexto perdido → el juego sigue con la tablet a pantalla completa. Pausar el render
con la pestaña oculta. `devicePixelRatio` ≤ 2. Liberar geometrías y materiales al desmontar.
Calidad baja automática si FPS < 30 durante 3 s (sin sombras ni postprocesado).

## Hecho cuando

Se puede caminar por toda la base a 60 FPS en un portátil normal, la noche lunar se nota sin leer
ningún número, y una captura de pantalla cualquiera respeta la paleta y la lista anti-slop de ARTE.
