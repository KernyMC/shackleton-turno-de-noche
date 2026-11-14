# Dominio: maqueta 3D (`src/scene/**`)

Referencia profunda extraída del código el 2026-11-14; ante la duda manda el código. Reglas operativas: `.claude/rules/escena.md`. Arte: `docs/ARTE.md` (obligatorio antes de trabajo visual). Todo cambio pasa por `hud` y `qa` antes del commit.

## 1. Propósito y regla
La maqueta es la base lunar viva: **solo REFLEJA estado y avisa de toques** (`onHover`, `onSelect`). Nunca calcula reglas ni importa del motor más que lecturas puras (`getLight`, `isUnlocked`, `pickQuip` en `Scene.tsx`/`quipRules.ts`). Lo que necesita llega por la API de `World` desde los `effect` de `Scene.tsx`. Three.js puro dentro de `world.ts`; Preact solo en `Scene.tsx`. Hay **dos** mundos: `Menu.tsx` crea el suyo (portada/fila/vuelo) y `Scene.tsx` otro para la partida (`createWorld` se importa con `import('./world')` para no bloquear el menú). Sin WebGL el `catch` marca la pantalla lista y el juego sigue por el panel.

## 2. Mapa de archivos
| Archivo | Qué hace | API pública |
|---|---|---|
| `Scene.tsx` | Isla Preact: monta el mundo y traduce `signals` → llamadas; tecla `Tab` abre el panel; rótulo `.scene__hint/.scene__label` | `Scene()` |
| `world.ts` (1079 l.) | Renderer, cámara, luces, bucle, calidad adaptativa, picking, presentación | `createWorld(container, cb): World`, `WorldCallbacks`, `CrewLineupMember` |
| `base.ts` | Módulos (GLB + forma procedural), refugio, nave, rover, pasillos instanciados, rutas, anillos, rótulos | `createBase(heightAt)`, `MODULES`, `MODEL_URLS`, `MODULE_MODEL_URLS`, `LANDER_SPOT`, `ModuleVisualState` |
| `modules.ts` | Silueta propia de cada módulo (respaldo) y rótulo con ícono | `buildModuleShape`, `createModuleLabel`, `MODULE_TOP` |
| `construction.ts` | Andamios de módulo bloqueado (una malla fusionada por módulo) | `createScaffold(id, mat).setBuild(0..1)`, `createScaffoldMaterial` |
| `terrain.ts` | Terreno procedural (o CGI Moon Kit si `optional-assets.json.terrain`; hoy `false`) | `createTerrain`, `TEXTURE_URLS`, `.heightAt`, `.ready` |
| `sky.ts` | Cielo negro, estrellas con Vía Láctea, Tierra (esfera con `ShaderMaterial`) | `createSky`, `EARTH_SKY`; `update(sun,storm)`, `setHero`, `setLift`, `setDetail` |
| `astronaut.ts` | Astronauta «juguete»: geometrías fusionadas y compartidas | `createAstronaut(color, phase)`: `setPose`, `hop`, `setWalking`, `setLamp`, `setGlint`, `setFocus`, `hands`, `update` |
| `crewWalk.ts` | Tripulación en los pasillos: rutinas, reacciones, refugio, reparación | `createCrewWalk(routes, members)` |
| `crewProps.ts` | Accesorios de rol (panel, jardinera, dosímetro, caja de herramientas) | `createCrewProps(scale)` |
| `crewQuips.ts` + `quipRules.ts` | Globo de texto (2 sprites en reserva) y reglas de qué decir | `createCrewQuips`, `pickQuip(before,g)` |
| `energyFlow.ts` | Paneles solares, batería de 5 celdas, rayos y partículas; polvo en paneles | `createEnergyFlow`: `setSun`, `setBattery`, `play`, `setDust`, `setTier` |
| `repairFx.ts` | «¡CLANK!/¡SHUUANK!», chispas, destello verde y ✓ | `createRepairFx`: `play(id)`, `setLabels` |
| `alarmFx.ts` | Baliza roja giratoria + humo por módulo averiado | `createAlarmFx`: `setBroken`, `setTier` |
| `stormFx.ts` | Brillo violeta, lluvia de rayas, domo del refugio, «+X mSv» | `createStormFx`: `setStorm`, `burst`, `showDose`, `setCrewSource`, `setSun`, `setTier`, `dim` |
| `dust.ts` | Motas de polvo flotando (adorno) | `createDust`: `setDensity`, `update` |
| `rocket.ts` | Cohete de la portada | `createRocket` |
| `bridge.ts` | Puente a la UI | `sceneBridge.project(id)`, `sceneBridge.centerOn(id)` |
| `assets.ts` | Lee `public/optional-assets.json` (evita 404) | `optionalAssets()` |

