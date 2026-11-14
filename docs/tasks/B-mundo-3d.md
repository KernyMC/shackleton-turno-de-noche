# Área B — Mundo 3D (`src/scene`, `src/audio`)

Spec: `docs/specs/02-primera-persona.md`. **Arte: `docs/ARTE.md` (obligatorio).**
Forma de trabajo: una capa cada vez. Constrúyela, mírala en el navegador, compárala con ARTE y solo
entonces pasa a la siguiente. Si pides ayuda a una IA, dale ARTE.md y pide **una** capa, no todo.

## B-01 · Terreno, sol y cielo (P0)
- **Archivos:** `terrain.ts`, `sky.ts`, `world.ts`.
- **Hacer:** terreno con ruido fbm + cráteres y zona de base plana; shader de regolito (grano, brillo de oposición); sol a 3–8° con sombras largas y negras; Tierra baja en el horizonte; cielo negro. `terrain.ts` acepta `heightmapUrl` opcional.
- **Hecho cuando:** una captura sin módulos ya parece la Luna y respeta paleta y lista anti-slop. 60 FPS.

## B-02 · Jugador (P0)
- **Archivos:** `player.ts`.
- **Hacer:** caminar con aceleración amortiguada, balanceo por seno, salto con g = 1,62, seguir la altura del terreno, colisiones con módulos y límites. Sin balanceo con movimiento reducido.
- **Problema conocido:** el bloqueo del mouse (Pointer Lock) falla dentro de paneles de vista previa embebidos (error `not valid for pointer lock`). Añadir respaldo: si `lock()` falla, mirar arrastrando con el mouse. Mientras tanto, probar en una pestaña normal de Chrome o Firefox.
- **Hecho cuando:** moverse se siente lento y flotado, no como un shooter; no se atraviesa nada ni se cae del mapa.

## B-03 · La base (P0)
- **Depende de:** B-01. **Archivos:** `base.ts`, `interact.ts`.
- **Hacer:** 4 módulos + refugio semienterrado + panel solar + rover, según la distribución de la spec. Detalle procedural (paneles, polvo). Puntos de interacción con aviso "Pulsa E".
- **Hecho cuando:** se distingue cada módulo de lejos por forma y rótulo; cualquier punto está a < 10 s del centro.

## B-04 · La escena refleja el estado (P0)
- **Depende de:** B-03, C-01.
- **Hacer:** tabla "Estado → reflejo" de la spec: sol y exposición por `getLight`, luz de cada módulo por eficiencia, avería en rojo lento, refugio ámbar, estrellas en la noche. Todo con amortiguación, nunca saltos.
- **Hecho cuando:** se sabe si un módulo tiene energía y si es de noche sin mirar ningún número.

## B-05 · Acciones físicas de eventos (P1)
- **Depende de:** B-04, A-03.
- **Hacer:** tormenta (25 s para llegar al refugio, baliza que guía), reparar (mantener `E` 3 s), rover (`E`, sale y vuelve dejando huellas). Todas terminan en `interact()` del store.

## B-06 · Partículas, tormenta y postprocesado (P1)
- **Archivos:** `effects.ts`. Polvo balístico, chispas, ruido de tormenta, bloom solo en emisivos, grano y viñeta. Calidad baja = sin composer.

## B-07 · Sonido (P1)
- **Archivos:** `src/audio/sfx.ts`. Web Audio generado: zumbido por módulo según energía y distancia, pasos filtrados, respiración, radio, alarma. Arranca tras la primera interacción; respeta el ajuste de sonido.

## B-08 · Robustez (P2) · B-09 · Controles táctiles (P2)
- Calidad automática por FPS, `webglcontextlost`, pausa con pestaña oculta. Joystick virtual y arrastre para mirar.
