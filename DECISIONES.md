# Decisiones

Una línea por decisión que no estaba en los documentos. Formato: fecha · decisión · motivo.

- 2026-11-14 · El juego pasa de vista orbital a **primera persona**; la gestión se hace en una tablet de muñeca. · Pedido del equipo; hace el juego más memorable sin tocar las reglas del motor.
- 2026-11-14 · Toda acción física tiene un botón equivalente en la tablet. · Celular, teclado, sin WebGL y accesibilidad.
- 2026-11-14 · Datos NASA por **descarga previa a JSON**, nunca en vivo. · La demo no puede depender de la red ni de los límites de la API.
- 2026-11-14 · Alcance recortado a un MVP de 24–36 h con prioridades P0/P1/P2 (`docs/GDD.md`). · Tiempo de hackathon.
- 2026-11-14 · Los JSON de datos se importan de forma estática en `src/sim/config.ts` en vez de cargarse con `fetch`. · El motor funciona igual en navegador, tests y scripts; cambiar datos sigue siendo editar el JSON.
- 2026-11-14 · La clase de fulguración (M/X) se convierte a nivel S1–S4 del juego con una tabla propia marcada `game_balance`. · No son la misma escala; se declara en la ficha de fuente.
- 2026-11-14 · Íconos SVG propios en la interfaz; los emojis del documento original quedan solo para la bitácora. · Dirección de arte (`docs/ARTE.md` §8).
- 2026-11-14 · Exterior sin niebla y con estrellas solo en la noche lunar. · Fidelidad física: en la Luna no hay atmósfera.
- 2026-11-14 · Dos pestañas abiertas: la última que guarda gana, sin sincronizar. · Simplicidad.
- 2026-11-14 · Versiones instaladas: Astro 7, Preact 11, Three 0.187, Vitest 5. · Las últimas al crear el proyecto.
- 2026-11-14 · **Balance de Comandante cambiado respecto al documento original:** batería 100→120, batería inicial 70→80, soporte vital inicial 75→85, comida inicial 60→75, sol máximo 60→70. Cadete: comida inicial 70→80. · Con los valores originales la jugadora prudente ganaba 0 % en Comandante (la energía total no alcanzaba). Ahora: prudente 71,3 % Comandante y 100 % Cadete; todo al reciclador 0 %; aleatoria 0 %.
- 2026-11-14 · Un solo archivo `storms.json` (simulado hoy; `npm run fetch:nasa` lo reemplaza por datos reales). · Evita importar un archivo que puede no existir.
- 2026-11-14 · El taller nunca se avería; en Cadete tampoco el reciclador. · Sin taller no se puede reparar nada; el reciclador roto en Cadete llegaría a la noche lunar.
- 2026-11-14 · El aviso de noche es siempre el día 8. · El documento decía "día 8 o 9"; fijo es más simple.
- 2026-11-14 · Reparar y enviar el rover requieren que el plan del día dé ≥ 10 al taller; si no, la acción falla y queda en la bitácora. · Así la decisión tiene coste de energía real.
- 2026-11-14 · El margen para las estrellas no cuenta la batería. · Vaciar la batería en la noche lunar es jugar bien.
- 2026-11-14 · Eventos menores aleatorios e insignias quedan sin implementar (tarea A-06, P2). · Prioridad.

## Datos reales de NASA (14-11-2026)

