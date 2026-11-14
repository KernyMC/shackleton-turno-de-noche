# Dominio: datos de NASA y rigor científico

Referencia profunda extraída del código y los JSON el 2026-11-14; ante la duda manda el código. Cubre `public/data/**`, `scripts/fetch-*.mjs`, `scripts/check-spaceweather.ts`, `api/spaceweather.ts`, `functions/api/spaceweather.ts`, `src/server/**`, `src/data/donki.ts`, `src/state/spaceWeather.ts`, `src/components/{SourcesPanel,ScienceCard,SunStatus}.tsx`, `README.md`/`README.en.md`, `CREDITS.md`, `AI_USAGE.md`. El motor que consume estos datos está en `docs/domains/motor.md`.

## 1. Propósito y honestidad
- La rúbrica (`docs/RUBRICA.md`) pesa 50 % en rigor científico (RCD) para Best Use of Data y Best Use of Science. Preguntas: **1.1** uso evidente de datos NASA (5 = varios datasets, uso determinante y justificado), **1.2** solidez científica (nada pseudocientífico presentado como real), **1.3** procesamiento (4 = pipeline o script explicado), **1.4** dominio en las preguntas (4 = variables críticas y limitaciones), **1.5** transparencia (distinguir lo propio del soporte externo o IA).
- Penalización 1: **−2** si la ficha no cita ni enlaza datasets oficiales de NASA o agencias aliadas. También pesan #5 (logos de NASA o falta de declaración de IA) y #6 (bilingüe ES/EN).
- Regla de honestidad: todo dato lleva `status` = `verified` (fuente NASA/agencia comprobada y enlazada), `simulated` (provisional, sin fuente) o `game_balance` (decisión de diseño). Nunca `verified` sin URL comprobada. El panel "¿De dónde salen los datos?" y el debrief lo muestran con ícono + palabra, no solo color.

## 2. Mapa de datasets
| Dataset | JSON | Script que lo genera | Dónde se usa | Estado | URL fuente |
|---|---|---|---|---|---|
| Tormentas reales DONKI 2024 (CME + SEP, nivel ≥ 2: 492 de 1631) | `storms_real.json` | `npm run data:donki [-- año]` → `scripts/fetch-donki.mjs` | `sim/config.ts` (`parseRealStorms`) → calendario de tormentas | `verified` (fecha, tipo, velocidad); nivel 1–4 `game_balance` | `https://ccmc.gsfc.nasa.gov/tools/DONKI/` (API vía `https://api.nasa.gov`) |
| Tormentas de ejemplo | `storms_sample.json` | a mano | respaldo en `config.ts` si no hay `storms_real.json` válido | `simulated` | sin URL |
| Clima espacial de hoy | respuesta de `/api/spaceweather` (no es archivo) | proxy en vivo | `state/spaceWeather.ts` → primera tormenta y `SunStatus` | en vivo, opcional | DONKI (misma API) |
| Radiación en la ISS (RadLab, Lidal, abril 2022) | `radiation_iss.json` | `npm run data:radlab` → `scripts/fetch-radlab.mjs` | `ScienceCard` (debrief) | `verified` | `https://visualization.osdr.nasa.gov/radlab/gui/data-api/` |
| Estudios OSDR (OSD-73, 342, 268, 772) | `osdr_facts.json` | a mano (consulta citada en `queried`) | `ScienceCard` | `verified` | `https://osdr.nasa.gov/bio/repo/data/studies/OSD-<n>` |
| Comida en el espacio (CSA, 3 hechos) | `food_facts.json` | a mano | `ScienceCard` | `verified`, atribuido a la CSA | `https://www.asc-csa.gc.ca/eng/sciences/food-production/growing-healthy-food-in-space-and-remote-areas.asp` (kit: `.../toolkits/food-production/`) |
| Tierra (Blue Marble NG) | `textures/earth_bluemarble.webp` | `scripts/earth-texture.mjs <jpg>` | escena (cielo) | `verified` | `https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry` |
| Terreno polo sur (CGI Moon Kit) | `textures/moon_height.png`, `moon_color.jpg`, `moon_meta.json` (NO están en el repo hoy) | `scripts/crop-moon.mjs` | `scene/terrain.ts` | `verified` solo con los archivos; sin ellos `game_balance` (procedural) | `https://svs.gsfc.nasa.gov/4720` |
| Modelos NASA 3D Resources | `models/lander.glb`, `rover.glb` | ver §9 (hoy los genera Blender) | escena | ver §9 | `https://github.com/nasa/NASA-3D-Resources` |
| Consumos de soporte vital (BVAD) | `balance.json` (`crewConsumption`) | a mano | motor | `simulated` (BVAD pendiente de citar) | sin URL |
| Dosis base y de tormenta (mSv de juego) | `balance.json` (`doseBaseDaily`, `stormDose`) | a mano | motor | `simulated` (`source_id: radiacion_pendiente`) | sin URL |
| Balance, energía y secuencia de luz de 30 días | `balance.json`, `light_sequence.json` | a mano | motor | `game_balance` | sin URL |
`sources.json` (version 1) es el catálogo del panel: 12 fichas (`nasa_donki`, `storm_levels`, `storms_sample`, `cgi_moon_kit`, `nasa_3d_resources`, `bvad`, `design`, `radlab_iss`, `osdr_facts`, `csa_food`, `blue_marble`, `energy_unit`). `sfx_lines.json` no es dato científico: son prompts de efectos de sonido con IA (ElevenLabs) para `npm run sfx`.

