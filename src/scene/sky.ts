// Cielo lunar: negro, sin atmósfera. La Tierra baja en el horizonte y estrellas que solo se ven
// cuando cae la luz (la cámara está expuesta para el suelo iluminado). docs/ARTE.md §2.

import * as THREE from 'three';

export interface Sky {
  /** `sun` = luz del día 0..1; `storm` = intensidad de la tormenta 0..1. */
  update(sun: number, storm: number): void;
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
  earth.position.set(-190, 62, -330);
  earth.rotation.set(0.4, 1.1, 0.25);
  group.add(earth);

  // Estrellas: puntos en una esfera lejana.
  const rand = seeded(42);
  const count = 1400;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions.set([r * Math.cos(phi) * 600, Math.abs(u) * 600 * 0.9 + 12, r * Math.sin(phi) * 600], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  const background = new THREE.Color(0x000000);
  const stormColor = new THREE.Color(0x1a0f2e);
  scene.background = background;

  return {
    update(sun, storm) {
      starMat.opacity = Math.max(0, 1 - sun * 3.2) * 0.9;
      stars.visible = starMat.opacity > 0.01;
      // Tormenta solar: el cielo deja de ser negro puro. Sin tapar la base.
      background.setRGB(0, 0, 0).lerp(stormColor, storm);
    },
    dispose() {
      scene.remove(group);
      earth.geometry.dispose();
      earthMat.dispose();
      earthMap.dispose();
      starGeo.dispose();
      starMat.dispose();
    },
  };
}
