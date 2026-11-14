# Terreno real: CGI Moon Kit (NASA SVS)

El juego funciona sin estos archivos (terreno procedural). Si los pones, el suelo usa el **relieve
y el color reales del polo sur lunar**, y la ficha de fuente `cgi_moon_kit` se activa.

Fuente: **CGI Moon Kit**, NASA Scientific Visualization Studio, ID 4720 — https://svs.gsfc.nasa.gov/4720
Crédito obligatorio: "NASA's Scientific Visualization Studio". (Datos: LOLA DEM y mosaico de color LROC WAC.)

## 1. Descargar (de la página anterior)

| Para | Archivo | Tamaño | Por qué |
|---|---|---|---|
| Relieve | `ldem_16_uint.tif` | 31,7 MB · 5760×2880 · 16 bits | Buen equilibrio. Valores en medios metros, desplazados +10 km |
| Relieve (más detalle) | `ldem_64_uint.tif` | 506 MB · 23040×11520 | Solo si tienes tiempo y RAM (≥ 8 GB) |
| Color | `lroc_color_16bit_srgb_4k.tif` | 59 MB · 4096×2048 · 16 bits | Versión 2025, con más detalle en los polos |
| Color (alternativa ligera) | `lroc_color_poles_4k.tif` | 12,5 MB · 4096×2048 · 24 bits | Versión 2019 |

Guárdalos **fuera del repo** (por ejemplo en `Descargas/`); no se suben.

## 2. Recortar el polo sur y bajar a 2048 px

Los mapas son globales (cilíndricos, 360° × 180°). El polo sur ocupa la fila inferior, muy
deformada, así que no basta con recortar: hay que **reproyectar**. El script lo hace:

```bash
node scripts/crop-moon.mjs --height "C:/Users/TU_USUARIO/Downloads/ldem_16_uint.tif" --color "C:/Users/TU_USUARIO/Downloads/lroc_color_16bit_srgb_4k.tif"
```

Opciones: `--radius 6` (grados desde el polo; 6° ≈ 180 km de radio, por defecto) y `--size 2048`.
Tarda alrededor de un minuto. Escribe en `public/textures/`:

- `moon_height.png` — alturas en gris (8 bits)
- `moon_color.jpg` — color
- `moon_meta.json` — fuente, radio en km y altura real mínima/máxima en metros

El script también pone `"terrain": true` en `public/optional-assets.json`; sin eso el juego no busca las texturas.

## 3. Probar y subir

`npm run dev` y abre el juego: el terreno debe mostrar el relieve real (el centro de la imagen
es el polo sur, cerca del cráter Shackleton). Si se ve bien, sube los tres archivos (pesan
pocos MB).

## Honestidad del dato

- El **relieve y el color son reales**, pero el juego **comprime la escala**: unos 180 km de radio
  caben en 200 m de juego y la altura se exagera para que se note. La ficha de fuente lo dice.
- El disco central donde está la base se aplana a propósito (las bases reales se construyen en
  terreno preparado).
- Resolución: con `ldem_16` cada píxel original mide ~1,9 km; no se ve el detalle de la zona exacta
  de aterrizaje. La página de NASA advierte que estos mapas son para visualización, no para ciencia.