## 3. El proxy `/api/spaceweather`
Lógica única en `src/server/spaceweather.ts` (`getSpaceWeather`, `fallbackResponse`, `responseHeaders`), usada por tres envoltorios.
- **Flujo**: sin `apiKey` → respaldo sin llamar a la red. Con clave: consulta `FLR`, `CME`, `SEP` en paralelo a `https://api.nasa.gov/DONKI/<TIPO>?startDate&endDate&api_key=` (últimos `LOOKBACK_DAYS`=30 días) con un único `AbortSignal.timeout(TIMEOUT_MS=5000)` compartido; cada tipo se normaliza con `NORMALIZERS` (`src/data/donki.ts`). Cuerpo vacío = sin eventos; HTTP no ok, red caída, timeout o JSON inválido = ese tipo falla (`failed[]`). Si fallan los tres → `{fetchedAt, active:false, events:[], fallback:true}`. Nunca lanza error y responde siempre 200.
- **Respuesta** (`SpaceWeather`): `fetchedAt`, `active` (algún evento nivel ≥ 2 en `ACTIVE_WINDOW_DAYS`=7), `events[]` (más reciente primero, a igual fecha el más fuerte, sin duplicados), `fallback?`, `failed?`, `cached?`. La clave jamás se incluye (test "nunca incluye la clave").
- **Caché**: `CACHE_SECONDS`=3600 si hay datos, `FALLBACK_CACHE_SECONDS`=300 si es respaldo; cabecera `cache-control: public, max-age=<s>`.
- **Variables**: `NASA_API_KEY` (clave gratuita de api.nasa.gov). Solo en desarrollo: `DONKI_BASE_URL` (forzar fallos) y `SPACEWEATHER_NO_CACHE=1`. `.env` lo cargan `astro.config.mjs` y los scripts con `process.loadEnvFile`; `.dev.vars` para `wrangler pages dev`; `ELEVEN_LABS` solo para `npm run sfx`.
- **Diferencias por plataforma**:
  - Dev (`npm run dev`): middleware de Vite en `astro.config.mjs`, caché en memoria (1 h / 5 min) y marca `cached:true` en aciertos.
  - Vercel (producción actual, `https://shackleton-turno-de-noche.vercel.app`): `api/spaceweather.ts`, añade `vercel-cdn-cache-control: max-age=<s>`; los aciertos de la CDN NO llevan `cached:true` (el cliente los ve como `live`). Clave en las variables del proyecto.
  - Cloudflare Pages (alternativa mantenida): `functions/api/spaceweather.ts` con `caches.default` y `waitUntil`; aciertos con `cached:true`. Variables en Settings → Variables and Secrets.
  - `astro preview`: la ruta no existe → el cliente queda `offline`.
