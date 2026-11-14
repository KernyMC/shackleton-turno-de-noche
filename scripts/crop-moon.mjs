// Reproyecta el casquete polar sur de los mapas globales del CGI Moon Kit (NASA SVS, ID 4720)
// a una imagen cuadrada centrada en el polo, lista para el juego.
// Instrucciones completas: scripts/README-textures.md
//
// Uso:
//   node scripts/crop-moon.mjs --height ruta/ldem_16_uint.tif --color ruta/lroc_color_16bit_srgb_4k.tif
//   Opcionales: --radius 6 (grados desde el polo, por defecto 6 ≈ 180 km) --size 2048
//
// Salida (en public/textures/):
//   moon_height.png  escala de grises 8 bits (0 = punto más bajo del recorte, 255 = más alto)
//   moon_color.jpg   color LROC
//   moon_meta.json   fuente, radio en km y alturas reales en metros
//
// Proyección de salida: azimutal equidistante centrada en el polo sur. El centro de la imagen
// es el polo (cerca del cráter Shackleton); la distancia al centro es proporcional a la latitud.

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const MOON_RADIUS_KM = 1737.4;

const { values } = parseArgs({
  options: {
    height: { type: 'string' },
    color: { type: 'string' },
    radius: { type: 'string', default: '6' },
    size: { type: 'string', default: '2048' },
    out: { type: 'string', default: 'public/textures' },
  },
});

if (!values.height && !values.color) {
  console.error('Indica al menos --height o --color. Ver scripts/README-textures.md');
  process.exit(1);
}

const RADIUS_DEG = Number(values.radius);
const SIZE = Number(values.size);
const OUT = resolve(values.out);
await mkdir(OUT, { recursive: true });

/** Lee un mapa equirectangular global (360° × 180°, centrado en 0° de longitud) como datos crudos. */
async function readEquirect(path) {
  sharp.cache(false);
  const image = sharp(path, { limitInputPixels: false, unlimited: true });
  const meta = await image.metadata();
  const is16 = meta.depth === 'ushort' || meta.depth === 'short';
  // Sin esto, sharp convierte a sRGB de 8 bits y se pierden los valores reales de altura.
  const pipeline = is16 ? image.toColourspace(meta.channels === 1 ? 'grey16' : 'rgb16') : image;
  const { data, info } = await pipeline.raw({ depth: is16 ? 'ushort' : 'uchar' }).toBuffer({ resolveWithObject: true });
  const view = is16 ? new Uint16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length)) : data;
  return { view, width: info.width, height: info.height, channels: info.channels, is16 };
}

/**
 * Recorre la imagen de salida y, para cada píxel, calcula su latitud/longitud en el casquete
 * polar y muestrea el mapa global (bilineal en latitud, vecino más cercano en longitud).
 */
function reproject(src, channels, fn) {
  const { view, width, height } = src;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (x + 0.5) / SIZE * 2 - 1;
      const dy = (y + 0.5) / SIZE * 2 - 1;
      const r = Math.min(Math.hypot(dx, dy), 1);
      const lat = -90 + r * RADIUS_DEG;
      const lon = Math.atan2(dx, -dy) * 180 / Math.PI; // norte de la imagen = longitud 0°
      const fy = (90 - lat) / 180 * (height - 1);
      const fx = ((lon + 180) % 360 + 360) % 360 / 360 * (width - 1);
      const y0 = Math.floor(fy), y1 = Math.min(y0 + 1, height - 1), t = fy - y0;
      const xi = Math.round(fx);
      const values = [];
      for (let c = 0; c < channels; c++) {
        const a = view[(y0 * width + xi) * src.channels + c];
        const b = view[(y1 * width + xi) * src.channels + c];
        values.push(a * (1 - t) + b * t);
      }
      fn(x, y, values);
    }
  }
}

const meta = {
  source: 'NASA Scientific Visualization Studio — CGI Moon Kit (ID 4720)',
  source_url: 'https://svs.gsfc.nasa.gov/4720',
  projection: 'azimutal equidistante centrada en el polo sur',
  radiusDeg: RADIUS_DEG,
  radiusKm: Math.round(MOON_RADIUS_KM * RADIUS_DEG * Math.PI / 180),
  created_at: new Date().toISOString(),
};

if (values.height) {
  console.log(`Leyendo ${values.height}…`);
  const src = await readEquirect(values.height);
  if (!src.is16) console.warn('Aviso: el mapa de alturas no es de 16 bits; usa ldem_*_uint.tif para más precisión.');
  const raw = new Float32Array(SIZE * SIZE);
  reproject(src, 1, (x, y, [v]) => void (raw[y * SIZE + x] = v));
  let min = Infinity, max = -Infinity;
  for (const v of raw) { if (v < min) min = v; if (v > max) max = v; }
  const out = Buffer.alloc(SIZE * SIZE);
  for (let i = 0; i < raw.length; i++) out[i] = Math.round((raw[i] - min) / (max - min || 1) * 255);
  await sharp(out, { raw: { width: SIZE, height: SIZE, channels: 1 } }).png().toFile(resolve(OUT, 'moon_height.png'));
  // ldem_*_uint.tif: medios metros, desplazados +20 000 (10 km). Ver la página del CGI Moon Kit.
  if (src.is16) {
    meta.minMeters = Math.round((min - 20000) / 2);
    meta.maxMeters = Math.round((max - 20000) / 2);
    meta.height_units = 'metros respecto a una esfera de 1737,4 km';
  }
  console.log(`moon_height.png listo (${SIZE}×${SIZE}).`);
}

if (values.color) {
  console.log(`Leyendo ${values.color}…`);
  const src = await readEquirect(values.color);
  const out = Buffer.alloc(SIZE * SIZE * 3);
  const scale = src.is16 ? 1 / 257 : 1;
  reproject(src, 3, (x, y, rgb) => {
    for (let c = 0; c < 3; c++) out[(y * SIZE + x) * 3 + c] = Math.round(rgb[c] * scale);
  });
  await sharp(out, { raw: { width: SIZE, height: SIZE, channels: 3 } }).jpeg({ quality: 85 }).toFile(resolve(OUT, 'moon_color.jpg'));
  console.log(`moon_color.jpg listo (${SIZE}×${SIZE}).`);
}

await writeFile(resolve(OUT, 'moon_meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`Listo en ${OUT}. Recarga el juego: el terreno usará el relieve real.`);
