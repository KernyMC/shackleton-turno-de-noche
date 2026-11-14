// Polvo lunar sutil: motas bajas que derivan muy despacio alrededor de la base.
// Con sol brillan un poco; de noche casi desaparecen. Licencia artística: en la Luna no hay aire,
// así que el polvo "flota" solo como adorno de la maqueta (ver DECISIONES.md).
// Aleatoriedad local y con semilla fija: la escena no es el motor, pero así se ve igual cada vez.

import * as THREE from 'three';

const COUNT = 420;
const AREA = 38; // semilado del volumen (m) alrededor del centro de la base
const MAX_HEIGHT = 3;
const BASE_OPACITY = 0.25;
const NIGHT_FLOOR = 0.04; // fracción de opacidad que queda de noche
/** La altura del suelo se vuelve a muestrear cuando la mota se ha movido más de esto (m). */
const RESAMPLE_DIST = 0.3;

export interface Dust {
  points: THREE.Points;
  update(dt: number, time: number, sunlight: number, reducedMotion: boolean): void;
  /** Fracción de motas que se dibujan y mueven (1 = todas, 0 = apagado). Para calidad baja. */
  setDensity(fraction: number): void;
  dispose(): void;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function softDot(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createDust(heightAt: (x: number, z: number) => number): Dust {
  const rand = mulberry32(20260);
  const positions = new Float32Array(COUNT * 3);
  const velocity = new Float32Array(COUNT * 3);
  const lift = new Float32Array(COUNT); // altura sobre el suelo
  const phase = new Float32Array(COUNT);
  const ground = new Float32Array(COUNT); // altura del suelo en caché
  const sampleX = new Float32Array(COUNT);
  const sampleZ = new Float32Array(COUNT);
  let active = COUNT;
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (rand() * 2 - 1) * AREA;
    positions[i * 3 + 2] = (rand() * 2 - 1) * AREA;
    lift[i] = 0.2 + rand() * (MAX_HEIGHT - 0.2);
    phase[i] = rand() * Math.PI * 2;
    velocity[i * 3] = (rand() - 0.5) * 0.16;
    velocity[i * 3 + 2] = (rand() - 0.5) * 0.16;
    ground[i] = heightAt(positions[i * 3]!, positions[i * 3 + 2]!);
    sampleX[i] = positions[i * 3]!;
    sampleZ[i] = positions[i * 3 + 2]!;
    positions[i * 3 + 1] = ground[i]! + lift[i]!;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const map = softDot();
  const material = new THREE.PointsMaterial({
    color: 0xb9ada0, // gris cálido
    size: 0.28,
    sizeAttenuation: true,
    map,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;

  return {
    points,
    update(dt, time, sunlight, reducedMotion) {
      // Brillo: casi nada de noche, más con sol (ya viene amortiguado desde el mundo).
      material.opacity = BASE_OPACITY * (NIGHT_FLOOR + (1 - NIGHT_FLOOR) * sunlight);
      if (reducedMotion || active === 0) return;
      for (let i = 0; i < active; i++) {
        let x = positions[i * 3]! + velocity[i * 3]! * dt;
        let z = positions[i * 3 + 2]! + velocity[i * 3 + 2]! * dt;
        // Al salir del volumen reaparece por el lado contrario.
        if (x > AREA) x -= AREA * 2;
        else if (x < -AREA) x += AREA * 2;
        if (z > AREA) z -= AREA * 2;
        else if (z < -AREA) z += AREA * 2;
        positions[i * 3] = x;
        positions[i * 3 + 2] = z;
        // El suelo cambia despacio: se muestrea de nuevo solo cuando la mota ya se ha movido un poco.
        if (Math.abs(x - sampleX[i]!) > RESAMPLE_DIST || Math.abs(z - sampleZ[i]!) > RESAMPLE_DIST) {
          ground[i] = heightAt(x, z);
          sampleX[i] = x;
          sampleZ[i] = z;
        }
        positions[i * 3 + 1] = ground[i]! + lift[i]! + Math.sin(time * 0.15 + phase[i]!) * 0.12;
      }
      geometry.attributes.position!.needsUpdate = true;
    },
    setDensity(fraction) {
      active = Math.round(COUNT * Math.min(1, Math.max(0, fraction)));
      geometry.setDrawRange(0, active);
      points.visible = active > 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      map.dispose();
    },
  };
}