- **Cliente** (`state/spaceWeather.ts`): `loadSpaceWeather` se lanza una vez desde `Menu.tsx`, con timeout de `CLIENT_TIMEOUT_MS`=4000. Origen: `fallback` si `fallback`, `cache` si `cached`, `live`, u `offline` ante cualquier error (silencioso para el jugador). `event` = `strongestEvent` solo si `active && !fallback`. `liveStorm()` lo convierte en `StormData` con `origin:'live'` y `store.startGame` lo pasa como `firstStorm`. `?debug=1` en la URL enseña el crudo en `SunStatus`.
- **Si falla**: el juego usa las tormentas históricas sin avisos ni errores. `npm run check:nasa` prueba tres casos (API ok, 404, sin internet) y comprueba que la salida no contiene la clave.

## 4. De evento DONKI a nivel 1–4 y dosis de juego
- **Dónde**: `src/data/donki.ts` (`flareLevel`, `cmeLevel`, `SEP_DEFAULT_LEVEL`, normalizadores) → compartido por proxy, `fetch-donki.mjs` y juego. Tests en `donki.test.ts`.
- **Reglas (decisión de diseño `game_balance`, no escala científica)**: fulguración por clase de rayos X: C=1, M=2, X<5=3, X5+=4 (A y B se descartan); CME por velocidad (km/s) del análisis `isMostAccurate` (si no, la mayor): <700=1, 700–1200=2, 1200–2000=3, >2000=4; SEP=3 fijo. Nivel n → tormenta `Sn` del juego. "Sol activo" = algún evento nivel ≥ 2 en los últimos 7 días.
- **Nivel → dosis**: `balance.json` → `stormDose.S1..S4` (mSv de juego, `simulated`) × `effects.shelterDoseFactor` si hay refugio. Qué nivel toca en cada momento lo decide `balance.events.storms[i].levels` (ver motor.md §6). Los datos reales (fecha, tipo, clase/velocidad, enlace) llegan intactos a la partida; el motor nunca cambia el nivel de una tormenta.
- **Trampa de mantenimiento**: el bloque `level_mapping` que escribe `fetch-donki.mjs` en `storms_real.json`, el texto de `sources.json` (`storm_levels`), README y CREDITS repiten el mapeo como texto; si cambias los umbrales en `donki.ts` hay que cambiarlos en los cuatro sitios y regenerar.
- Cifras de `storms_real.json` (2024): 1631 eventos, `counts_by_level` {1:1139, 2:298, 3:185, 4:9}; guardados solo nivel ≥ 2 (`min_level`) = 492; todos del tipo CME o SEP; `failed_types: ["FLR"]`.