- 2026-11-14 · **Proxy en Cloudflare Pages Functions** (`functions/api/spaceweather.ts`); la lógica vive en `src/server/spaceweather.ts` y en local la sirve `astro.config.mjs` con la clave de `.env`. · El proyecto aún no tenía plataforma de deploy; Cloudflare era la opción pedida.
- 2026-11-14 · **Mapeo DONKI → nivel de juego** (`src/data/donki.ts`, `game_balance`): fulguración C=1, M=2, X<5=3, X5+=4 (A y B se ignoran); CME por velocidad <700 km/s=1, 700–1200=2, 1200–2000=3, >2000=4 (se usa la velocidad del análisis marcado como más preciso; si no hay, la mayor); SEP=3. Nivel n → tormenta Sn del juego (dosis de `balance.json`). "Sol activo" = algún evento de nivel ≥ 2 en los últimos 7 días. · Pedido del equipo; no es una escala científica y la ficha lo dice.
- 2026-11-14 · **FLR (fulguraciones) da 404 en api.nasa.gov** con cualquier fecha (también GST); CME y SEP funcionan. El proxy usa los tipos que respondan y lista los fallidos en `failed`; solo es `fallback` si fallan todos. · El código ya soporta FLR: cuando NASA lo arregle, entra solo.
- 2026-11-14 · `storms_real.json` guarda solo eventos de **nivel ≥ 2** (492 de 1631 en 2024) y el conteo por nivel. · Las de nivel 1 no asustan y el JSON pasaba de 250 KB a 110 KB dentro del juego.
- 2026-11-14 · Caché del proxy: 1 h si hay datos, 5 min si es respaldo. · No gastar la cuota de la API y recuperarse rápido si DONKI vuelve.
- 2026-11-14 · Tiempo máximo: 5 s el proxy (las tres consultas en paralelo comparten el límite), 4 s el cliente. · Pedido del equipo.
- 2026-11-14 · Tormenta "en vivo": sustituye solo la primera tormenta de la partida; el resto de la partida es igual que sin ella (misma semilla). · Determinismo y balance.
- 2026-11-14 · Con tormentas reales el balance no cambió (prudente 71,3 % Comandante, 100 % Cadete; reciclador y aleatoria 0 %). · Comprobado con `npm run simulate`.
- 2026-11-14 · Terreno real: reproyección azimutal del casquete polar sur (6°, ~180 km de radio) a 2048 px; escala horizontal comprimida y altura exagerada; disco de la base aplanado. · El juego mide 200 m; la ficha de fuente lo explica.
- 2026-11-14 · Modelos: Apollo Lunar Module (lander) y Space Exploration Vehicle (rover) de NASA 3D Resources. · No hay un rover lunar tipo LRV en GLB en ese repo.

## Valores del BVAD por completar (tarea 6)

El juego usa una escala de 0 a 100 % para soporte vital y comida. Para que sea `verified`, hace falta el
valor real del **NASA Life Support Baseline Values and Assumptions Document (BVAD)** y su página. Pega el
valor y la página en las columnas vacías; después se actualiza `balance.json` (`status: "verified"`), se
corre `npm run simulate` y se ajustan **solo** los factores de escala del juego para mantener el balance.

| Concepto | Dónde está en `balance.json` hoy | Valor en el juego hoy | Valor BVAD (por persona y día) | Edición y página del BVAD |
|---|---|---|---|---|
| Consumo de oxígeno | `crewConsumption.lifeSupportPerPerson` (aire + agua juntos) | 2,5 % del tanque por persona y día | | |
| Consumo de agua potable | `crewConsumption.lifeSupportPerPerson` (aire + agua juntos) | (incluido arriba) | | |
| Agua de higiene (si se usa) | (no existe todavía) | — | | |
| Comida (masa o energía) | `crewConsumption.foodPerPerson` | 1,5 % de la despensa por persona y día | | |
| Eficiencia de recuperación de agua del reciclador | `effects.recyclerLifeSupport` (indirecto) | +14 por día al 100 % | | |
| Agua que consume el invernadero | `effects.greenhouseWaterCost` | 2 por día al 100 % | | |

Cuando haya valores, la idea es: tamaño del "100 %" del tanque = N días de consumo real de 4 personas
(factor de escala, `game_balance`), y el consumo diario sale del BVAD (`verified`).

## Diversión e interfaz (14-11-2026)

