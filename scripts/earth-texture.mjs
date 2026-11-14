// Convierte la imagen Blue Marble: Next Generation (NASA Earth Observatory, dominio público) en la
// textura de la Tierra del juego: 2048×1024 WebP.
// Fuente: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry
// Archivo: world.topo.bathy.200401.3x5400x2700.jpg (enero de 2004, 5400×2700).
// Uso: node scripts/earth-texture.mjs <ruta-al-jpg-descargado>
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const input = process.argv[2];
if (!input) {
  console.error('Uso: node scripts/earth-texture.mjs <ruta-al-jpg>');
  process.exit(1);
}
await mkdir('public/textures', { recursive: true });
const out = 'public/textures/earth_bluemarble.webp';
const info = await sharp(input).resize(2048, 1024, { fit: 'fill' }).webp({ quality: 82 }).toFile(out);
console.log(`${out}: ${info.width}×${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
