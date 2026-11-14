# Área B — Mundo 3D en primera persona

Carpetas: `src/scene/`, `src/audio/`. Leer antes: **`docs/ARTE.md` completo** y `docs/specs/02-primera-persona.md`.

**Reglas de toda tarea de esta área**
- **Una capa cada vez.** Construir, mirar en el navegador (captura de pantalla), comparar con ARTE §1–§4 y §10, corregir, y solo entonces seguir. No generar todo de golpe.
- La escena no calcula reglas del juego ni modifica `game`: lee signals del store y llama `interact()`.
- Todo valor visual persigue a su objetivo con amortiguación: `actual += (objetivo − actual) * (1 − Math.exp(−k * dt))`. Nunca asignar de golpe ni usar `Math.random()` por frame.
- Colores exactos de ARTE §3. Three.js r187 (`three/addons/...` para controles y postprocesado); si una API falla, consultar la documentación actual en vez de suponer.
- Liberar geometrías, materiales y texturas en `dispose()`.
- Probar en **una pestaña normal de Chrome** (Pointer Lock no funciona en vistas previas embebidas).
- Verificar: `npm run check && npm run build`, 60 FPS en portátil, sin errores en consola.

**Estado actual:** `world.ts` es un prototipo de un solo archivo (suelo ondulado, 4 cilindros, sol, caminar). `Scene.tsx` lo monta. Cada tarea extrae su parte a un archivo propio; `world.ts` queda como orquestador (renderer, bucle, resize, dispose).

**Orden:** B-01 → B-02 → B-03 → B-04 → B-05 → B-06/B-07.

---

## B-01 · Terreno, sol y cielo (P0)

**Archivos:** `terrain.ts`, `sky.ts`; quitar el suelo provisional de `world.ts`.

1. **Geometría** (`createTerrain({ size: 400, segments: 256, heightmapUrl? })`): altura = fbm de 4 octavas (ruido de valor o simplex escrito en el archivo, con semilla fija) + 6–10 cráteres con perfil cuenco + borde elevado. Disco central de 45 m de radio aplanado con transición suave (`smoothstep`). Más allá de 120 m el terreno sube para formar el borde del cráter que tapa el horizonte. Exportar `heightAt(x, z)` para el jugador y los módulos.
2. **Material:** `MeshStandardMaterial` con `onBeforeCompile` (o `ShaderMaterial` con luces) color `--regolith`, `roughness: 1`, `metalness: 0`, más grano fino procedural en el fragment shader (variación de ±6 % de brillo a escala de centímetros y de metros). Sin texturas externas.
3. **Sol:** `DirectionalLight` color `--sun`, elevación 5°, `castShadow`, mapa de sombras 2048 con cámara que siga al jugador (área 80 m). Disco solar visible: esfera emisiva pequeña y lejana en la dirección de la luz. API `setSun(light01, azimut)`.
4. **Relleno:** `HemisphereLight` (`--earthshine` arriba, `--regolith-dark` abajo) intensidad ≤ 0,08. Las sombras deben verse casi negras.
5. **Cielo:** fondo `#000000`. Tierra: esfera a ~12° de elevación, tamaño aparente ~2°, shader simple azul/blanco con terminador según la dirección del sol. Estrellas: `Points` (≈1500, tamaños variados) con opacidad = `1 − light` amortiguada; invisibles de día.
6. `renderer.toneMapping = ACESFilmicToneMapping`; `outputColorSpace = SRGBColorSpace`.

**Hecho cuando:** una captura sin módulos ya parece una foto del polo sur lunar: sombras largas y negras, horizonte nítido sin niebla, la Tierra baja, ningún elemento de la lista anti-slop. `terrain.ts` acepta `heightmapUrl` aunque no se use.

---

## B-02 · Jugador (P0)

**Archivo:** `player.ts` (`createPlayer(camera, dom, { heightAt, colliders })` → `{ update(dt), position, lock(), unlock(), dispose() }`).

- Velocidad objetivo 4 m/s (Shift: 6). Velocidad real amortiguada (k ≈ 6): arranca y frena con inercia.
- Altura de ojos 1,7 m sobre `heightAt`. Salto con `Espacio`: velocidad inicial 3 m/s, g = 1,62 m/s² (≈3,7 s de vuelo, casi 3 m de alto). Al aterrizar, compresión de cámara de 6 cm que se recupera amortiguada.
- Balanceo: `y += sin(fase) * 0.03`, `fase += velocidad * dt * 1.8`; apagado en el aire y con movimiento reducido.
- Colisiones: círculos (módulos) y cajas (pasillos) en el plano XZ, resolviendo por deslizamiento (empujar fuera sobre la normal), no bloqueando en seco. Límite del mapa: radio 110 m.
- **Respaldo sin Pointer Lock:** si `lock()` es rechazado (promesa o evento `pointerlockerror`), activar modo "arrastrar para mirar" (mousedown + mousemove giran la cámara). Así funciona en vistas previas embebidas.
- Con la tablet abierta (`tabletOpen`) el jugador no se mueve.

**Hecho cuando:** moverse se siente lento y flotado (no un shooter); se rodea un módulo deslizándose; no se atraviesa nada ni se sale del mapa; funciona también en el panel de vista previa mediante arrastre.

---

## B-03 · La base (P0)

**Archivos:** `base.ts`, `interact.ts`. **Depende de B-01.**

