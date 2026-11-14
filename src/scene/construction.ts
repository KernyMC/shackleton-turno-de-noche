// Módulos "en obras": andamios sencillos (postes, travesaños y una valla de franjas ámbar oscuro)
// alrededor de un módulo bloqueado. Una sola malla fusionada por módulo (1 llamada de dibujo) con
// un material compartido; sin sombras. Al desbloquearse, el andamio se hunde y se abre hacia afuera
// (amortiguado desde base.ts). Con el módulo ya desbloqueado queda oculto: coste de dibujo cero.
// Solo REFLEJA estado. Paleta de docs/ARTE.md (el ámbar es el único cálido; aquí, apagado).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ModuleId } from '../sim/types';

export interface Scaffold {
  group: THREE.Group;
  /** 1 = andamio completo; 0 = retirado (oculto). Cualquier valor intermedio es la retirada a medias. */
  setBuild(amount: number): void;
  dispose(): void;
}

/** Medio lado y alto del andamio de cada módulo (metros). Visual: no es balance. */
const DIMS: Record<ModuleId, { r: number; h: number }> = {
  recycler: { r: 4.8, h: 4.4 },
  greenhouse: { r: 4.6, h: 3.4 },
  shield: { r: 4.3, h: 6.6 },
  workshop: { r: 4.8, h: 4.0 },
};
const POST = 0.16;
const BEAM = 0.11;
/** Por debajo de esta altura no se pone el travesaño trasero: ahí entra el pasillo. */
const CORRIDOR_CLEARANCE = 2.6;
const SLATS = 14;
const SLAT_H = 0.8;

const GREY = new THREE.Color(0x6a6b6e);
const AMBER_DARK = new THREE.Color(0x6b3d0f);
const CHARCOAL = new THREE.Color(0x2b2d31);

/** Material compartido por todos los andamios (colores por vértice). */
export function createScaffoldMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.3 });
}

/** Construye el andamio de un módulo. Mira hacia fuera de la base como el módulo (+z = fuera). */
export function createScaffold(id: ModuleId, material: THREE.Material): Scaffold {
  const { r, h } = DIMS[id];
  const pieces: THREE.BufferGeometry[] = [];
  const box = (w: number, hh: number, d: number, x: number, y: number, z: number, color: THREE.Color): void => {
    const g = new THREE.BoxGeometry(w, hh, d);
    g.translate(x, y, z);
    const count = g.attributes.position!.count;
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) col.set([color.r, color.g, color.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    pieces.push(g);
  };

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(POST, h, POST, sx * r, h / 2, sz * r, GREY);
  for (const y of [h / 3, (2 * h) / 3, h]) {
    for (const sz of [-1, 1]) {
      if (sz < 0 && y < CORRIDOR_CLEARANCE) continue; // el pasillo entra por detrás
      box(2 * r, BEAM, BEAM, 0, y, sz * r, GREY);
    }
    for (const sx of [-1, 1]) box(BEAM, BEAM, 2 * r, sx * r, y, 0, GREY);
  }
  // Valla de obra al frente: franjas ámbar oscuro y carbón alternadas.
  const span = 2 * r - 0.5;
  const slat = span / SLATS;
  for (let i = 0; i < SLATS; i++) {
    box(slat, SLAT_H, 0.05, -span / 2 + slat * (i + 0.5), h / 3 - SLAT_H / 2 - 0.05, r + 0.04, i % 2 === 0 ? AMBER_DARK : CHARCOAL);
  }

  const geometry = mergeGeometries(pieces, false);
  for (const p of pieces) p.dispose();
  const body = new THREE.Mesh(geometry, material);
  body.castShadow = false;
  body.receiveShadow = false;
  const group = new THREE.Group();
  group.add(body);
  group.visible = false;

  return {
    group,
    setBuild(amount) {
      const a = THREE.MathUtils.clamp(amount, 0, 1);
      group.visible = a > 0.01;
      // Se hunde y se abre: la retirada nunca salta.
      body.position.y = -(1 - a) * h * 1.15;
      const s = 1 + (1 - a) * 0.3;
      body.scale.set(s, 1, s);
    },
    dispose() {
      geometry.dispose();
    },
  };
}
