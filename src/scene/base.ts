// La base lunar como maqueta viva: 4 módulos, refugio, módulo de aterrizaje y rover.
// Cada módulo tiene una luz que refleja su energía (la base ES el indicador).
// Usa geometrías simples. Si existen public/models/lander.glb o rover.glb (modelos de
// NASA 3D Resources, ver scripts/README-models.md), los carga en su lugar; si no existen o
// fallan, se quedan las geometrías simples.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { ModuleId } from '../sim/types';
import { optionalAssets } from './assets';

export const MODEL_URLS = { lander: '/models/lander.glb', rover: '/models/rover.glb' } as const;
export type ModelId = keyof typeof MODEL_URLS;

export interface BasePosition {
  id: ModuleId;
  x: number;
  z: number;
}

export const MODULES: BasePosition[] = [
  { id: 'recycler', x: -9, z: -8 },
  { id: 'greenhouse', x: 9, z: -8 },
  { id: 'shield', x: -9, z: 8 },
  { id: 'workshop', x: 9, z: 8 },
];

// Paleta de docs/ARTE.md §3.
const HULL = 0xd9d4c7;
const AMBER = 0xffb347;
const AMBER_DEEP = 0xc9731e;
const ALERT = 0xff5a4d;
const REGOLITH_DARK = 0x3b3a38;

/** Posición y tamaño objetivo (metros de alto aprox.) de cada modelo opcional. */
const MODEL_SLOTS: Record<ModelId, { x: number; z: number; height: number; rotY: number }> = {
  lander: { x: -19, z: 17, height: 6, rotY: 0.6 },
  rover: { x: 15, z: 19, height: 2.2, rotY: -0.4 },
};

export interface ModuleVisualState {
  /** Energía asignada / máximo, de 0 a 1. */
  efficiency: number;
  broken: boolean;
}

export interface Base {
  group: THREE.Group;
  /** Objetos que responden al clic; cada uno lleva `userData.moduleId`. */
  pickables: THREE.Object3D[];
  setModule(id: ModuleId, state: ModuleVisualState): void;
  /** Resalta el módulo bajo el cursor (o ninguno). */
  setHover(id: ModuleId | null): void;
  /** Refugio activo: brilla en ámbar. */
  setShelter(active: boolean): void;
  /** El rover está fuera en una expedición. */
  setRoverAway(away: boolean): void;
  /** Avanza las animaciones. `time` en segundos. */
  update(dt: number, time: number, reducedMotion: boolean): void;
  /** Qué modelos GLB se cargaron (para la ficha de fuente nasa_3d_resources). */
  ready: Promise<ModelId[]>;
  dispose(): void;
}

interface ModuleParts {
  material: THREE.MeshStandardMaterial;
  band: THREE.MeshStandardMaterial;
  lamp: THREE.PointLight;
  target: ModuleVisualState;
  /** Eficiencia mostrada, que persigue a la objetivo. */
  shown: number;
  hover: number;
}

/** Amortiguación exponencial: `current` persigue a `target` sin saltos (docs/ARTE.md §6). */
const damp = (current: number, target: number, k: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-k * dt));