Distribución (metros, origen = centro): reciclador (−10, −9), invernadero (10, −9), blindaje (−10, 9), taller (10, 9), **refugio** (0, 0) semienterrado y cubierto por un montículo de regolito, panel solar (0, 20), rover (14, 20). Pasillos cilíndricos unen cada módulo con el refugio. El jugador aparece en (0, 34) mirando al norte: ve la base entera con la Tierra detrás.

- Casco color `--hull`, `roughness 0.8`. Siluetas distintas para reconocerlos de lejos: reciclador = cilindro con tanques esféricos; invernadero = cúpula translúcida con brillo interior verde muy tenue; blindaje = cilindro con mástil emisor; taller = hangar bajo con portón.
- Detalle procedural: juntas de paneles (líneas oscuras por shader o `CanvasTexture` generada), banda de polvo en la base, rótulo con el nombre (`CanvasTexture`, texto de `t('module.<id>')`).
- Cada módulo: `PointLight` ámbar + franja emisiva. API `setModuleState(id, { efficiency, broken })`.
- Panel solar: mástil + panel que gira hacia el sol (amortiguado).
- Rover: chasis + 4 ruedas, API `setRoverAway(boolean)`.
- `base.ts` acepta `modelUrls?: Partial<Record<TargetId, string>>` para GLB opcionales; si no hay o fallan, geometrías simples.
- `interact.ts`: lista de puntos `{ id: TargetId, position, radius: 4 }`; cada frame calcula el más cercano dentro del radio y **además** exige que el jugador mire hacia él (producto punto > 0,5); escribe `nearTarget`; `E` → `interact(id)`.

**Hecho cuando:** cada módulo se identifica a 40 m por silueta y rótulo; cualquier punto de interacción está a menos de 10 s del centro; el aviso "Pulsa E" aparece solo al mirar el objetivo.

---

## B-04 · La escena refleja el estado (P0)

**Depende de B-03 y C-01.** En `Scene.tsx`, un `effect` de signals traduce el estado a llamadas de la escena:

| Lee | Llama |
|---|---|
| `getLight(game.day, game.difficulty)` | `setSun(light, azimut)`; azimut avanza 12° por día. Exposición: 1,0 de día → 1,8 de noche |
| `resolving` | Durante los 1,5 s, el sol se desliza a la posición del día siguiente |
| `plan` (en edición) y `lastPlan` | `setModuleState(id, { efficiency: plan[id] / maxEnergy })`: **las luces responden en vivo al mover los sliders** |
| `game.modules[id].broken` | Luz `--alert` pulsando a 1 Hz (seno); franja apagada |
| `game.shelterToday` | Invernadero y taller a 0; refugio en `--amber-deep` |
| `pendingEffects` con rover | `setRoverAway(true)` |
| `pendingEvent?.kind === 'storm'` o `stormToday` | `setStorm(true)`: tinte `--storm` en el horizonte |

**Hecho cuando:** sin mirar ningún número se sabe qué módulos tienen energía, si es de noche y si algo está averiado; mover un slider cambia la luz de su módulo al instante.

---

## B-05 · Acciones físicas de eventos (P1)

**Depende de B-04, C-04.** Ampliar `interact(target)` en el store (coordinar con área C) y la escena:
- **Tormenta:** al abrirse el evento empieza una cuenta de 25 s visible en el visor; baliza ámbar parpadeando lento sobre el refugio. `interact('shelter')` → `chooseEventOption('shelter')`. Al llegar a 0 → `chooseEventOption('work')`. La cuenta se pausa con la tablet abierta y no existe con movimiento reducido (solo botones).
- **Avería:** mantener `E` 3 s frente al módulo roto (anillo de progreso alrededor de la retícula) → `chooseEventOption('repair')` si está habilitada, o `requestRepair(id)` en días posteriores.
- **Hielo:** `interact('rover')` → `chooseEventOption('send')`. El rover sale por el sur dejando huellas (decals o geometría de rodada) y vuelve cuando llega el agua.
- La tablet sigue ofreciendo todo con botones: la acción física es un atajo, nunca la única vía.

## B-06 · Partículas, tormenta y postprocesado (P1)
`effects.ts`: polvo al caminar y aterrizar (arcos balísticos con g lunar, sin turbulencia, 40 partículas máx.); chispas en averías; tormenta = ruido de puntos blancos en pantalla (shader de pantalla completa) + tinte. `EffectComposer`: `RenderPass` → `UnrealBloomPass` (umbral 0,9, fuerza 0,5: solo emisivos) → pase propio de grano (2 %) y viñeta (15 %). Calidad baja: sin composer.

## B-07 · Sonido por proximidad (P1)
`src/audio/sfx.ts`, Web Audio sin archivos. `AudioContext` creado en la primera interacción. Capas: zumbido por módulo (oscilador + filtro; ganancia según distancia y eficiencia; tono baja con la batería), pasos (ruido filtrado pasa-bajos a 400 Hz al ritmo del balanceo), respiración suave en exterior, pitidos de radio en eventos, alarma de dos tonos en tormenta y estado crítico (una vez por día), acorde ascendente al ganar y tono descendente al perder. Respeta ajustes de sonido; se silencia con la pestaña oculta.

## B-08 · Robustez (P2)
`quality.ts`: detectar WebGL al arrancar; sin WebGL o tras `webglcontextlost` → ocultar la escena y abrir la tablet a pantalla completa con aviso único. Medir FPS 3 s: < 30 → sin sombras, sin composer, `pixelRatio` 1. Pausar el bucle con `visibilitychange`.

## B-09 · Controles táctiles (P2)
Joystick virtual abajo a la izquierda, arrastre en la mitad derecha para mirar, botones "Usar" y "Tablet". Solo si `pointer: coarse`.
