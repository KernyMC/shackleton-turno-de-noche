// La base lunar: 4 módulos, un módulo de aterrizaje (lander) y el rover.
// Usa geometrías simples. Si existen public/models/lander.glb o rover.glb (modelos de
// NASA 3D Resources, ver scripts/README-models.md), los carga en su lugar; si no existen o
// fallan, se quedan las geometrías simples.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { ModuleId } from '../sim/types';

export const MODEL_URLS = { lander: '/models/lander.glb', rover: '/models/rover.glb' } as const;
export type ModelId = keyof typeof MODEL_URLS;

export interface BasePosition {
  id: ModuleId;
  x: number;
  z: number;
  color: number;
}

export const MODULES: BasePosition[] = [
  { id: 'recycler', x: -9, z: -8, color: 0x4fc3f7 },
  { id: 'greenhouse', x: 9, z: -8, color: 0x81c784 },
  { id: 'shield', x: -9, z: 8, color: 0xffb74d },
  { id: 'workshop', x: 9, z: 8, color: 0xe0e0e0 },
];

/** Posición y tamaño objetivo (metros de alto aprox.) de cada modelo opcional. */
const MODEL_SLOTS: Record<ModelId, { x: number; z: number; height: number; rotY: number }> = {
  lander: { x: -18, z: 18, height: 6, rotY: 0.6 },
  rover: { x: 14, z: 20, height: 2.2, rotY: -0.4 },
};

export interface Base {
  group: THREE.Group;
  /** Qué modelos GLB se cargaron (para la ficha de fuente nasa_3d_resources). */
  ready: Promise<ModelId[]>;
  dispose(): void;
}

function simpleLander(): THREE.Group {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xb8913a, roughness: 0.5, metalness: 0.6 });
  const grey = new THREE.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 3), gold);
  body.position.y = 2.2;
  const cabin = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 1.6, 8), grey);
  cabin.position.y = 3.8;
  g.add(body, cabin);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6), grey);
    leg.position.set(sx * 1.9, 1.1, sz * 1.9);
    leg.rotation.set(sz * 0.35, 0, -sx * 0.35);
    g.add(leg);
  }
  return g;
}

function simpleRover(): THREE.Group {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b3a38, roughness: 1 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 1.8), hull);
  chassis.position.y = 0.9;
  g.add(chassis);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 16), dark);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(sx * 1.1, 0.45, sz * 1.0);
    g.add(wheel);
  }
  return g;
}

/** Ajusta un modelo cargado al tamaño objetivo y lo apoya en el suelo. */
function fitModel(object: THREE.Object3D, height: number): void {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 0) object.scale.multiplyScalar(height / size.y);
  const fitted = new THREE.Box3().setFromObject(object);
  object.position.y -= fitted.min.y;
}

async function exists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const type = r.headers.get('content-type') ?? '';
    return r.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        for (const value of Object.values(mat)) if (value instanceof THREE.Texture) value.dispose();
        mat.dispose();
      }
    }
  });
}

export function createBase(heightAt: (x: number, z: number) => number = () => 0): Base {
  const group = new THREE.Group();

  const moduleGeo = new THREE.CylinderGeometry(3, 3, 3.2, 24);
  const domeGeo = new THREE.SphereGeometry(3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const m of MODULES) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd9d4c7, emissive: m.color, emissiveIntensity: 0.25, roughness: 0.7 });
    const y = heightAt(m.x, m.z);
    const body = new THREE.Mesh(moduleGeo, mat);
    body.position.set(m.x, y + 1.6, m.z);
    body.castShadow = true;
    const dome = new THREE.Mesh(domeGeo, mat);
    dome.position.set(m.x, y + 3.2, m.z);
    dome.castShadow = true;
    const lamp = new THREE.PointLight(m.color, 6, 14);
    lamp.position.set(m.x, y + 4.5, m.z);
    group.add(body, dome, lamp);
  }

  // Lander y rover: geometría simple ahora; GLB si existe.
  const slots = new Map<ModelId, THREE.Object3D>();
  for (const id of Object.keys(MODEL_SLOTS) as ModelId[]) {
    const slot = MODEL_SLOTS[id];
    const holder = new THREE.Group();
    holder.position.set(slot.x, heightAt(slot.x, slot.z), slot.z);
    holder.rotation.y = slot.rotY;
    holder.add(id === 'lander' ? simpleLander() : simpleRover());
    holder.traverse((o) => void (o.castShadow = true));
    group.add(holder);
    slots.set(id, holder);
  }

  let disposed = false;
  const loadModels = async (): Promise<ModelId[]> => {
    if (typeof document === 'undefined') return [];
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const loaded: ModelId[] = [];
    for (const id of Object.keys(MODEL_URLS) as ModelId[]) {
      const url = MODEL_URLS[id];
      if (!(await exists(url))) continue;
      try {
        const gltf = await loader.loadAsync(url);
        if (disposed) {
          disposeObject(gltf.scene);
          break;
        }
        fitModel(gltf.scene, MODEL_SLOTS[id].height);
        gltf.scene.traverse((o) => {
          o.castShadow = true;
          o.receiveShadow = true;
        });
        const holder = slots.get(id)!;
        for (const child of [...holder.children]) {
          holder.remove(child);
          disposeObject(child);
        }
        holder.add(gltf.scene);
        loaded.push(id);
      } catch (error) {
        console.warn(`[base] ${url} no se pudo cargar; se usa la geometría simple.`, error);
      }
    }
    return loaded;
  };

  return {
    group,
    ready: loadModels(),
    dispose() {
      disposed = true;
      disposeObject(group);
    },
  };
}
