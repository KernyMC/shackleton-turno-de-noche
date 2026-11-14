# Dirección de arte y diseño sensorial

> Este documento manda sobre cualquier decisión visual o sonora. Si algo que vas a construir no
> está aquí, elige lo que mejor encaje con la sección 1 y anótalo en `DECISIONES.md`.
> Método: contexto y referencias antes del código, construcción por capas, movimiento escrito con
> matemáticas, y casi todo generado por código (procedural) en vez de assets pesados.

## 1. La imagen en una frase

**Una fotografía Hasselblad del Apolo que puedes caminar:** luz solar dura y rasante, sombras
totalmente negras, regolito gris, y una sola cosa cálida en todo el paisaje: la luz ámbar de tu base.

Ritmo emocional de la partida:

| Tramo | Días | Sensación | Cómo se consigue |
|---|---|---|---|
| Llegada | 1–9 | Asombro, calma, control | Sol bajo y estable, sombras largas, silencio, la Tierra en el horizonte |
| Atardecer | 10–11 | Inquietud | Las sombras crecen hasta tragarse la base; el sol se hunde tras el borde del cráter |
| Noche lunar | 12–17 | Aislamiento, tensión | Negro casi total; solo ves lo que ilumina la base y tu linterna de casco |
| Amanecer | 18–20 | Alivio | Un filo de luz recorre el borde del cráter antes de tocar la base |
| Recta final | 21–30 | Dominio | El jugador ya entiende la base; la luz vuelve, las tormentas ponen el pulso |

## 2. Verdad física primero (es lo que nos separa del "espacio genérico")

En la Luna no hay aire. Eso dicta el arte:

- **No hay niebla ni neblina de distancia en el exterior.** Lo lejano se ve igual de nítido que lo cercano.
- **Sombras duras y negras.** La única luz de relleno es la que rebota del suelo y el brillo azul tenue de la Tierra.
- **Cielo negro sin estrellas** de día (la cámara está expuesta para el suelo iluminado). En la noche lunar sí aparecen estrellas, despacio: es la recompensa visual de la oscuridad.
- **El polvo no flota:** sale en arco parabólico y cae. Sin remolinos, sin humo que sube.
- **El sonido no viaja afuera.** Solo se oye lo que llega por el traje (ver sección 7).
- **Gravedad 1,62 m/s².** Salto lento y largo.

## 3. Paleta exacta

| Token | Hex | Uso |
|---|---|---|
| `--regolith` | `#8C8A85` | Suelo iluminado |
| `--regolith-dark` | `#3B3A38` | Suelo en penumbra, rocas |
| `--void` | `#000000` | Cielo y sombra exterior |
| `--earthshine` | `#101826` | Relleno de sombras (muy sutil) |
| `--hull` | `#D9D4C7` | Casco de los módulos (blanco hueso, nunca blanco puro) |
| `--amber` | `#FFB347` | Luz de la base, acento de UI. **Único color cálido** |
| `--amber-deep` | `#C9731E` | Ámbar en sombra, refugio activo |
| `--sun` | `#FFF4E0` | Luz solar directa |
| `--alert` | `#FF5A4D` | Avería, estado crítico (se usa poco, por eso se nota) |
| `--storm` | `#B48CFF` | Solo durante tormenta solar: tinte del horizonte y de la UI |
| `--ok` / `--warn` | `#7CCF8A` / `#F2D15C` | Estados; siempre con ícono + texto |

Regla 80/15/5: 80 % grises y negro, 15 % blanco hueso, 5 % ámbar. Un color nuevo necesita un motivo de juego.

## 4. Luz

- **Sol:** `DirectionalLight` a 3–8° sobre el horizonte. Recorre el horizonte a lo largo de la partida; su altura e intensidad salen de `getLight(día)`.
- **Relleno:** hemisférica mínima (`--earthshine` arriba, `--regolith-dark` abajo). Las sombras deben seguir casi negras.
- **Base:** cada módulo tiene su luz puntual ámbar con intensidad = eficiencia del plan. Un módulo sin energía se ve apagado desde lejos. **La base es el HUD.**
- **Interior:** cálido y bajo, con zonas en penumbra. Averiado → `--alert` pulsando lento (máx. 2 Hz).
- **Tone mapping** ACES Filmic, exposición ajustada por tramo (más alta en la noche para que la base brille).

## 5. Capas procedurales (todo por código)