## 5. Formato de cada JSON
- `storms_real.json`: `simulated:false`, `version`, `status`, `source`, `source_id`, `source_url`, `api`, `range{start,end}`, `fetched_at`, `failed_types[]`, `level_mapping{status,FLR,CME,SEP}`, `min_level`, `counts_by_level{1..4}`, `count`, `events[]` = `{id, type:'CME'|'SEP'|'FLR', date AAAA-MM-DD, classOrSpeed, level 1..4, link}`. `parseRealStorms` solo lo acepta con `simulated === false` y ≥ 1 evento válido (`isSpaceEvent`).
- `storms_sample.json`: `simulated:true`, `version`, `status:'simulated'`, `source_id`, `_nota`, `storms[]` = `{id, level:'S1'..'S4', date:null, classType:null}`.
- `radiation_iss.json`: `status`, `source_name`, `api_doc_url`, `query_url`, `downloaded`, `spacecraft`, `instrument_family`, `date_from`, `date_to_exclusive`, `samples` (8640), `days_with_data` (30), `unit_as_published` (µGy/hour), `mean/min/max_*_ugy_per_hour`, `mean_absorbed_dose_ugy_per_day` (= media×24, cálculo nuestro), `note`.
- `osdr_facts.json`: `status`, `source_name`, `queried`, `downloaded`, `facts[]` = `{id, related:'radiation'|'life_support'|'food', title, url, status, text_es, text_en}`.
- `food_facts.json`: `status`, `source_name`, `toolkit_url`, `downloaded`, `facts[]` = `{id, related, url, status, text_es, text_en}` (sin `title`).
- `sources.json`: `version`, `_nota`, `sources{id → {name_es/en, explain_es/en, status, source_name, url|null, files?, requires_files?, status_without_files?, explain_without_files_es/en?, note_es/en?}}`. `SourcesPanel` hace HEAD a cada `requires_files` y, si falta alguno, degrada a `status_without_files` y quita la URL.
- `balance.json`: ver motor.md; su bloque `sources` (`default`, `crewConsumption`, `doseBaseDaily`, `stormDose`) declara `source_id` y `status` por grupo de números y el motor lo ignora.
- `light_sequence.json`: `simulated:true`, `status:'game_balance'`, `source_id:'design'`, `light[30]` (0..1), `nightDays[]`.

