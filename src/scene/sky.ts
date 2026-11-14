// Cielo lunar: negro, sin atmósfera. La Tierra baja en el horizonte y estrellas que solo se ven
// cuando cae la luz (la cámara está expuesta para el suelo iluminado). docs/ARTE.md §2.

import * as THREE from 'three';

export interface Sky {
  /** `sun` = luz del día 0..1; `storm` = intensidad de la tormenta 0..1. */
  update(sun: number, storm: number): void;
  /**
   * Portada: lleva la Tierra a `position` con tamaño `scale` (0 = posición normal, 1 = póster).
   */
  setHero(amount: number, position: THREE.Vector3, scale: number): void;
  dispose(): void;
}

/** PRNG pequeño con semilla fija: el cielo es igual en cada partida. */
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

/** Textura de la Tierra dibujada a mano: océano, continentes difusos y nubes. No es un mapa real. */
function earthTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seeded(7);
  ctx.fillStyle = '#1d4f8f';
  ctx.fillRect(0, 0, size * 2, size);
  const blobs = (count: number, color: string, min: number, max: number): void => {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      ctx.ellipse(rand() * size * 2, size * (0.15 + rand() * 0.7), min + rand() * (max - min), (min + rand() * (max - min)) * 0.6, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  blobs(26, 'rgba(74, 122, 78, 0.9)', 10, 42);
  blobs(18, 'rgba(150, 132, 92, 0.6)', 6, 22);
  ctx.fillStyle = '#e9eef2';
  ctx.fillRect(0, 0, size * 2, size * 0.07);
  ctx.fillRect(0, size * 0.93, size * 2, size * 0.07);
  blobs(60, 'rgba(255, 255, 255, 0.42)', 8, 36);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSky(scene: THREE.Scene): Sky {
  const group = new THREE.Group();
  scene.add(group);

  // La Tierra: siempre en el mismo punto del cielo, baja sobre el horizonte.
  const earthMap = earthTexture();
  // Material básico: el Sol rasante de la escena no debe apagarla ni teñirla.
  const earthMat = new THREE.MeshBasicMaterial({ map: earthMap, color: 0xd8d8d8, toneMapped: false });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(16, 40, 24), earthMat);
  const EARTH_HOME = new THREE.Vector3(-190, 62, -330);
  earth.position.copy(EARTH_HOME);
  earth.rotation.set(0.4, 1.1, 0.25);
  group.add(earth);
  // Halo de atmósfera: un borde azul que brilla alrededor de la Tierra.
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x6fb4ff, transparent: true, opacity: 0.32, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(17.6, 40, 24), haloMat);
  earth.add(halo);

  // Estrellas: dos capas (muchas pequeñas, pocas grandes) y una banda densa de Vía Láctea.
  const rand = seeded(42);
  const palette = [new THREE.Color(0xffffff), new THREE.Color(0xcfe0ff), new THREE.Color(0xfff0d8), new THREE.Color(0xffd9b0)];
  const bandNormal = new THREE.Vector3(0.35, 0.8, 0.48).normalize();
  const starLayer = (count: number, size: number, band: boolean): { points: THREE.Points; geo: THREE.BufferGeometry; mat: THREE.PointsMaterial } => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      if (band) {
        // Aplasta el punto hacia el plano de la banda: casi todos quedan cerca de ese círculo.
        const off = v.dot(bandNormal);
        v.addScaledVector(bandNormal, -off * (1 - Math.pow(rand(), 3) * 0.35)).normalize();
      }
      if (v.y < -0.05) v.y = -v.y; // solo el cielo visible
      v.multiplyScalar(620);
      positions.set([v.x, v.y + 10, v.z], i * 3);
      const c = palette[Math.floor(rand() * palette.length)]!.clone().multiplyScalar(0.55 + rand() * 0.45);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const points = new THREE.Points(geo, mat);
    group.add(points);
    return { points, geo, mat };
  };
  const layers = [starLayer(2600, 1.3, false), starLayer(260, 2.6, false), starLayer(3200, 1.1, true)];
  const layerStrength = [1, 1, 0.7];

  const background = new THREE.Color(0x000000);
  const stormColor = new THREE.Color(0x1a0f2e);
  scene.background = background;

  return {
    setHero(amount, position, scale) {
      const e = amount * amount * (3 - 2 * amount);
      earth.position.lerpVectors(EARTH_HOME, position, e);
      earth.scale.setScalar(1 + (scale - 1) * e);
      earth.rotation.y = 1.1 + e * 0.9;
    },
    update(sun, storm) {
      // De noche se ven todas; de día quedan tenues (la cámara está expuesta para el suelo).
      const night = Math.max(0, 1 - sun * 3.2);
      layers.forEach((layer, i) => {
        layer.mat.opacity = (0.22 + 0.78 * night) * layerStrength[i]!;
      });
      // Tormenta solar: el cielo deja de ser negro puro. Sin tapar la base.
      background.setRGB(0, 0, 0).lerp(stormColor, storm);
    },
    dispose() {
      scene.remove(group);
      earth.geometry.dispose();
      halo.geometry.dispose();
      haloMat.dispose();
      earthMat.dispose();
      earthMap.dispose();
      layers.forEach((layer) => {
        layer.geo.dispose();
        layer.mat.dispose();
      });
    },
  };
}