1. **Terreno:** desplazamiento por vértice con ruido fbm + función de cráteres (cuenco, borde elevado, eyecta). Zona de la base aplanada. `terrain.ts` acepta `heightmapUrl` para sustituirlo por elevación real del polo sur (LRO LOLA).
2. **Material de regolito:** shader propio. Grano fino por ruido en el fragment shader, brillo de oposición (el suelo se aclara al mirar en dirección contraria al sol) y huellas donde pisas.
3. **Sol y Tierra:** disco solar con destello suave; la Tierra con su terminador y siempre en el mismo punto del cielo, baja en el horizonte.
4. **Módulos:** geometrías simples (cilindros, cúpulas, cerchas) con detalle procedural: paneles, remaches por normal map generado, polvo acumulado abajo. Acepta GLB opcional.
5. **Partículas:** polvo al caminar y al pasar el rover (arco balístico), chispas en la avería.
6. **Tormenta solar:** ruido tipo nieve en la imagen (los protones golpeando el sensor, como en las cámaras reales), tinte `--storm` en el horizonte, UI con interferencia.

## 6. Movimiento por matemáticas

Nada de animaciones pregrabadas ni valores que saltan.

- **Caminar:** balanceo de cabeza con seno (amplitud 3 cm, frecuencia ligada a la velocidad), más lento y flotado que en la Tierra. Aceleración y frenado con amortiguación exponencial, no velocidad instantánea.
- **Salto:** parábola con g = 1,62. Aterrizaje con pequeña compresión de cámara y polvo.
- **Todo valor visual persigue a su objetivo** con `lerp`/amortiguación: intensidad de luces, exposición, giro del panel solar hacia el sol, barras del HUD.
- **Parpadeos** con ruido suave, nunca `Math.random()` por frame.
- **Reduced motion:** sin balanceo, sin ruido de tormenta animado, transiciones instantáneas.

## 7. Sonido (Web Audio, generado)

Diseño por proximidad y medio: lo que oyes te dice dónde estás.

- **Exterior:** casi silencio. Tu respiración, pasos con filtro pasa-bajos (llegan por el traje), pitidos de radio. Las alarmas suenan por radio, no "en el aire".
- **Interior:** zumbido de la base cuyo tono depende de la energía; cada módulo tiene su timbre y se oye más fuerte al acercarte. Módulo sin energía = silencio en esa esquina.
- **Noche lunar:** el zumbido baja de tono según cae la batería.
- Música: opcional (pista ambiental generada con Suno). Si se añade, anotar licencia en `CREDITS.md`.

## 8. Interfaz diegética

- La interfaz principal es **la tablet de muñeca**: un panel dentro del mundo, no una tarjeta flotante.
- En pantalla solo queda un visor mínimo de casco: 4 indicadores finos y el día. Tipografía monoespaciada, líneas de 1 px.
- Íconos: **SVG de trazo propio**, un solo grosor. Los emojis del documento original solo se permiten en la bitácora.
- Las consolas de cada módulo muestran su estado en una pantalla física legible desde lejos.

## 9. Postprocesado (al final, con moderación)

`EffectComposer`: bloom solo sobre emisivos (umbral alto: brilla la base, no el suelo) → grano de película leve → viñeta suave. Calidad baja = sin composer.

## 10. Lista anti-slop (prohibido)

- Degradados morado/azul, neón, "glassmorphism", tarjetas redondeadas con sombra difusa.
- Campo de estrellas de día, nebulosas, planetas decorativos, lens flare exagerado.
- Niebla o humo que sube en el exterior.
- Materiales por defecto sin tocar (plástico gris brillante), luz ambiental alta que aplana todo.
- Emojis como íconos de la interfaz 3D; tipografía Inter/Roboto por defecto.
- Aberración cromática, bloom sobre toda la imagen, temblores de cámara gratuitos.
- Textos de relleno épicos. Control de Misión habla corto, cálido y concreto.
- Logos o insignias de NASA.

## 11. Orden de construcción (una capa cada vez, se revisa en pantalla antes de seguir)

1. Terreno + sol rasante + cielo. *Debe verse bien sin nada más.*
2. Sensación de caminar y saltar.
3. Módulos con su luz ámbar y la noche.
4. La escena refleja el estado del juego (energía, avería, refugio).
5. Tablet diegética y visor de casco.
6. Partículas, tormenta, sonido.
7. Postprocesado y ajuste de exposición por tramo.

## 12. Assets externos (opcionales, nunca bloquean)

Modelos GLB (NASA 3D Resources o generados con Tripo) y audio (Suno) solo como mejora sobre lo
procedural. Cada asset se registra en `CREDITS.md` con origen y licencia. Presupuesto: < 5 MB en total.

## Referencias

Fotografía de superficie de las misiones Apolo; imágenes del polo sur lunar de LRO; cine: *Moon*
(2009) y *2001* por la luz dura y el silencio. Son referencias de luz y tono, no se copia ningún diseño.