- 2026-11-14 · **Se descarta caminar en primera persona.** La escena es una maqueta 3D que orbita y se toca. · `docs/NORTE.md` prohíbe "personaje caminando con físicas"; además funciona en celular y un juez lo entiende al instante.
- 2026-11-14 · **HUD con distribución de shooter** (marcador arriba, "salud" abajo izquierda, "munición" abajo derecha, dial arriba izquierda, feed arriba derecha). · Pedido del equipo: los niños ya saben leerla. Sin mira, sin efectos de daño, sin armas.
- 2026-11-14 · El HUD no captura toques y en pantallas < 900 px se pliega en una franja superior. · Que la maqueta siga siendo tocable y visible.
- 2026-11-14 · La tablet deja de ser un diálogo modal salvo durante un evento, y en pantallas estrechas es un panel inferior (56 %) en vez de pantalla completa. · El niño debe ver la luz del módulo mientras mueve el slider.
- 2026-11-14 · Recursos opcionales (texturas, modelos) se declaran en `public/optional-assets.json`. · Evita peticiones 404 en la consola cuando no están instalados.
- 2026-11-14 · Acuerdos del debate de expertos (cuenta atrás de 30 s con opción segura, un slider visible, demo de 3 minutos, sin fichas coleccionables ni rachas): ver `docs/DIVERSION.md`. · Pendiente de confirmar con niños reales.
- 2026-11-14 · Panel de planificación rediseñado según el experto UX: un solo slider visible con 4 chips, veredicto con palabra (seguro / justo / peligroso) y valores de mañana, presupuesto en una frase; se quitan "Modo ahorro" y "Todo a cero". · El equipo lo encontró demasiado complejo.
- 2026-11-14 · Guía de primera partida: bienvenida de 4 frases + 6 pasos en el día 1 que avanzan con las acciones del jugador + aviso de la noche el día 2. · Un jugador nuevo no entendía cómo se juega.
- 2026-11-14 · El blindaje se explica como "radiación de hoy: X (sin blindaje: Y)" en vez de un número negativo. · "−0,6" se leía como daño.
- 2026-11-14 · La tormenta ya no tiñe toda la escena de morado: resplandor suave y cielo violeta oscuro. · El tinte fuerte tapaba la base.
- 2026-11-14 · Debrief: el "día decisivo" es el primer día en que el recurso perdedor bajó de 25 (o la radiación pasó del 70 %), y el botón vuelve 2 días antes. · Da margen real para corregir.
- 2026-11-14 · Los 4 módulos y el refugio aceptan modelos GLB opcionales; la luz, el aro de energía en el suelo y el rótulo se conservan. · Poder usar modelos generados sin perder la lectura de la energía.
- 2026-11-14 · Menú: la maqueta 3D del juego de fondo (decorativa, sin rótulos), dos tarjetas de misión con 3 diferencias leídas de `balance.json`, Cadete marcada "Empieza aquí". · Enganchar en segundos y elegir sin leer mucho.
- 2026-11-14 · Modelos 3D hechos en Blender **por script** (`scripts/blender/build_models.py`, sin abrir la ventana) y exportados a GLB; las piezas con material `glow` se encienden con la energía. · Más detalle que las formas de Three.js, reproducible y sin depender de servicios de pago.
- 2026-11-14 · Los 7 modelos de la base se recrean en Blender por script a partir de imágenes de referencia del equipo; materiales `glow` (energía) y `glass` (transparente) los interpreta el juego. Metales poco espejados porque la escena no tiene entorno que reflejar. · Aspecto propio, reproducible con un comando y sin licencias dudosas.
- 2026-11-14 · Texturas de los modelos **generadas por código** (`scripts/blender/textures.py`): paneles acolchados con juntas y remaches, polvo en la base, metal cepillado, lámina dorada, tela de saco y regolito, con mapa de relieve; exportadas en WebP dentro de cada GLB. · Acercarse a las referencias del equipo sin depender de imágenes externas.
- 2026-11-14 · Al exportar, cada modelo se une en una malla por material (de 673 piezas a 42 en total; 93 000 triángulos; 6,7 MB). · Menos órdenes de dibujo: importa en portátiles modestos y celulares.
- 2026-11-14 · Pantalla de inicio "Conoce a tu tripulación": cuatro personajes originales ligados a un módulo (Valeria/Reciclador, Mateo/Invernadero, Amaru/Blindaje, Lucía/Taller), astronautas hechos con geometrías de Three.js y vuelo de cámara de 1,5 s (instantáneo con movimiento reducido o pestaña oculta). Nombre de comandante opcional, máx. 20 caracteres, guardado en el navegador. · Plan P1 del equipo para que el jugador se encariñe con la tripulación.
- 2026-11-14 · Pasillos con esclusa en cada extremo (entran en el refugio y en el módulo), anillos estructurales y apoyos al suelo. · Los tubos se veían cortados contra el centro.
- 2026-11-14 · Inicio en dos pasos: portada estilo póster (tripulación de cerca, Tierra grande, cohete con estela, logo abajo a la derecha, un solo botón) y luego la fila de la tripulación con nombre y dificultad. · Pedido del equipo con referencias visuales; todo es original.
- 2026-11-14 · Al empezar, la tripulación camina en fila hasta la escotilla del refugio y entra; después la cámara vuela a la base (3,6 s; instantáneo con movimiento reducido o pestaña oculta). · La transición anterior no mostraba que entraban.
- 2026-11-14 · Panel de energía gráfico: barra de reparto por colores, cuatro columnas que se llenan por bloques de 5 (clic, −/+ o teclado) y un sello con tres medidores de mañana. · El panel con frases se veía genérico.
- 2026-11-14 · El módulo elegido se marca con un anillo de su color en la base y su columna se resalta en el panel. · No se sabía qué estaba seleccionado.
- 2026-11-14 · Borde del cráter más bajo, estrellas de colores con banda de Vía Láctea (tenues de día, plenas de noche) y botón "Mirar el cielo"; arrastrar hacia abajo también levanta la mirada. · Más cielo e inmersión; las estrellas de día son una licencia artística.
- 2026-11-14 · Barra de desplazamiento propia (fina, oscura, ámbar al pasar). · Pedido del equipo.
- 2026-11-14 · G-P2: el mini-panel flotante junto al módulo se sustituye por el anillo 3D más la columna resaltada del panel de energía (versión simple). XP solo visual, sin monedas ni temporizadores; la cosecha se recoge sola a los 3 s. · Regla de los 30 min y no bloquear el avance.