## 6. Invariantes
1. Nunca inventar cifras, citas ni URLs de NASA. Lo que no se pueda abrir y comprobar queda `simulated` o `game_balance`; un agente que no pueda abrir la página lo deja pendiente.
2. `NASA_API_KEY` nunca en el repo ni en el navegador: vive en `.env` (ignorado por git; solo `.env.example`, sin valor, está versionado) y en las variables de Vercel/Cloudflare. Nunca leer ni mostrar `.env`; las respuestas del proxy no llevan la clave.
3. El juego funciona sin red: los datos históricos son JSON del repo; la única llamada en vivo es `/api/spaceweather`, opcional y con respaldo.
4. No presentar datos estáticos como en vivo. "Hoy" solo si `origin` es `live`/`cache` y el Sol está activo; el histórico se rotula 2024.
5. Un dato `verified` lleva `url` comprobada. Lo derivado por nosotros (×24 µGy/día, niveles 1–4, mSv de juego) se declara como cálculo o decisión propia.
6. Sin logos de NASA (penalización #5). Aviso "no afiliado ni avalado por NASA" en README y CREDITS.
7. Todo texto visible de datos va en ES y EN (`text_es`/`text_en`, `name_*`, `explain_*`, `i18n`).
8. `fetch-donki.mjs` no escribe el archivo si no obtiene eventos; `fetch-radlab.mjs` no escribe nada si la API falla.

## 7. Cómo añadir un dataset nuevo
1. Script en `scripts/fetch-<nombre>.mjs` (sin clave en la salida; si falla, no escribe) y entrada `npm run data:<nombre>` en `package.json`.
2. JSON en `public/data/<nombre>.json` con `status`, `source_name`, `downloaded`, URL de consulta y `note` con unidades tal como las publica la API. Usa `verified` solo si abriste la fuente.
3. Ficha en `public/data/sources.json` (ES y EN, `status`, `url`, `files`, `note_*` con la limitación).
4. UI: leerlo con `fetch` tolerante (la tarjeta no aparece si falta, como `ScienceCard`); textos en `src/i18n/es.json` y `en.json`; `src/i18n/i18n.test.ts` debe pasar.
5. `README.md` y `README.en.md` (tabla de datasets y "Cómo se procesan"), `CREDITS.md` (tabla Datos) y, si usó IA, `AI_USAGE.md`.
6. Si toca el motor o el balance: `npm run simulate` y `npm test`; anotar la decisión en `DECISIONES.md`.
7. `npm test && npm run check && npm run build`.

## 8. Qué decir en el pitch y en las preguntas (limitaciones honestas)
- **DONKI**: el histórico solo trae CME y SEP porque FLR (fulguraciones) devuelve 404 en api.nasa.gov (también GST); el código ya soporta FLR y entraría solo. Es un año (2024), no un catálogo completo. El nivel 1–4 y los mSv son nuestra escala de juego, no ciencia; la fecha, tipo y velocidad sí son reales. Una CME o un SEP real no implican radiación en la Luna: la conversión a dosis es decisión de diseño.
- **Tormenta "de hoy"**: solo si hay clave, red y Sol activo (nivel ≥ 2 en 7 días); si no, es histórica y el juego lo dice con el estado `origin`.
- **RadLab**: es un instrumento (Lidal) en la ISS y un solo mes (abril 2022), dosis absorbida en µGy/hora, no dosis equivalente en mSv; la ISS está en órbita baja, no en la superficie lunar. Se muestra solo como comparación y no toca el balance. El ×24 a µGy/día es cálculo nuestro.
- **BVAD**: los consumos de aire, agua y comida y las dosis base son simulados; la tabla de valores a citar sigue vacía en `DECISIONES.md`.
- **OSDR y CSA**: son fichas de 4 estudios y 3 datos elegidos a mano, con frases para 7–12 años que solo dicen lo que respalda el título o la página; los de comida son de la CSA (agencia aliada), no de NASA.
- **Luz y energía**: la secuencia de 30 días con 6 días de noche (`nightDays`) y la unidad de energía son de diseño, no efemérides ni kWh reales.
- **Terreno y modelos**: el terreno real (CGI Moon Kit) es opcional y hoy no está instalado: se juega con terreno procedural y el panel lo declara. Ver §9 sobre los modelos.
- **IA**: declarada en `AI_USAGE.md` y `CREDITS.md`; los efectos de sonido por ElevenLabs no se llaman durante la partida.

## 9. Deudas conocidas
- **Posible falso `verified` (modelos)**: `sources.json` → `nasa_3d_resources` dice que lander y rover "son modelos 3D publicados por NASA" y pasa a `verified` si existen `models/lander.glb` y `rover.glb`, pero esos GLB los genera hoy `scripts/blender/build_models.py` (`build_lander`, `build_rover`) con referencias de IA; CREDITS.md y DECISIONES.md lo reconocen. Corregir la ficha (o `requires_files`) antes de la entrega.
- `CREDITS.md` (tabla Datos) no lista RadLab, OSDR, CSA ni Blue Marble, y dice que las tipografías vienen de Google Fonts (el código usa `@fontsource`). La tabla de `README.md` sí está al día.
- `bvad` sigue `simulated` y sin URL; DONKI FLR da 404; `energy_unit`/`design` son `game_balance`.
- `balance.json` sigue con `"simulated": true` global y bloque `sources` no tipado (el motor no lo lee).
- Comentarios desactualizados: `astro.config.mjs` dice que en producción sirve Cloudflare (hoy es Vercel); CLAUDE.md regla 6 nombra solo Cloudflare Pages; DECISIONES.md aún habla de `storms.json` y `npm run fetch:nasa` (hoy `storms_real.json`/`storms_sample.json` y `npm run data:donki`).
- El mapeo de niveles está repetido como texto en 4 sitios (§4). El acierto de la CDN de Vercel no se distingue de `live`.
- `moon_height.png`/`moon_color.jpg` no están en el repo (`optional-assets.json` → `terrain:false`); `food_facts.json` y `osdr_facts.json` se mantienen a mano, sin script ni comprobación automática de enlaces.
- Pendiente del equipo (RUBRICA): repositorio público, ficha bilingüe en la plataforma, diapositivas y video.