## 3. API de `World` y quién la alimenta
Métodos (una línea cada uno): `setSunlight(0..1)` luz del día · `setSunAzimuth(rad)` posición del Sol · `setModule(id,{efficiency,broken,locked})` luz/avería/obra de un módulo · `setSelected(id|null)` anillo de color · `setLabels(names)` rótulos traducidos · `setLabelsVisible` · `setShelter` · `setRoverAway` · `setRoverClean` · `setDust(dusty, puff?)` polvo en paneles · `celebrate()` aplauso · `say(crewId,text)` globo · `setStorm(bool)` tinte del horizonte · `setStormFx(level|null,{sheltered,pending})` · `burstStorm()` · `showDose(text)` · `playRepair(id)` · `setFxLabels` · `playEnergy(plan, night)` · `setBattery(0..1)` · `setViewShift(up,right)` · `centerOn(id|null)` · `projectModule(id)` → px · `setCrewState(state)` · `crewReact(id,delta,value)` · `setSkyLook(bool)` · `setReducedMotion` · presentación: `showCrew(members)`, `setIntroView('title'|'crew')`, `setCrewFocus(id)`, `flyIn(ms)` · `ready` (terreno+modelos+shaders listos) · `dispose()`.

| Estado (signal) | Llamada (effect de `Scene.tsx`) |
|---|---|
| `game`: luz del día, día, tormenta, refugio, rover, limpieza | `setSunlight(getLight)`, `setSunAzimuth((día-1)·12°)`, `setStorm`, `setShelter`, `setStormFx`, `setRoverAway`, `setRoverClean` |
| `game` + `plan`: energía por módulo, avería, bloqueo | `setModule(id,{efficiency: plan/max (0 si refugio), broken, locked: !isUnlocked})` |
| `game` anterior vs nuevo (día cerrado) | `setDust(g.dust, puff)`, `celebrate()` si hay desbloqueo, `say()` tras 700 ms (máx. 1 cada 2 días; nunca con evento, tormenta, resolución ni avance rápido) |
| `game.battery` | `setBattery` |
| `resolving` pasa a true | `playEnergy(plan, noche)`, `playRepair`, `burstStorm`, `showDose` |
| `game` ánimos, refugio, avería, reparación, rover | `setCrewState` |
| `plan` cambia con el jugador | `crewReact(id, delta, nuevo)` |
| `tabletOpen` + `focusModule` | `setSelected(tabletOpen ? focusModule : null)` |
| `tabletOpen` + ancho | `setViewShift`: cerrado 0; ≥1024 px `right = -(clamp(380..440, 28 % vw)/2/vw)`; <1024 `up = 0.27` |
| `game.pendingEvent` de avería | `centerOn(módulo roto)`; al volver, `centerOn(null)` |
| `skyView` | `setSkyLook` |
| `lang` (vía `t`) | `setLabels`, `setFxLabels` |
Callbacks de vuelta: `onHover` → `nearTarget`; `onSelect` → `interact(id)`; `onAssets` → `realAssets`.