- 2026-11-14 · G-P3 escena: cámara de juego casi isométrica (FOV 30, 42 en vertical, radio ×1.5) y polvo sutil flotando (src/scene/dust.ts), que en la Luna no tendría aire: licencia artística. · Look de maqueta y más vida en la escena.
- 2026-11-14 · Interfaz rehecha con los expertos de UX y gamificación: barra superior única, planificador como panel lateral derecho (hoja inferior en <1024 px), recursos en una tarjeta con la cara de quien los cuida, registro corto que se desvanece y un solo botón principal. · La base debe verse siempre; un canal por hecho.
- 2026-11-14 · La tripulación habla en una burbuja con retrato: solo si alguien está preocupado o un día de cada dos; sustituye al aviso "Día N completado". El XP deja de mostrarse en el HUD. Confeti solo al superar la noche lunar. · Una voz que habla siempre se vuelve ruido.
- 2026-11-14 · Al ejecutar, el panel se aparta ~1,9 s para que se vea la base reaccionar (números módulo a módulo con su nota) y cada día arranca con el plan de ayer ajustado a la energía de hoy. · Se corrige el plan, no se rehace cada día.
- 2026-11-14 · Debrief corto y amigable: escena con el título encima, un tripulante explica la causa en una frase con un consejo, barra del viaje de 30 días, botón grande de reintentar y tres datos; la gráfica, la tabla y las decisiones quedan plegadas en "Ver mi misión en detalle". · Los principiantes no analizan una página larga.
- 2026-11-14 · Modelos 3D con IA local (ComfyUI, Z-Image Turbo y Hunyuan3D 2.1) como vía **experimental**: el resultado va a `public/models/experiments/` y no sustituye a los 7 modelos de Blender, que tienen textura y paleta de ARTE. Malla con umbral 0,6 y remallado por vóxeles antes de reducir (sin eso Decimate se atasca). · Forma base barata para bloquear piezas; la licencia de Hunyuan3D queda por revisar antes de usarla en la entrega.
- 2026-11-14 · La antena: el Taller (con `workshopMinEnergy` ayer y sin avería) también avisa de las tormentas `events.warningDays` (2) días antes; sin antena, sorpresa. Es solo información (`src/sim/comms.ts`), el balance no cambia. · El reto pide decidir con retraso de comunicación; en la Luna el retraso real es ~1,3 s, así que el coste es la energía del Taller, no un retraso inventado.
- 2026-11-14 · RadLab: la cifra de radiación de la ISS es la media de abril de 2022 del instrumento Lidal (dosis absorbida, µGy/hora tal como la publica la API; ×24 para µGy/día). Se muestra en el debrief solo como comparación; no toca el balance ni se mezcla con los mSv del juego. · La API no da mSv ni dosis equivalente para esos instrumentos, y no hay que inventar la conversión.
- 2026-11-14 · Fichas OSDR: la frase para niños dice solo lo que respalda el título (y el resumen en OSD-772); enlaces a `osdr.nasa.gov/bio/repo/data/studies/OSD-xxx` (comprobados con HTTP 200). OSD-73 es un estudio en tierra con partículas de laboratorio, por eso la frase no dice "en el espacio" de las células. · Honestidad científica.
- 2026-11-14 · Datos de comida: tomados de la página de la CSA "Growing healthy food in space and remote areas" (la del kit de herramientas solo enlaza), atribuidos a la CSA y no a NASA. · La página del kit no trae cifras explícitas.
- 2026-11-14 · Tarjeta "Ciencia real" dentro de `db-more` (plegado) para no alargar el debrief; si faltan los JSON no aparece. · Debrief corto para principiantes.
- 2026-11-14 · Público oficial: 7–12 años (texto del reto). Reglas de escritura en NORTE.md y pasada de textos: frases cortas y términos (radiación, mSv, tormenta solar) explicados donde aparecen. · Antes el proyecto decía 10–15 por error.
- 2026-11-14 · Etiqueta de las fuentes verificadas: «Dato real» (no «Real de NASA»), porque también hay datos de la Agencia Espacial Canadiense. La tarjeta «Ciencia real» va visible en el debrief, no plegada. · Honestidad de procedencia y que los jueces la vean.
