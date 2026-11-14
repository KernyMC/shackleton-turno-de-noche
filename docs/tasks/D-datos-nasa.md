# Área D — Datos NASA (`scripts`, `public/data`)

Spec: `docs/specs/04-datos-nasa.md`. Regla de oro: **`verified` solo si lo comprobaste en la fuente
y guardaste la URL.** Esta área no necesita programar mucho: sirve para alguien que investiga bien.

## D-01 · Tormentas reales (P1)
- **Archivos:** `scripts/fetch-nasa.ts`, `public/data/storms.json`.
- **Situación:** el script existe, pero la API respondió 404 el 14-11-2026 (ver spec, "Estado de la descarga DONKI"). Empieza por ahí.
- **Hecho cuando:** `storms.json` tiene ≥ 10 eventos reales con fecha, clase, nivel y enlace, y el archivo está subido al repo. Si es imposible: `storms_sample.json` simulado y nota en `DECISIONES.md`.

## D-02 · Fuentes y datos curiosos (P1)
- **Archivos:** `public/data/sources.json`, `public/data/facts.json`.
- **Hacer:** una ficha por cada número que ve el jugador (batería, soporte vital, comida, dosis, luz, tormentas). 8–10 datos curiosos y 4 tarjetas "Así lo resuelve una misión real" (energía para la noche, refugios, hielo lunar, reciclaje de agua y aire), en ES y EN, cada uno con URL de NASA. Un toque ecuatoriano donde encaje.
- **Hecho cuando:** ningún texto educativo carece de fuente; frases de máximo 2 líneas, para 10–15 años.

## D-03 · Contrastar el balance (P1)
- **Depende de:** D-02.
- **Hacer:** buscar en el BVAD de NASA el consumo diario por persona de oxígeno, agua y comida, y una referencia de dosis en superficie lunar. No hace falta que el juego use el número exacto: la ficha explica el valor real y por qué el juego lo simplifica. Cambiar `status` solo donde corresponda.

## D-04 · Elevación real (P2)
- **Depende de:** B-01. Recorte pequeño (≤ 1 MB) de elevación del cráter Shackleton (LRO LOLA / CGI Moon Kit) en `public/terrain/`, pasado a `terrain.ts` por `heightmapUrl`. Citar en `CREDITS.md`.