## 4. Cámara (`world.ts`)
- Órbita casi isométrica: `ORBIT {radius 93, min 51, max 135, elevation 0.62, minElevation 0.03, max 1.1}`. FOV: juego 30° (42° si `w/h < 0.8`), presentación 46° (62° retrato); el FOV se amortigua (`damp` 3).
- Arrastrar gira y cambia elevación (`·0.004`); rueda → `radiusGoal` (±0.045/px); tras 5 s sin interacción orbita sola a 0,045 rad/s (no con movimiento reducido, ni mirando al cielo). Clic ≠ arrastre: holgura 6 px. Hover limitado a 60 ms.
- **Doble clic** (300 ms, ≤12 px) → `centerOn(id)`: el punto de mira va al módulo y el radio a 0,6×; sobre suelo vacío vuelve al centro `(0,2,0)`. Amortiguado (k=4); con movimiento reducido salta.
- **Mirar el cielo**: elevación < 0,3 levanta la mirada (smoothstep); `setSkyLook(true)` baja a `minElevation`, gira por el camino corto hacia la Tierra (`EARTH_SKY`) y la deja en el tercio superior (`SKY_EARTH_HEADROOM 0.4`); al salir restaura elevación y ángulo.
- **Desplazamiento por el panel** `setViewShift`: usa `camera.setViewOffset` (no mueve la cámara): `up` 0..0.5 de alto, `right` −0.5..0.5 de ancho, `damp` 8.
- **Presentación**: `showCrew` crea la fila (z=24, separación 2,3); `setIntroView('title')` = portada póster (`TITLE_EYE/TARGET`, Tierra grande vía `sky.setHero`, cohete); `'crew'` = fila + **desembarco** de 8 s (la tripulación baja de la nave `lander` por escalerilla y camina a la fila, escalonado); `flyIn(ms)` = camina en fila a la escotilla del refugio (0,0,6.4), la cámara sube a la vista de juego (`WALK_PART 0.62`); instantáneo con movimiento reducido o pestaña oculta.
- `projectModule(id)`: punta del módulo (+5 m sobre el suelo) en px; lo usan `Rewards` (números y cosecha).

## 5. Luz y cielo
- Sol `DirectionalLight` 0xfffaf2: intensidad `sol·5.4`; elevación `0.09 + sol·0.14` rad (≈5–13°, algo más alta que la realidad por legibilidad); azimut avanza 12°/día. `sol` es la luz del día amortiguada (`damp` 1,6; azimut 1,2; tormenta 2,5).
- Rebote del regolito: `DirectionalLight` opuesta, `sol·0.7`, sin sombras. Relleno `HemisphereLight` (0x1c2a40 / 0x5a5751), `0.75 + sol·0.65`. Tormenta: `HemisphereLight` violeta 0xb48cff, ~0,12 con respiración (0,14 fija en movimiento reducido).
- Exposición: ACES filmic, `toneMappingExposure = 1.75 − sol·0.45` (de noche sube para que la base ilumine su entorno). Fondo negro, sin niebla.
- Sombras duras: cámara ±45, `bias −0.0005`; solo el Sol proyecta.
- Tierra: esfera r=16 con `ShaderMaterial`, textura real Blue Marble Next Generation (`/textures/earth_bluemarble.webp`, NASA) con luz propia, reflejo, **nubes dibujadas por ruido en el shader (no son dato)**, mar algo desaturado y un filo fino de atmósfera; al mirar al cielo crece un 70 % (`SKY_GROW`) y queda casi centrada (`SKY_EARTH_HEADROOM 0.06`); mientras carga/si falla, textura dibujada de respaldo (`earthTexture()`, no real). Estrellas de colores con banda de Vía Láctea, tenues de día; `setDetail` quita la mitad en calidad baja.

## 6. Base
- **Módulos**: `MODULES` en `(±11, ±10)`: recycler (−11,−10), greenhouse (11,−10), shield (−11,10), workshop (11,10). GLB de `public/models/*.glb` (declarados en `optional-assets.json`, meshopt, una malla por material; ~0,7–1,25 MB cada uno, ~6,9 MB en total) con respaldo procedural (`buildModuleShape`) si falta o falla. Nave `lander` (−26,22), `rover` (22,22), refugio `shelter` central.
- **Pasillos**: `InstancedMesh` por geometría (tubo de vidrio, suelo, tiras de luz del color del módulo, anillos, collarines de esclusa); vidrio `transmission` en alta y material barato en baja/`coarse`. `setCorridorLight` los apaga de noche (30 %) y con domo.
- **Rutas**: `routes[id]` = 5 puntos desde dentro del refugio hasta dentro del módulo (`TUBE_Y − 0.62`); `crewWalk` camina por ellas.
- **Obras**: módulo `locked` → andamio (`construction.ts`), casco al 50 %, luz apagada, rótulo con candado; sin hover ni anillo pero tocable. Al desbloquear, el andamio se hunde y abre (`damp`).
- **Anillo de selección**: `RingGeometry(5.5, 6.3)` que late, del color del módulo (`setSelected`).
- **Rótulos**: sprite de lienzo con ícono por módulo (`createModuleLabel`); texto vía `setLabels`.

