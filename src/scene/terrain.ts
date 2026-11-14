// Terreno lunar. Por defecto es procedural (ruido + borde de cráter). Si existen
// public/textures/moon_height.png y moon_color.jpg (recortes del CGI Moon Kit de NASA SVS,
// ver scripts/README-textures.md), se usa el relieve y el color reales del polo sur.
// La escena solo refleja: este archivo no conoce reglas del juego.

import * as THREE from 'three';
import { optionalAssets } from './assets';

export const TEXTURE_URLS = {
  height: '/textures/moon_height.png',
  color: '/textures/moon_color.jpg',
  meta: '/textures/moon_meta.json',
} as const;

export interface TerrainOptions {
  size?: number;
  segments?: number;
  heightmapUrl?: string;
  colorMapUrl?: string;
  metaUrl?: string;
  /** Radio (unidades de juego) del disco central aplanado donde está la base. */
  baseRadius?: number;
  /** Altura máxima del relieve real en unidades de juego (está exagerado/escalado para jugar). */
  maxRelief?: number;
}

export interface Terrain {
  mesh: THREE.Mesh;
  /** Altura del suelo en (x, z). */
  heightAt(x: number, z: number): number;
  /** Se resuelve cuando se sabe qué terreno quedó: 'real' (CGI Moon Kit) o 'procedural'. */
  ready: Promise<'real' | 'procedural'>;
  dispose(): void;
}

/** Metadatos que escribe scripts/crop-moon.mjs junto a los recortes. */
interface TerrainMeta {
  source?: string;
  radiusKm?: number;
  minMeters?: number;
  maxMeters?: number;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** ¿El archivo existe y es una imagen/JSON? Evita errores ruidosos si no se descargó. */
async function exists(url: string, kind: 'image' | 'json'): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const type = r.headers.get('content-type') ?? '';
    return r.ok && (kind === 'image' ? type.startsWith('image/') : type.includes('json'));
  } catch {
    return false;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
    img.src = url;
  });
}

/** Lee una imagen en escala de grises como alturas 0..1. */
function readHeights(img: HTMLImageElement): { data: Float32Array; w: number; h: number } {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Sin canvas 2D');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const data = new Float32Array(canvas.width * canvas.height);
  for (let i = 0; i < data.length; i++) data[i] = px[i * 4]! / 255;
  return { data, w: canvas.width, h: canvas.height };
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Crater { x: number; z: number; r: number; depth: number }

/** Cráteres repartidos fuera de la zona de la base (semilla fija: mismo paisaje siempre). */
function makeCraters(size: number, baseRadius: number): Crater[] {
  const rand = seeded(1969);
  const list: Crater[] = [];
  for (let i = 0; i < 400 && list.length < 26; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = baseRadius * 1.5 + rand() * size * 0.75;
    const r = 4 + rand() * rand() * 22;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (list.some((c) => Math.hypot(c.x - x, c.z - z) < (c.r + r) * 1.1)) continue;
    list.push({ x, z, r, depth: r * 0.22 });
  }
  return list;
}

/** Textura de regolito: grano fino y micro-cráteres. Sirve de color y de relieve. */
function regolithTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seeded(11);
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 150 + (rand() - 0.5) * 70 + (rand() - 0.5) * 30;
    image.data.set([v, v, v * 0.985, 255], i * 4);
  }
  ctx.putImageData(image, 0, 0);
  // Micro-cráteres: fondo oscuro y borde claro por el lado del Sol.
  for (let i = 0; i < 90; i++) {
    const x = rand() * size, y = rand() * size, r = 2 + rand() * rand() * 16;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(60, 60, 58, 0.55)');
    g.addColorStop(0.75, 'rgba(90, 90, 88, 0.25)');
    g.addColorStop(0.92, 'rgba(225, 224, 218, 0.5)');
    g.addColorStop(1, 'rgba(160, 160, 156, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 14);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createTerrain(options: TerrainOptions = {}): Terrain {
  const size = options.size ?? 200;
  const segments = options.segments ?? 128;
  const baseRadius = options.baseRadius ?? 30;
  const maxRelief = options.maxRelief ?? 18;

  // Procedural: ondulación suave, cráteres con borde y el gran borde del cráter a lo lejos.
  const craters = makeCraters(size, baseRadius);
  let heightFn = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    const far = Math.max(0, r - baseRadius * 1.5);
    let h = (Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09) * 0.9 + Math.sin(x * 0.31) * Math.cos(z * 0.27 + 0.7) * 0.25) * smoothstep(baseRadius * 0.8, baseRadius * 1.6, r);
    for (const c of craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.r;
      if (d < 1.6) h += c.depth * (d < 1 ? (d * d - 1) : 0) + c.depth * 0.35 * Math.exp(-((d - 1) ** 2) / 0.05);
    }
    return h + far * far * 0.006;
  };

  const geometry = new THREE.PlaneGeometry(size * 3, size * 3, segments * 2, segments * 2);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color: 0x9a9892, roughness: 1, metalness: 0 });
  const grain = typeof document !== 'undefined' ? regolithTexture() : null;
  if (grain) {
    material.map = grain;
    material.bumpMap = grain;
    material.bumpScale = 1.4;
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  const applyHeights = (): void => {
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightFn(pos.getX(i), pos.getZ(i)));
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  };
  applyHeights();

  let colorTexture: THREE.Texture | null = null;

  const loadReal = async (): Promise<'real' | 'procedural'> => {
    const heightUrl = options.heightmapUrl;
    if (!heightUrl || typeof document === 'undefined') return 'procedural';
    if (!(await optionalAssets()).terrain || !(await exists(heightUrl, 'image'))) return 'procedural';
    try {
      const { data, w, h } = readHeights(await loadImage(heightUrl));
      const meta: TerrainMeta =
        options.metaUrl && (await exists(options.metaUrl, 'json'))
          ? ((await (await fetch(options.metaUrl)).json()) as TerrainMeta)
          : {};
      void meta; // radio y metros reales: se muestran en la ficha de fuente (cgi_moon_kit)

      // Muestreo bilineal del mapa (centro de la imagen = polo sur = centro de la base).
      const sample = (u: number, v: number): number => {
        const x = THREE.MathUtils.clamp(u * (w - 1), 0, w - 1);
        const y = THREE.MathUtils.clamp(v * (h - 1), 0, h - 1);
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
        const fx = x - x0, fy = y - y0;
        const at = (xx: number, yy: number): number => data[yy * w + xx]!;
        return (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) + (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy;
      };
      const center = sample(0.5, 0.5);
      heightFn = (x, z) => {
        const real = (sample(x / size + 0.5, z / size + 0.5) - center) * maxRelief;
        // La base necesita suelo plano: transición suave entre el disco central y el relieve real.
        return real * smoothstep(baseRadius * 0.8, baseRadius * 1.6, Math.hypot(x, z));
      };
      applyHeights();

      const colorUrl = options.colorMapUrl;
      if (colorUrl && (await exists(colorUrl, 'image'))) {
        colorTexture = await new THREE.TextureLoader().loadAsync(colorUrl);
        colorTexture.colorSpace = THREE.SRGBColorSpace;
        colorTexture.anisotropy = 4;
        material.map = colorTexture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      }
      return 'real';
    } catch (error) {
      console.warn('[terrain] Se usa el terreno procedural:', error);
      return 'procedural';
    }
  };

  return {
    mesh,
    heightAt: (x, z) => heightFn(x, z),
    ready: loadReal(),
    dispose() {
      geometry.dispose();
      material.dispose();
      colorTexture?.dispose();
      grain?.dispose();
    },
  };
}
