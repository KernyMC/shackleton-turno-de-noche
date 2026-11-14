# Área D — Datos NASA

Carpetas: `scripts/fetch-*.ts`, `public/data/`. Spec: `docs/specs/04-datos-nasa.md`.

**Regla de oro:** `status: "verified"` solo si abriste la fuente, viste el dato y guardaste la URL
exacta. Si no lo encuentras, queda `simulated` y se dice. **Nunca inventar una cifra, una cita ni
una URL**; un agente de IA que no pueda abrir la página debe dejarlo como pendiente, no rellenarlo.

---

## D-01 · Tormentas reales — **HECHA (14-11-2026)**

- `npm run data:donki [año]` (`scripts/fetch-donki.mjs`) descargó 2024: 1631 eventos CME y SEP; se guardan los 492 de nivel ≥ 2 en `public/data/storms_real.json` (subido al repo).
- Proxy en vivo `/api/spaceweather` (`functions/api/spaceweather.ts` + `src/server/spaceweather.ts`), caché 1 h, tiempo máximo 5 s y respaldo. El menú muestra "Hoy el Sol está activo" y la primera tormenta usa el evento real.
- **FLR (fulguraciones) da 404 en api.nasa.gov**; el código ya lo soporta y entrará solo si NASA lo arregla.
- Mapeo de niveles: `src/data/donki.ts` y `DECISIONES.md`.

### Texto original de la tarea (referencia)

**Situación:** `scripts/fetch-nasa.ts` está escrito. El 14-11-2026 `https://api.nasa.gov/DONKI/FLR?startDate=…&endDate=…&api_key=DEMO_KEY` respondió **404**; no se determinó la causa. `public/data/storms.json` contiene hoy 8 tormentas **simuladas**.

**Pasos**
1. `npm run fetch:nasa`. Si funciona, saltar al paso 4.
2. Si falla: abrir https://api.nasa.gov, buscar la sección DONKI y leer la URL vigente del servicio de fulguraciones (FLR). Probarla en el navegador. Alternativa: la página de DONKI del CCMC de NASA Goddard, que documenta su propio servicio web.
3. Corregir la constante `url` del script (y la forma de los campos si cambió: el script espera `flrID`, `beginTime`, `peakTime`, `classType`, `sourceLocation`, `link`).
4. Comprobar el resultado: `storms.json` con `"status": "verified"`, `"simulated": false` y ≥ 10 tormentas con `id`, `date`, `classType`, `level`. Si salen menos de 10, ampliar el rango con las variables `NASA_START` / `NASA_END`.
5. `npm test` debe seguir pasando (el motor solo usa `level`). Subir el JSON al repo.

**Formato obligatorio** (el motor lo valida al cargar):
```json
{ "simulated": false, "version": 1, "status": "verified", "source_id": "nasa_donki_flr",
  "storms": [ { "id": "...", "level": "S2", "date": "2024-05-10", "classType": "X3.9", "link": "..." } ] }
```
**Si es imposible:** dejar el archivo simulado como está y anotarlo en `DECISIONES.md`. El juego ya muestra "Tormenta de ejemplo (simulada)" en ese caso.

---

## D-02 · `sources.json` y `facts.json` (P1)

**`public/data/sources.json`** — una ficha por cada número que ve el jugador. Claves obligatorias:
`battery`, `solar`, `life_support`, `food`, `dose`, `dose_limit`, `storms`, `light`.
```json
{ "version": 1, "sources": { "life_support": {
  "name_es": "Soporte vital", "name_en": "Life support",
  "explain_es": "Aire y agua para 4 personas. El reciclador recupera casi toda el agua, como en la Estación Espacial.",
  "explain_en": "...", "status": "game_balance",
  "source_name": "NASA — ...", "url": "https://..." } } }
```

**`public/data/facts.json`** — dos listas:
- `facts` (8–10): datos curiosos de una frase para los mensajes de la Tierra. Al menos 2 con referencia ecuatoriana comprobable (por ejemplo, comparar con el Chimborazo).
- `missions` (4 tarjetas "Así lo resuelve una misión real"), con `id` fijo: `night_power` (energía para la noche lunar), `storm_shelter` (refugios contra tormentas solares), `lunar_ice` (hielo en cráteres del polo sur), `recycling` (reciclaje de agua y aire). Cada una: `title_es/en`, `text_es/en` (máx. 2 frases), `source_name`, `url`, `status`.

Tono: 7–12 años, frases cortas, sin jerga. Buscar primero en la lista de recursos oficiales del reto en la web de Space Apps y en páginas de nasa.gov (Artemis, ECLSS, LRO, VIPER/hielo lunar).

**Hecho cuando:** ningún texto carece de `url`; ambos JSON son válidos; ES y EN completos.

---

## D-03 · Contrastar el balance con fuentes NASA (P1)

**Depende de D-02.** Buscar en el *Baseline Values and Assumptions Document* (BVAD) de NASA el
consumo diario por persona de oxígeno, agua potable y comida, y una referencia publicada de dosis
de radiación en la superficie lunar. No hace falta que el juego use el número real: en la ficha
de `sources.json` se escribe "El valor real es X (fuente); el juego usa una escala de 0 a 100 para
que sea fácil de leer". Solo entonces `status` pasa a `verified` **para la explicación**, y el valor
del juego sigue siendo `game_balance`. No cambiar números de `balance.json` (rompería el balance probado).

## D-04 · Terreno real (P2) — código listo

Solo falta seguir `scripts/README-textures.md` (descargar del CGI Moon Kit, correr `scripts/crop-moon.mjs`, subir `public/textures/`). `src/scene/terrain.ts` ya los carga si existen.

## D-05 · Modelos 3D (P2) — código listo

Seguir `scripts/README-models.md` y poner `public/models/lander.glb` y `rover.glb` (< 2 MB cada uno). `src/scene/base.ts` ya los carga si existen.

## D-06 · BVAD (P1)

Rellenar la tabla "Valores del BVAD por completar" de `DECISIONES.md` con valor y página. Después: `balance.json` con `status: "verified"` en esos campos, `npm run simulate`, y ajustar solo factores de escala hasta cumplir los objetivos de balance. No inventar valores.

### Texto original de D-04

**Depende de B-01.** Recorte de elevación del cráter Shackleton (LRO LOLA o CGI Moon Kit de NASA
SVS), convertido a PNG en escala de grises de 512 × 512 (≤ 1 MB) en `public/terrain/shackleton.png`,
pasado a `createTerrain({ heightmapUrl })`. Citar producto, URL y fecha en `CREDITS.md` y `sources.json`.