## 7. Tripulación
- **Modelo 3D** (`astronautModel.ts`, `public/models/astronaut.glb`, declarado como `astronaut` en `optional-assets.json`): malla con esqueleto de 3 888 triángulos y paleta 2×2 (oscuro, traje, acento = color del tripulante). `astronaut.ts` sigue calculando marcha, poses y cabeza; `syncRig()` pasa esos giros a los huesos (`drive`: giro en ejes del cuerpo llevado al marco del padre; los brazos vienen en cruz y se bajan un cuarto de vuelta). Las mallas dibujadas por código quedan ocultas (siguen sirviendo al puntero) y son el respaldo si el GLB falta. Con el modelo: ~182 llamadas de dibujo en el día 1 (antes ~332). Licencia CC-BY 4.0: el crédito en `CREDITS.md` es obligatorio.
- `astronaut.ts`: ~19 mallas por astronauta con geometrías y materiales estáticos **compartidos** (conteo de referencias); por instancia solo acento, visor y linterna. Poses `stand|crouch|reach|carry|inspect|cheer|slump` (mezcla amortiguada, instantánea con movimiento reducido); `hop()` salto de baja gravedad; `setGlint` destello del Sol en el visor (según luz y lado del Sol); sin `PointLight` de foco.
- `crewWalk.ts`: escala 0,62, 1,1 m/s. Prioridad de destino (`desiredGoal`): refugio (todos a `shield` t=0,97) > rover fuera (Lucía a `workshop`) > reparación (Lucía al módulo roto, `REPAIR_T`) > reacción al plan (`react`, enfriamiento 1,5 s por tripulante) > rutina (junto a su módulo con accesorio de `crewProps`, y ciclos deterministas por tripulante hasta el núcleo con PRNG de semilla fija). Preocupado → camina más lento; noche → linternas; `lookAt(id)` 3 s (avería); `celebrate()`; `repairBeat()`.
- `crewQuips.ts`: globo ≤6 palabras, 3,5 s, muelle amortiguado (sin rebote en movimiento reducido), 2 sprites en reserva; se oculta en presentación/vuelo. `quipRules.ts` prioridad: último día › tormenta terminó › reparado › aire bajo › vuelve el Sol › noche cerca (2 días) › batería llena › comida alta. Claves `quip.*`.

## 8. Efectos (todos con coste de dibujo cero en reposo)
| Efecto | Se dispara | Notas |
|---|---|---|
| `energyFlow` | `playEnergy` al empezar a resolver; `setBattery`; `setDust` | Rayos del Sol (no de noche) y partículas panel → batería → módulos; nube al limpiar; baja: mitad de partículas y sin rayos |
| `repairFx` | `playRepair` si `g.repairToday` | CLANK ×2 + SHUUANK, chispas con gravedad lunar, ✓ verde; en movimiento reducido solo ✓ 1 s |
| `alarmFx` | `setBroken` (vía `setModule`) | Baliza + 2 haces + halo + humo (14/10/8 por nivel); fija y sin humo en movimiento reducido |
| `stormFx` | `setStormFx` suave (aviso) / `burstStorm` ~2,5 s (resolver) / `showDose` | Rayas S1–S4 = 120/220/340/480 (×1/0,5/0,25 por nivel), un solo `LineSegments`; domo si hay refugio (`dim` baja luces) |
| `dust` | continuo | Velo de motas; densidad 1 / 0,5 / 0 |
| `construction` | `locked` | `setBuild` amortiguado |
| `quips` | `say` | ver §7 |

