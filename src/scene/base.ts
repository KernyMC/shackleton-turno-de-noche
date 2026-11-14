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
import { buildModuleShape, createModuleLabel, MODULE_TOP } from './modules';
import type { ModuleLabel } from './modules';

export const MODEL_URLS = { lander: '/models/lander.glb', rover: '/models/rover.glb' } as const;
export type ModelId = keyof typeof MODEL_URLS;
/** Modelos opcionales que sustituyen la forma de cada módulo (p. ej. generados con Meshy). */
export const MODULE_MODEL_URLS: Record<ModuleId, string> = {
  recycler: '/models/recycler.glb',
  greenhouse: '/models/greenhouse.glb',
  shield: '/models/shield.glb',
  workshop: '/models/workshop.glb',
};
export const SHELTER_MODEL_URL = '/models/shelter.glb';

export interface BasePosition {
  id: ModuleId;
  x: number;
  z: number;
}

export const MODULES: BasePosition[] = [
  { id: 'recycler', x: -11, z: -10 },
  { id: 'greenhouse', x: 11, z: -10 },
  { id: 'shield', x: -11, z: 10 },
  { id: 'workshop', x: 11, z: 10 },
];

// Paleta de docs/ARTE.md §3.
const HULL = 0xd9d4c7;
const AMBER = 0xffb347;
const AMBER_DEEP = 0xc9731e;
const ALERT = 0xff5a4d;
const REGOLITH_DARK = 0x3b3a38;

/** Posición y tamaño objetivo (metros de alto aprox.) de cada modelo opcional. */
const MODEL_SLOTS: Record<ModelId, { x: number; z: number; height: number; rotY: number }> = {
  lander: { x: -26, z: 22, height: 6, rotY: 0.6 },
  rover: { x: 22, z: 22, height: 2.2, rotY: -0.4 },
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
  /** Nombres traducidos para los rótulos de los módulos. */
  setLabels(names: Record<ModuleId, string>): void;
  /** Resalta el módulo bajo el cursor (o ninguno). */
  setHover(id: ModuleId | null): void;
  /** Refugio activo: brilla en ámbar. */
  setShelter(active: boolean): void;
  /** El rover está fuera en una expedición. */
  setRoverAway(away: boolean): void;
  /** Avanza las animaciones. `time` en segundos. */
  update(dt: number, time: number, reducedMotion: boolean): void;
  /** Qué modelos GLB se cargaron (para la ficha de fuente nasa_3d_resources). */
  ready: Promise<string[]>;
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

  const tubeGeo = new THREE.CylinderGeometry(0.9, 0.9, 1, 12);
  const tubeMat = new THREE.MeshStandardMaterial({ color: HULL, roughness: 0.85 });
  const labels = new Map<ModuleId, ModuleLabel>();
  const shapes = new Map<ModuleId, THREE.Group>();

  for (const m of MODULES) {
    const y = heightAt(m.x, m.z);
    // El casco es blanco hueso; la energía se ve en las piezas que brillan y en la luz, siempre ámbar.
    const material = new THREE.MeshStandardMaterial({ color: HULL, roughness: 0.75, emissive: AMBER, emissiveIntensity: 0 });
    const band = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: AMBER, emissiveIntensity: 0, side: THREE.DoubleSide });
    // Cada módulo tiene su silueta (modules.ts) y mira hacia fuera de la base.
    const shape = buildModuleShape(m.id, material, band);
    shape.position.set(m.x, y, m.z);
    shape.rotation.y = Math.atan2(m.x, m.z);
    shape.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.userData.moduleId = m.id;
        pickables.push(o);
      }
    });
    const lamp = new THREE.PointLight(AMBER, 0, 24, 1.6);
    lamp.position.set(m.x, y + 5.2, m.z);
    // Aro de energía en el suelo: se queda aunque un modelo GLB sustituya la forma del módulo.
    const halo = new THREE.Mesh(new THREE.RingGeometry(4.9, 5.3, 48), band);
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(m.x, y + 0.06, m.z);
    group.add(shape, lamp, halo);
    shapes.set(m.id, shape);

    // Rótulo con ícono y nombre: dice qué es cada módulo sin tener que adivinar.
    if (typeof document !== 'undefined') {
      const label = createModuleLabel(m.id, m.id);
      label.sprite.position.set(m.x, y + MODULE_TOP[m.id] + 2.2, m.z);
      group.add(label.sprite);
      labels.set(m.id, label);
    }

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
  const loadModels = async (): Promise<string[]> => {
    if (typeof document === 'undefined') return [];
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const loaded: string[] = [];
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
    // Módulos: el modelo sustituye la silueta procedural; la luz, el aro y el rótulo se quedan.
    for (const id of Object.keys(MODULE_MODEL_URLS) as ModuleId[]) {
      const url = MODULE_MODEL_URLS[id];
      if (!declared.includes(id) || !(await exists(url))) continue;
      try {
        const gltf = await loader.loadAsync(url);
        if (disposed) {
          disposeObject(gltf.scene);
          break;
        }
        fitModel(gltf.scene, MODULE_TOP[id]);
        const shape = shapes.get(id)!;
        for (const child of [...shape.children]) {
          const index = pickables.indexOf(child);
          if (index >= 0) pickables.splice(index, 1);
          shape.remove(child);
          disposeObject(child);
        }
        gltf.scene.traverse((o) => {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o instanceof THREE.Mesh) {
            o.userData.moduleId = id;
            pickables.push(o);
          }
        });
        shape.add(gltf.scene);
        loaded.push(id);
      } catch (error) {
        console.warn(`[base] ${url} no se pudo cargar; se usa la forma procedural.`, error);
      }
    }
    // Refugio.
    if (declared.includes('shelter') && (await exists(SHELTER_MODEL_URL))) {
      try {
        const gltf = await loader.loadAsync(SHELTER_MODEL_URL);
        if (!disposed) {
          fitModel(gltf.scene, 3);
          gltf.scene.traverse((o) => {
            o.castShadow = true;
            o.receiveShadow = true;
          });
          gltf.scene.position.y += heightAt(0, 0);
          shelter.visible = false;
          group.add(gltf.scene);
          loaded.push('shelter');
        } else disposeObject(gltf.scene);
      } catch (error) {
        console.warn('[base] shelter.glb no se pudo cargar; se usa la forma procedural.', error);
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
    setLabels(names) {
      for (const [id, label] of labels) label.setText(names[id]);
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
      for (const label of labels.values()) label.dispose();
      disposeObject(group);
    },
  };
}
