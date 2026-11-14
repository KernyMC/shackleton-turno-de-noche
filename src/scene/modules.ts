// Forma propia de cada módulo (para reconocerlo de lejos por su silueta) y su rótulo con ícono.
// Todo procedural: geometrías simples y un lienzo 2D para el rótulo. Paleta de docs/ARTE.md.

import * as THREE from 'three';
import type { ModuleId } from '../sim/types';

const DARK = 0x3b3a38;

/** Trazos de los íconos (mismos dibujos que src/components/icons.tsx, en una caja de 20×20). */
const ICON_PATHS: Record<ModuleId, string[]> = {
  recycler: ['M4 10a6 6 0 0 1 10.2-4.3', 'M14.5 2.8v3.2h-3.2', 'M16 10a6 6 0 0 1-10.2 4.3', 'M5.5 17.2V14h3.2'],
  greenhouse: ['M10 17V9', 'M10 11c0-3 2-5 5.5-5 0 3.2-2 5-5.5 5Z', 'M10 9C10 6.5 8.4 4.5 5 4.5c0 2.8 1.6 4.5 5 4.5Z', 'M5 17h10'],
  shield: ['M10 2.5 16 5v4.5c0 4-2.6 6.6-6 8-3.4-1.4-6-4-6-8V5Z'],
  workshop: ['M12.5 3.2a3.8 3.8 0 0 0-4.6 5L3.4 12.7a1.6 1.6 0 0 0 2.3 2.3l4.5-4.5a3.8 3.8 0 0 0 5-4.6l-2.3 2.3-2-.4-.4-2Z'],
};

/** Radio aproximado de cada módulo, para colocar la franja de energía. */
export const MODULE_TOP: Record<ModuleId, number> = { recycler: 6.2, greenhouse: 4.6, shield: 9.4, workshop: 5.4 };

/**
 * Construye el módulo con el suelo en y = 0.
 * `hull` es el casco (blanco hueso) y `glow` el material que se enciende con la energía.
 */
export function buildModuleShape(
  id: ModuleId,
  hull: THREE.MeshStandardMaterial,
  glow: THREE.MeshStandardMaterial,
): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const dark = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.9, metalness: 0.2 });
  const ring = (radius: number, y: number, height = 0.32): THREE.Mesh =>
    add(new THREE.CylinderGeometry(radius, radius, height, 40, 1, true), glow, 0, y, 0);

  switch (id) {
    case 'recycler': {
      // Torre con cúpula y dos tanques de agua y aire.
      add(new THREE.CylinderGeometry(2.8, 2.8, 3.4, 32), hull, 0, 1.7, 0);
      add(new THREE.SphereGeometry(2.8, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), hull, 0, 3.4, 0);
      ring(2.86, 2.7);
      for (const side of [-1, 1]) {
        add(new THREE.SphereGeometry(1.25, 20, 14), hull, side * 3.7, 1.35, 1.2);
        add(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 8), dark, side * 2.9, 1.6, 1.0).rotation.z = Math.PI / 2;
        add(new THREE.CylinderGeometry(1.28, 1.28, 0.22, 20, 1, true), glow, side * 3.7, 1.35, 1.2);
      }
      break;
    }
    case 'greenhouse': {
      // Cúpula de cristal sobre una base baja, con hileras de plantas dentro.
      add(new THREE.CylinderGeometry(3.3, 3.5, 1.1, 36), hull, 0, 0.55, 0);
      const glass = new THREE.MeshStandardMaterial({
        color: 0xcfeedd, transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0.1, depthWrite: false,
      });
      add(new THREE.SphereGeometry(3.25, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 1.1, 0).castShadow = false;
      const leaf = new THREE.MeshStandardMaterial({ color: 0x4f9a55, roughness: 0.9, emissive: 0x1f4a25, emissiveIntensity: 0.6 });
      for (const z of [-1.5, 0, 1.5]) add(new THREE.BoxGeometry(4.2 - Math.abs(z) * 0.9, 0.7, 0.55), leaf, 0, 1.45, z);
      // Costillas de la cúpula.
      for (let i = 0; i < 4; i++) {
        const rib = add(new THREE.TorusGeometry(3.27, 0.06, 6, 32, Math.PI), hull, 0, 1.1, 0);
        rib.rotation.y = (i * Math.PI) / 4;
      }
      ring(3.42, 0.85, 0.3);
      break;
    }
    case 'shield': {
      // Generador con mástil y anillos emisores: los anillos brillan con la energía.
      add(new THREE.CylinderGeometry(2.3, 2.7, 3.2, 8), hull, 0, 1.6, 0);
      add(new THREE.CylinderGeometry(1.2, 2.3, 0.9, 8), hull, 0, 3.65, 0);
      add(new THREE.CylinderGeometry(0.16, 0.2, 5.2, 10), dark, 0, 6.6, 0);
      [1.7, 1.25, 0.8].forEach((radius, i) => {
        add(new THREE.TorusGeometry(radius, 0.12, 8, 32), glow, 0, 5.4 + i * 1.3, 0).rotation.x = Math.PI / 2;
      });
      add(new THREE.SphereGeometry(0.3, 12, 10), glow, 0, 9.3, 0);
      ring(2.6, 1.2);
      break;
    }
    case 'workshop': {
      // Hangar de techo curvo con portón y un brazo grúa.
      add(new THREE.BoxGeometry(6.2, 2.4, 5), hull, 0, 1.2, 0);
      const roof = add(new THREE.CylinderGeometry(2.5, 2.5, 6.2, 24, 1, false, 0, Math.PI), hull, 0, 2.4, 0);
      roof.rotation.set(0, 0, Math.PI / 2);
      roof.rotation.y = Math.PI / 2;
      add(new THREE.BoxGeometry(3.2, 2.1, 0.12), dark, 0, 1.05, 2.53);
      add(new THREE.BoxGeometry(3.6, 0.28, 0.16), glow, 0, 2.35, 2.55);
      add(new THREE.BoxGeometry(6.3, 0.3, 5.1), glow, 0, 0.5, 0);
      add(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 8), dark, 3.6, 1.7, -1.4);
      add(new THREE.BoxGeometry(2.6, 0.2, 0.2), dark, 2.5, 3.4, -1.4);
      break;
    }
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = o.castShadow !== false && !(o.material as THREE.Material).transparent;
      o.receiveShadow = true;
    }
  });
  return g;
}