## 9. Rendimiento
- **Controlador de calidad** (`QUALITY_STEPS`, escalones en orden): 2× alta → 1,5× alta → 1,25× media → 1× media → 1× baja (limitado por el DPR real). Mide fps medios en ventanas de 1,5 s (no cuenta 1,2 s de calentamiento ni fotogramas >0,25 s): `<50` baja 1 escalón; `<28` baja 2; `≥56` sostenido 8 s sube 1 (si subir causó una bajada <20 s después, espera ×2, tope 120 s).
- Qué quita cada nivel: **media** → mapa de sombras 2048→1024, vidrio con transmisión a media resolución, polvo 0,5, menos humo/lluvia/partículas. **Baja** → sin sombras, vidrio barato, sin polvo, estrellas 0,5, lluvia ×0,25, energía sin rayos. `antialias` solo si DPR < 1,5 (se decide al crear).
- **Sombras bajo demanda**: `shadowMap.autoUpdate=false`; se redibujan si el Sol se mueve (>0,0015 rad), tras cambio de calidad/tamaño y cada 100 ms (33 ms en presentación/vuelo).
- **Modo ahorro**: 6 s sin interacción (fuera de presentación, vuelo y arrastre) → ~30 fps (28 ms mínimo por fotograma).
- **Pausa**: no renderiza con la pestaña oculta ni con el lienzo fuera de pantalla (`IntersectionObserver`); al volver reinicia el temporizador y el calentamiento. `dt` se recorta a 0,1 s.
- **Arranque de calidad**: no se empieza en lo más caro: el primer escalón con ratio ≤ 1,5, o el primero de calidad media si el equipo es modesto (≤ 4 núcleos, ≤ 4 GB o puntero táctil). Sube solo si sobra.
- **Terreno**: disco de anillos (`discGeometry`, 104 anillos × 176 sectores, ~36 000 triángulos, más denso en el centro) en vez de plano cuadrado (~74 000); el borde del cráter remata en una cresta irregular y cae por fuera, así el horizonte es redondo y no asoma el final de la malla.
- **Cráter Shackleton** (`SHACKLETON` en `terrain.ts`): cuenco de radio 118 y profundidad 47 centrado en (−82, −142), en la dirección de la Tierra; interior oscurecido con color por vértice (el mapa de sombras solo cubre ±45 alrededor de la base). Si mueves la Tierra (`EARTH_SKY`), revisa que siga encima del cráter.
- **Draw calls típicos** (14-nov, 1280×720, alta, día 1): 332 llamadas y ~377 000 triángulos con pase de sombras (antes del disco: ~452 000); medir con `window.__renderer.info.render.calls` (DEV expone también `__scene`, `__quality`, `__energy`, `__storm`, `__alarm`, `__repairFx`, `__quips`). El export de GLB fundió 673 piezas en 42 mallas (DECISIONES).
- Reglas: recursos compartidos a nivel de módulo; sin `new`/`.clone()` por fotograma (vectores temporales, pools, buffers fijos); sin luces dinámicas por objeto; `castShadow` solo en lo grande; `visible=false` cuando el efecto no se ve; todo sistema nuevo implementa `setTier`.

## 10. Movimiento reducido (`setReducedMotion`; la UI lo lee de `prefers-reduced-motion`)
Cámara: sin órbita automática y valores objetivo directos (`lookAt`, radio, elevación, FOV, desplazamiento). Vuelo/desembarco: instantáneos. Astronautas: poses instantáneas, sin ciclos, gestos ni `hop`; cada uno quieto junto a su módulo. `energyFlow.play` y nubes: sin efecto. `repairFx`: solo ✓. `alarmFx`: baliza fija, sin humo. `stormFx`/tormenta: brillo fijo. `crewQuips`: sin rebote. `dust`: parámetro `reducedMotion` (quieto).