function simpleLander(): THREE.Group {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xb8913a, roughness: 0.5, metalness: 0.6 });
  const grey = new THREE.MeshStandardMaterial({ color: HULL, roughness: 0.8 });
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
  const hull = new THREE.MeshStandardMaterial({ color: HULL, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: REGOLITH_DARK, roughness: 1 });
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
  const pickables: THREE.Object3D[] = [];
  const parts = new Map<ModuleId, ModuleParts>();

  const bodyGeo = new THREE.CylinderGeometry(3, 3, 3.2, 32);
  const domeGeo = new THREE.SphereGeometry(3, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const bandGeo = new THREE.CylinderGeometry(3.05, 3.05, 0.35, 32, 1, true);
  const tubeGeo = new THREE.CylinderGeometry(0.9, 0.9, 1, 12);
  const tubeMat = new THREE.MeshStandardMaterial({ color: HULL, roughness: 0.85 });

  for (const m of MODULES) {
    const y = heightAt(m.x, m.z);
    // El casco es blanco hueso; la energía se ve en la franja y en la luz, siempre ámbar.
    const material = new THREE.MeshStandardMaterial({ color: HULL, roughness: 0.75, emissive: AMBER, emissiveIntensity: 0 });
    const band = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: AMBER, emissiveIntensity: 0, side: THREE.DoubleSide });
    const body = new THREE.Mesh(bodyGeo, material);
    body.position.set(m.x, y + 1.6, m.z);
    const dome = new THREE.Mesh(domeGeo, material);
    dome.position.set(m.x, y + 3.2, m.z);
    const ring = new THREE.Mesh(bandGeo, band);
    ring.position.set(m.x, y + 2.6, m.z);
    const lamp = new THREE.PointLight(AMBER, 0, 22, 1.6);
    lamp.position.set(m.x, y + 5.2, m.z);
    for (const mesh of [body, dome, ring]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.moduleId = m.id;
      pickables.push(mesh);
    }
    group.add(body, dome, ring, lamp);

    // Pasillo hacia el refugio central.
    const length = Math.hypot(m.x, m.z) - 5.5;
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.scale.y = length;
    tube.position.set(m.x * 0.5, y + 0.9, m.z * 0.5);
    tube.rotation.z = Math.PI / 2;
    tube.rotation.y = -Math.atan2(m.z, m.x);
    tube.castShadow = true;
    group.add(tube);

    parts.set(m.id, { material, band, lamp, target: { efficiency: 0, broken: false }, shown: 0, hover: 0 });
  }

  // Refugio: semienterrado bajo regolito, como se blindan las bases reales contra la radiación.
  const shelterMat = new THREE.MeshStandardMaterial({ color: 0x77756f, roughness: 1, emissive: AMBER_DEEP, emissiveIntensity: 0 });
  const shelter = new THREE.Mesh(new THREE.SphereGeometry(4.2, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), shelterMat);
  shelter.scale.y = 0.55;
  shelter.position.y = heightAt(0, 0);
  shelter.castShadow = true;
  shelter.receiveShadow = true;
  const shelterLamp = new THREE.PointLight(AMBER_DEEP, 0, 26, 1.6);
  shelterLamp.position.set(0, heightAt(0, 0) + 4, 0);
  group.add(shelter, shelterLamp);
  let shelterTarget = 0;
  let shelterShown = 0;

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
  const rover = slots.get('rover')!;
  const roverHome = rover.position.clone();
  let roverAway = 0;
  let roverAwayTarget = 0;

  let disposed = false;
  const loadModels = async (): Promise<ModelId[]> => {
    if (typeof document === 'undefined') return [];
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const loaded: ModelId[] = [];
    const declared = (await optionalAssets()).models;
    for (const id of Object.keys(MODEL_URLS) as ModelId[]) {
      const url = MODEL_URLS[id];
      if (!declared.includes(id) || !(await exists(url))) continue;
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

  let hovered: ModuleId | null = null;

  return {
    group,
    pickables,
    setModule(id, state) {
      const p = parts.get(id);
      if (p) p.target = { efficiency: THREE.MathUtils.clamp(state.efficiency, 0, 1), broken: state.broken };
    },
    setHover(id) {
      hovered = id;
    },
    setShelter(active) {
      shelterTarget = active ? 1 : 0;
    },
    setRoverAway(away) {
      roverAwayTarget = away ? 1 : 0;
    },
    update(dt, time, reducedMotion) {
      for (const [id, p] of parts) {
        p.shown = damp(p.shown, p.target.efficiency, 7, dt);
        p.hover = damp(p.hover, hovered === id ? 1 : 0, 12, dt);
        if (p.target.broken) {
          // Avería: rojo que late lento (1 Hz, muy por debajo del límite de 3 Hz). Fijo con movimiento reducido.
          const pulse = reducedMotion ? 0.7 : 0.45 + 0.35 * Math.sin(time * Math.PI * 2);
          p.band.emissive.setHex(ALERT);
          p.lamp.color.setHex(ALERT);
          p.band.emissiveIntensity = pulse * 2.2;
          p.lamp.intensity = pulse * 18;
          p.material.emissiveIntensity = 0;
        } else {
          p.band.emissive.setHex(AMBER);
          p.lamp.color.setHex(AMBER);
          // Un módulo sin energía se ve apagado desde lejos; con energía, brilla.
          p.band.emissiveIntensity = 0.05 + p.shown * 2.6;
          p.lamp.intensity = p.shown * 42;
          p.material.emissiveIntensity = p.shown * 0.06 + p.hover * 0.12;
        }
      }
      shelterShown = damp(shelterShown, shelterTarget, 4, dt);
      shelterMat.emissiveIntensity = shelterShown * 0.9;
      shelterLamp.intensity = shelterShown * 60;

      // El rover sale hacia el sur y vuelve, sin teletransportes.
      roverAway = damp(roverAway, roverAwayTarget, 0.9, dt);
      rover.position.set(roverHome.x + roverAway * 30, roverHome.y, roverHome.z + roverAway * 70);
      rover.visible = roverAway < 0.97;
    },
    ready: loadModels(),
    dispose() {
      disposed = true;
      disposeObject(group);
    },
  };
}
