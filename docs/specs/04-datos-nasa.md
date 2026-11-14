# Spec 04 — Datos de NASA (`scripts`, `public/data`)

## Principio

El juego **no llama a ninguna API**. Un script descarga los datos una vez, los guarda como JSON en
`public/data/` y se suben al repositorio. Así la demo funciona sin internet y sin límites de la API.

Cada dato lleva `status`:

| `status` | Significa | Se muestra como |
|---|---|---|
| `verified` | Sale de una fuente NASA citada, con enlace | "Dato verificado" |
| `simulated` | Inventado mientras conseguimos el real | "Dato simulado (temporal)" |
| `game_balance` | Decisión de diseño para que el juego sea jugable | "Decisión de diseño del juego" |

**Nunca marcar `verified` algo que no se comprobó en la fuente.** Un jurado puede preguntar.

## Fuentes previstas

| Dato | Fuente | Cómo | Archivo | Tarea |
|---|---|---|---|---|
| Tormentas solares (fecha, clase) | NASA DONKI, fulguraciones (FLR) | `npm run fetch:nasa` | `storms.json` | D-01 |
| Consumo de agua, oxígeno y comida por persona | NASA BVAD (Baseline Values and Assumptions Document) | Manual, citando tabla y página | `balance.json` + `sources.json` | D-03 |
| Dosis de radiación en superficie lunar | Publicaciones NASA / LRO CRaTER | Manual, con cita | `sources.json` | D-03 |
| Elevación del polo sur (cráter Shackleton) | LRO LOLA / NASA SVS CGI Moon Kit | Descarga manual de un recorte pequeño | `public/terrain/` | D-04 (P2) |
| Datos curiosos y tarjetas del debrief | Páginas oficiales de NASA (Artemis, ECLSS, hielo lunar) | Manual, cada uno con URL | `facts.json` | D-02 |

Antes de usar cualquier fuente, revisa también la lista de recursos oficiales del reto en la web de
Space Apps: usar los que NASA recomienda suma puntos.

## Estado de la descarga DONKI (importante)

`scripts/fetch-nasa.ts` está escrito, pero **el 14-11-2026 `https://api.nasa.gov/DONKI/FLR`
respondió 404**. No se llegó a determinar si es una caída temporal o un cambio de ruta. Quien tome
D-01 debe:

1. Volver a probar `npm run fetch:nasa`.
2. Si sigue fallando, buscar la URL vigente en https://api.nasa.gov (sección DONKI) y en la página de DONKI del CCMC, y corregir la constante `url` del script.
3. Si no hay forma, crear `storms_sample.json` con `status: "simulated"` y dejarlo dicho en `DECISIONES.md`.

Clave de API: copia `.env.example` a `.env` y pon tu clave gratuita de https://api.nasa.gov
(`DEMO_KEY` funciona, con pocas peticiones por hora). `.env` no se sube al repositorio.

## Mapeo clase → nivel del juego

La clase de rayos X de una fulguración (M, X) **no es** la escala S de tormentas de radiación. El
script la usa solo para ordenar eventos reales por intensidad: M5+ → S1, X<4 → S2, X4–X7.9 → S3,
X8+ → S4. La fecha y la clase son reales (`verified`); el mapeo y la dosis en mSv son
`game_balance`. La ficha de fuente debe decir ambas cosas.

## Formato de `sources.json`

```json
{
  "version": 1,
  "sources": {
    "nasa_donki_flr": {
      "name": "NASA DONKI — fulguraciones solares",
      "url": "https://kauai.ccmc.gsfc.nasa.gov/DONKI/",
      "status": "verified",
      "explain_es": "Fechas y clases de fulguraciones solares reales registradas por NASA.",
      "explain_en": "Dates and classes of real solar flares recorded by NASA."
    }
  }
}
```