## 11. Invariantes y arte
1. La escena no importa reglas ni estado del store más allá de lo que `Scene.tsx` le pasa (`Scene.tsx` es el único puente; `bridge.ts` el de vuelta).
2. Todo valor se mueve con `damp(cur,target,k,dt)` o senos; nada salta (salvo movimiento reducido).
3. Solo el Sol proyecta sombras; sombras duras y negras; relleno mínimo.
4. Ámbar = único color cálido (módulos, paneles, andamio apagado); rojo `0xff5a4d` = avería; violeta `0xb48cff` = tormenta; verde `0x7ccf8a` = reparado.
5. Sin logos de NASA; texturas/modelos reales con fuente en `public/data/sources.json`. Nada inventado marcado `verified`.
6. Recursos compartidos, cero asignaciones por fotograma, coste ≈0 en reposo.
7. Cada sistema respeta `setTier` y `reducedMotion`.
8. Tocar la maqueta es atajo: todo existe en el panel.
9. Globos y rótulos en el idioma activo (`t()`), nunca texto fijo (salvo respaldo de `fx.*`).
10. `dispose()` libera geometrías, materiales, texturas, listeners y observers.
11. El juego es jugable sin WebGL.

## 12. Deudas y trampas
- El visor embebido del asistente va a pocos fps y `dt` se recorta a 0,1 s: las animaciones se ven **lentas** ahí; verifica con capturas y `__renderer.info`, no con fps. El controlador de calidad puede bajar escalones por esa causa.
- `requestAnimationFrame`/`setAnimationLoop` se pausa con la pestaña oculta; los temporizadores de `Scene.tsx` (globos 700 ms) y de la UI no. Al volver se reinicia el calentamiento.
- GLB pesados (~6,9 MB, 93 000 triángulos): primera carga lenta en conexión mala; `ready` retiene el `Loader` (tope 8 s).
- `LineSegments` de la lluvia miden 1 px en cualquier resolución: en pantallas densas se ven finas.
- `optional-assets.json` debe declarar cada GLB: si lo declaras sin el archivo, `exists()` lo descarta; si el archivo está y no se declara, no se carga. `terrain:false` = relieve procedural (no hay Moon Kit instalado).
- Constantes de presentación en código (`SUN_STEP`, `QUIP_MIN_DAYS`, `QUIP_DELAY_MS`, `NIGHT_WARNING_DAYS=2` en `quipRules.ts`, 380–440 px del panel en `Scene.tsx`): son de presentación, pero `NIGHT_WARNING_DAYS` es un número ligado a las noches del motor: si el balance cambia, puede desfasarse (no se comprobó contra balance.json).
- Dos mundos (menú y juego) = dos renderers en el ciclo de vida: asegúrate de `dispose()` al cambiar de pantalla.
- `FONT` de `repairFx` nombra «Space Grotesk», que ya no se carga (cae a `system-ui`).
- El hover/picking usa raycast contra `pickables`; los módulos bloqueados siguen siendo tocables a propósito.

## 13. Si cambias X, revisa Y
| Cambias | Revisa |
|---|---|
| Un módulo (posición, tamaño, GLB) | `MODULES`, rutas de `crewWalk` (`REPAIR_T`, `HOME_T`), `MODULE_TOP`, `construction.DIMS`, `projectModule` (+5 m), `energyFlow` (`PANEL_X`), `optional-assets.json` |
| Luz o exposición | ARTE §4, noche y día, tormenta, `energy.setSun`, `stormFx.setSun`, capturas de las 5 fases del juego |
| Un efecto nuevo | Archivo propio, `setTier`, `reducedMotion`, `visible=false` en reposo, draw calls antes/después, `dispose`, `Scene.tsx` (enganche mínimo) |
| `world.ts` / cámara | Anclas 2D (`projectModule`, flotantes, cosecha), `setViewShift` y panel (1024), móvil/retrato (FOV 42), presentación (`Menu.tsx`) |
| Estado nuevo a reflejar | Método en `World`, `effect` en `Scene.tsx`, caso en este doc (§3); la escena no calcula la regla |
| Calidad | `QUALITY_STEPS`, `applyTier`, `base.setLowQuality`, cada `setTier`; prueba con GPU modesta o `__quality` |
| Textos de la escena | `quip.*`, `fx.*`, `module.*` en ES y EN (+ `i18n.test.ts`) |
| Textura/modelo de NASA | `public/data/sources.json`, README de scripts, `ARTE.md` §12, sin logos |