/** Candado (caja de 20×20) para los módulos en obras. */
const LOCK_PATHS = ['M5 9h10v8H5Z', 'M7 9V6.5a3 3 0 0 1 6 0V9'];

const LABEL_W = 512;
const LABEL_H = 136;

function drawLabel(canvas: HTMLCanvasElement, id: ModuleId, text: string, locked = false): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, LABEL_W, LABEL_H);
  // En obras: el rótulo se atenúa y el ícono pasa a ser un candado.
  ctx.globalAlpha = locked ? 0.55 : 1;
  ctx.font = '700 58px "Barlow Condensed", system-ui, sans-serif';
  const textWidth = Math.min(ctx.measureText(text).width, LABEL_W - 150);
  const width = textWidth + 142;
  const x0 = (LABEL_W - width) / 2;

  // Placa oscura con borde ámbar.
  ctx.beginPath();
  ctx.roundRect(x0, 14, width, LABEL_H - 28, 14);
  ctx.fillStyle = 'rgba(11, 12, 14, 0.86)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = locked ? '#8a8579' : '#ffb347';
  ctx.stroke();

  // Ícono (caja 20×20 escalada).
  ctx.save();
  ctx.translate(x0 + 24, 30);
  ctx.scale(3.8, 3.8);
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = locked ? '#cfc9bb' : '#ffb347';
  for (const d of locked ? LOCK_PATHS : ICON_PATHS[id]) ctx.stroke(new Path2D(d));
  ctx.restore();

  ctx.fillStyle = '#ece8df';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x0 + 116, LABEL_H / 2 + 3, LABEL_W - 150);
  ctx.globalAlpha = 1;
}

export interface ModuleLabel {
  sprite: THREE.Sprite;
  setText(text: string): void;
  /** Módulo en obras: candado y texto atenuado. */
  setLocked(locked: boolean): void;
  dispose(): void;
}

/** Rótulo que siempre mira a la cámara: ícono + nombre del módulo. */
export function createModuleLabel(id: ModuleId, text: string): ModuleLabel {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  let current = text;
  let isLocked = false;
  drawLabel(canvas, id, current, isLocked);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(9, (9 * LABEL_H) / LABEL_W, 1);
  sprite.renderOrder = 10;
  return {
    sprite,
    setText(next) {
      current = next;
      drawLabel(canvas, id, current, isLocked);
      texture.needsUpdate = true;
    },
    setLocked(locked) {
      if (locked === isLocked) return;
      isLocked = locked;
      drawLabel(canvas, id, current, isLocked);
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      material.dispose();
    },
  };
}
