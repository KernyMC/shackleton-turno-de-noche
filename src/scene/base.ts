// La base lunar como maqueta viva: 4 módulos, refugio, módulo de aterrizaje y rover.
// Cada módulo tiene una luz que refleja su energía (la base ES el indicador).
// Usa geometrías simples. Si existen public/models/lander.glb o rover.glb (modelos de
// NASA 3D Resources, ver scripts/README-models.md), los carga en su lugar; si no existen o
// fallan, se quedan las geometrías simples.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { sharedImages } from './sharedImages';
import { CREW } from '../data/crew';
import type { ModuleId } from '../sim/types';
import { optionalAssets } from './assets';
import { createScaffold, createScaffoldMaterial } from './construction';
import type { Scaffold } from './construction';
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
/** Dónde está la nave de descenso: de ella baja la tripulación en la presentación. */
export const LANDER_SPOT: { x: number; z: number; height: number } = MODEL_SLOTS.lander;

export interface ModuleVisualState {
  /** Energía asignada / máximo, de 0 a 1. */
  efficiency: number;
  broken: boolean;
  /** Módulo aún no desbloqueado: se ve en obras (andamios, luz apagada, rótulo con candado). */
  locked?: boolean;
}

export interface Base {
  group: THREE.Group;
  /** Objetos que responden al clic; cada uno lleva `userData.moduleId`. */
  pickables: THREE.Object3D[];
  setModule(id: ModuleId, state: ModuleVisualState): void;
  /** Nombres traducidos para los rótulos de los módulos. */
  setLabels(names: Record<ModuleId, string>): void;
  setLabelsVisible(visible: boolean): void;
  /** Resalta el módulo bajo el cursor (o ninguno). */
  setHover(id: ModuleId | null): void;
  /** Rutas por el suelo de cada pasillo, del centro de la base al módulo (para la tripulación). */
  routes: Record<ModuleId, THREE.Vector3[]>;
  /** Luz de los pasillos (1 de día, 0.3 de noche). */
  setCorridorLight(level: number): void;
  /** Calidad baja: vidrio sin transmisión (más rápido). */
  setLowQuality(low: boolean): void;
  /** Marca el módulo elegido con un anillo de su color que late (o ninguno). */
  setSelected(id: ModuleId | null): void;
  /** Refugio activo: brilla en ámbar. */
  setShelter(active: boolean): void;
  /** El rover está fuera en una expedición. */
  setRoverAway(away: boolean): void;
  /** El rover va junto a los paneles solares (limpieza de polvo de hoy). */
  setRoverClean(on: boolean): void;
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
  /** Anillo de selección en el suelo, con el color del módulo. */
  select: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  selected: number;
  /** En obras: objetivo, valor mostrado (1 = andamio completo) y si ya recibió su primer estado. */
  locked: boolean;
  lock: number;
  lockApplied: number;
  configured: boolean;
  unlockPending: boolean;
  /** Destello de desbloqueo: 0..1 de avance; -1 = sin destello. */
  flashT: number;
  scaffold: Scaffold;
  /** Materiales del casco que se oscurecen en obras (los del GLB, con su color original). */
  tint: { mat: THREE.MeshStandardMaterial; base: THREE.Color }[];
  stripMat: THREE.MeshStandardMaterial;
}

/** Qué tan oscuro queda el casco con el andamio completo, la duración del destello y la rapidez de la obra. */
const LOCK_DARKEN = 0.5;
const FLASH_SECONDS = 1.6;
const BUILD_K_LOCK = 5;
const BUILD_K_UNLOCK = 4;
/** Dónde espera el rover mientras limpia los paneles (junto al campo solar). */
const CLEAN_SPOT = { x: 20.5, z: 9.5 };
const HULL_COLOR = new THREE.Color(HULL);

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

  // Pasillos: tubo con anillos estructurales, esclusas en ambos extremos y apoyos al suelo.
  const tubeGeo = new THREE.CylinderGeometry(0.85, 0.85, 1, 20);
  const collarGeo = new THREE.CylinderGeometry(1.15, 1.15, 1, 20);
  const ringGeo = new THREE.TorusGeometry(0.9, 0.08, 6, 20);
  const legGeo = new THREE.BoxGeometry(0.22, 1, 0.5);
  // Vidrio: con transmisión en calidad alta; en baja, transparente simple (mucho más barato).
  const glassHigh = new THREE.MeshPhysicalMaterial({
    color: 0xe4eef4, roughness: 0.06, metalness: 0, transmission: 0.92, thickness: 0.25, ior: 1.3,
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
  });
  const glassLow = new THREE.MeshStandardMaterial({ color: 0xcfe2ee, roughness: 0.1, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const tubes: THREE.InstancedMesh[] = [];
  /** Las piezas repetidas de los pasillos se juntan en mallas instanciadas (una llamada de dibujo por tipo). */
  const batches = new Map<THREE.BufferGeometry, { mat: THREE.Material; shadow: boolean; matrices: THREE.Matrix4[]; order: number }>();
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x5b5d62, roughness: 0.8 });
  // Cada pasillo tiene su tira de luz: la de un módulo en obras se apaga sola (4 llamadas de dibujo en vez de 1).
  const stripMats = new Map<ModuleId, THREE.MeshStandardMaterial>();
  const stripGeos = new Map<ModuleId, THREE.BoxGeometry>();
  for (const m of MODULES) {
    stripMats.set(m.id, new THREE.MeshStandardMaterial({ color: 0x222222, emissive: AMBER, emissiveIntensity: 1.6 }));
    stripGeos.set(m.id, new THREE.BoxGeometry(0.12, 0.03, 1));
  }
  let corridorLevel = 1;
  const floorGeo = new THREE.BoxGeometry(1.15, 0.08, 1);
  const scaffoldMat = createScaffoldMaterial();
  const routes = {} as Record<ModuleId, THREE.Vector3[]>;
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x6a6b6e, roughness: 0.55, metalness: 0.35 });
  const UP = new THREE.Vector3(0, 1, 0);
  const AXIS_Z = new THREE.Vector3(0, 0, 1);
  /**
   * Distancia desde el centro a la que nace el pasillo: dentro del refugio. Con el modelo GLB
   * (esfera de ~4 m de alto) la esclusa queda justo en su superficie; con el montículo
   * procedural (más grande) el tramo extra queda escondido dentro.
   */
  const HUB_RADIUS = 1.6;
  /** Distancia desde el centro de cada módulo a la que el pasillo se acopla. */
  const MODULE_RADIUS = 3.7;
  const TUBE_Y = 1.0;
  const corridor = (id: ModuleId, mx: number, mz: number): void => {
    const dist = Math.hypot(mx, mz);
    const dir = new THREE.Vector3(mx / dist, 0, mz / dist);
    const at = (r: number, lift = TUBE_Y): THREE.Vector3 => {
      const v = dir.clone().multiplyScalar(r);
      return v.setY(heightAt(v.x, v.z) + lift);
    };
    const along = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    const across = new THREE.Quaternion().setFromUnitVectors(AXIS_Z, dir);
    const r0 = HUB_RADIUS;
    const r1 = dist - MODULE_RADIUS;
    const scaleV = new THREE.Vector3();
    const piece = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: THREE.Vector3, q: THREE.Quaternion, scale?: [number, number, number], shadow = false, order = 0): void => {
      let batch = batches.get(geo);
      if (!batch) batches.set(geo, (batch = { mat, shadow, matrices: [], order }));
      batch.matrices.push(new THREE.Matrix4().compose(pos, q, scaleV.set(scale?.[0] ?? 1, scale?.[1] ?? 1, scale?.[2] ?? 1)));
    };
    piece(tubeGeo, coarse ? glassLow : glassHigh, at((r0 + r1) / 2), along, [1, r1 - r0, 1], false, 3);
    // Suelo interior y tira de luz cálida a lo largo del pasillo.
    const floorY = TUBE_Y - 0.66;
    const flat = new THREE.Quaternion().setFromUnitVectors(AXIS_Z, dir);
    piece(floorGeo, floorMat, at((r0 + r1) / 2, floorY), flat, [1, 1, r1 - r0 + 0.6]);
    for (const side of [-1, 1]) {
      const pos = at((r0 + r1) / 2, floorY + 0.05).add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(side * 0.48));
      piece(stripGeos.get(id)!, stripMats.get(id)!, pos, flat, [1, 1, r1 - r0]);
    }
    // Ruta para la tripulación: desde dentro del refugio hasta dentro del módulo.
    const feet = TUBE_Y - 0.62;
    routes[id] = [r0 - 0.4, r0 + 0.6, (r0 + r1) / 2, r1 - 0.4, r1 + 0.6].map((r) => at(r, feet));
    // Esclusas: el tubo entra en un collarín más ancho en cada extremo.
    piece(collarGeo, frameMat, at(r0 + 0.3), along, [1, 0.9, 1], true);
    piece(collarGeo, frameMat, at(r1 - 0.3), along, [1, 0.9, 1], true);
    // Anillos cada ~2,2 m (finos: no proyectan sombra) y patas que apoyan el tubo en el suelo.
    const span = r1 - r0 - 1.4;
    const count = Math.max(1, Math.round(span / 2.2));
    for (let i = 0; i <= count; i++) {
      const r = r0 + 0.7 + (span * i) / count;
      piece(ringGeo, frameMat, at(r), across);
      if (i % 2 === 1) {
        const ground = at(r, 0).y;
        const top = at(r).y - 0.75;
        piece(legGeo, frameMat, at(r, 0).setY((ground + top) / 2), across, [1, Math.max(0.1, top - ground), 1], true);
      }
    }
  };
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
    // Anillo de selección: grueso, del color del módulo, por encima del aro de energía.
    const selectColor = CREW.find((c) => c.module === m.id)?.color ?? AMBER;
    const select = new THREE.Mesh(
      new THREE.RingGeometry(5.5, 6.3, 64),
      new THREE.MeshBasicMaterial({ color: selectColor, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    );
    select.rotation.x = -Math.PI / 2;
    select.position.set(m.x, y + 0.09, m.z);
    select.renderOrder = 2;
    group.add(select);
    const halo = new THREE.Mesh(new THREE.RingGeometry(4.9, 5.3, 48), band);
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(m.x, y + 0.06, m.z);
    group.add(shape, lamp, halo);
    shapes.set(m.id, shape);
    // Andamios (ocultos mientras el módulo está desbloqueado).
    const scaffold = createScaffold(m.id, scaffoldMat);
    scaffold.group.position.set(m.x, y, m.z);
    scaffold.group.rotation.y = Math.atan2(m.x, m.z);
    group.add(scaffold.group);

    // Rótulo con ícono y nombre: dice qué es cada módulo sin tener que adivinar.
    if (typeof document !== 'undefined') {
      const label = createModuleLabel(m.id, m.id);
      label.sprite.position.set(m.x, y + MODULE_TOP[m.id] + 2.2, m.z);
      group.add(label.sprite);
      labels.set(m.id, label);
    }

    // Pasillo hacia el refugio central.
    corridor(m.id, m.x, m.z);

    parts.set(m.id, {
      material, band, lamp, target: { efficiency: 0, broken: false }, shown: 0, hover: 0, select, selected: 0,
      locked: false, lock: 0, lockApplied: -1, configured: false, unlockPending: false, flashT: -1,
      scaffold, tint: [], stripMat: stripMats.get(m.id)!,
    });
  }

  for (const [geo, batch] of batches) {
    const inst = new THREE.InstancedMesh(geo, batch.mat, batch.matrices.length);
    batch.matrices.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = batch.shadow;
    inst.receiveShadow = true;
    inst.renderOrder = batch.order;
    group.add(inst);
    if (geo === tubeGeo) tubes.push(inst);
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
  /** Piezas luminosas del modelo GLB del refugio (aro de la escotilla). */
  const shelterGlow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: AMBER, emissiveIntensity: 0 });
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
  let roverClean = 0;
  let roverCleanTarget = 0;

  let disposed = false;
  const loadModels = async (): Promise<string[]> => {
    if (typeof document === 'undefined') return [];
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(sharedImages);
    const loaded: string[] = [];
    const declared = (await optionalAssets()).models;
    // Todas las descargas arrancan a la vez; luego se colocan en orden (antes iban de una en una).
    const fetches = new Map<string, Promise<GLTF | null>>();
    const fetchModel = (id: string, url: string): Promise<GLTF | null> => {
      if (!declared.includes(id)) return Promise.resolve(null);
      let p = fetches.get(url);
      if (!p) {
        p = exists(url).then((ok) => (ok ? loader.loadAsync(url) : null));
        p.catch(() => {}); // el error se trata al colocarlo
        fetches.set(url, p);
      }
      return p;
    };
    for (const id of Object.keys(MODEL_URLS) as ModelId[]) void fetchModel(id, MODEL_URLS[id]);
    for (const id of Object.keys(MODULE_MODEL_URLS) as ModuleId[]) void fetchModel(id, MODULE_MODEL_URLS[id]);
    void fetchModel('shelter', SHELTER_MODEL_URL);
    for (const id of Object.keys(MODEL_URLS) as ModelId[]) {
      const url = MODEL_URLS[id];
      try {
        const gltf = await fetchModel(id, url);
        if (!gltf) continue;
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
      try {
        const gltf = await fetchModel(id, url);
        if (!gltf) continue;
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
            // Las piezas con el material "glow" se encienden con la energía, como en la forma procedural.
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            if (mats.some((mat) => mat.name === 'glow')) {
              mats.forEach((mat) => mat.dispose());
              o.material = parts.get(id)!.band;
            } else if (mats.some((mat) => mat.name === 'glass')) {
              for (const mat of mats) {
                mat.transparent = true;
                mat.opacity = 0.26;
                mat.depthWrite = false;
              }
              o.castShadow = false;
            }
            o.userData.moduleId = id;
            pickables.push(o);
            // El casco del modelo también se oscurece en obras.
            const part = parts.get(id)!;
            for (const mat of mats) {
              if (mat instanceof THREE.MeshStandardMaterial && mat.name !== 'glass' && !part.tint.some((t) => t.mat === mat)) {
                part.tint.push({ mat, base: mat.color.clone() });
              }
            }
            part.lockApplied = -1;
          }
        });
        shape.add(gltf.scene);
        loaded.push(id);
      } catch (error) {
        console.warn(`[base] ${url} no se pudo cargar; se usa la forma procedural.`, error);
      }
    }
    // Refugio.
    {
      try {
        const gltf = await fetchModel('shelter', SHELTER_MODEL_URL);
        if (!gltf) return loaded;
        if (!disposed) {
          fitModel(gltf.scene, 4.1);
          gltf.scene.traverse((o) => {
            o.castShadow = true;
            o.receiveShadow = true;
            if (o instanceof THREE.Mesh && !Array.isArray(o.material) && o.material.name === 'glow') {
              o.material.dispose();
              o.material = shelterGlow;
            }
          });
          // La escotilla del refugio mira al sur (+Z), entre el taller y el blindaje.
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
  let selectedId: ModuleId | null = null;

  return {
    group,
    pickables,
    setModule(id, state) {
      const p = parts.get(id);
      if (!p) return;
      const locked = state.locked === true;
      const first = !p.configured;
      if (first) {
        // El primer estado se aplica de golpe: al cargar la partida no hay obras que se "construyan".
        p.configured = true;
        p.lock = locked ? 1 : 0;
        p.lockApplied = -1;
      } else if (p.locked && !locked) p.unlockPending = true;
      if (first || locked !== p.locked) labels.get(id)?.setLocked(locked);
      p.locked = locked;
      p.target = { efficiency: THREE.MathUtils.clamp(state.efficiency, 0, 1), broken: state.broken };
    },
    setLabels(names) {
      for (const [id, label] of labels) label.setText(names[id]);
    },
    setLabelsVisible(visible) {
      for (const label of labels.values()) label.sprite.visible = visible;
    },
    setHover(id) {
      hovered = id;
    },
    setSelected(id) {
      selectedId = id;
    },
    routes,
    setCorridorLight(level) {
      corridorLevel = level;
    },
    setLowQuality(low) {
      for (const tube of tubes) tube.material = low || coarse ? glassLow : glassHigh;
    },
    setShelter(active) {
      shelterTarget = active ? 1 : 0;
    },
    setRoverAway(away) {
      roverAwayTarget = away ? 1 : 0;
    },
    setRoverClean(on) {
      roverCleanTarget = on ? 1 : 0;
    },
    update(dt, time, reducedMotion) {
      for (const [id, p] of parts) {
        // Obras: el andamio se levanta o se retira con amortiguación; al desbloquear, destello ámbar suave.
        if (p.unlockPending) {
          p.unlockPending = false;
          if (!reducedMotion) p.flashT = 0;
        }
        const lockGoal = p.locked ? 1 : 0;
        p.lock = reducedMotion ? lockGoal : damp(p.lock, lockGoal, p.locked ? BUILD_K_LOCK : BUILD_K_UNLOCK, dt);
        if (Math.abs(p.lock - lockGoal) < 0.002) p.lock = lockGoal;
        if (p.lock !== p.lockApplied) {
          p.lockApplied = p.lock;
          p.scaffold.setBuild(p.lock);
          const shade = 1 - LOCK_DARKEN * p.lock;
          p.material.color.copy(HULL_COLOR).multiplyScalar(shade);
          for (const t of p.tint) t.mat.color.copy(t.base).multiplyScalar(shade);
        }
        let flash = 0;
        if (p.flashT >= 0) {
          p.flashT += dt / FLASH_SECONDS;
          if (p.flashT >= 1) p.flashT = -1;
          else flash = Math.sin(Math.PI * p.flashT);
        }
        const lit = 1 - p.lock;
        p.stripMat.emissiveIntensity = 1.6 * corridorLevel * (1 - 0.92 * p.lock);
        // Un módulo en obras no tiene anillo de selección ni hover.
        p.hover = damp(p.hover, hovered === id && !p.locked ? 1 : 0, 12, dt);
        p.shown = damp(p.shown, p.target.efficiency, 7, dt);
        p.selected = damp(p.selected, selectedId === id && !p.locked ? 1 : 0, 10, dt);
        // Late suave (menos de 1 vez por segundo) y crece un poco al elegirse.
        const beat = reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(time * 4);
        p.select.material.opacity = p.selected * 0.85 * beat + p.hover * 0.25;
        p.select.scale.setScalar(0.92 + 0.08 * p.selected);
        p.select.visible = p.select.material.opacity > 0.01;
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
          p.band.emissiveIntensity = (0.05 + p.shown * 2.6) * lit + flash * 2.2;
          p.lamp.intensity = p.shown * 42 * lit + flash * 34;
          p.material.emissiveIntensity = (p.shown * 0.06 + p.hover * 0.12) * lit + flash * 0.12;
        }
      }
      shelterShown = damp(shelterShown, shelterTarget, 4, dt);
      shelterMat.emissiveIntensity = shelterShown * 0.9;
      shelterGlow.emissiveIntensity = 0.15 + shelterShown * 3;
      shelterLamp.intensity = shelterShown * 60;

      // El rover sale hacia el sur y vuelve, sin teletransportes.
      roverAway = damp(roverAway, roverAwayTarget, 0.9, dt);
      roverClean = reducedMotion ? roverCleanTarget : damp(roverClean, roverCleanTarget, 0.9, dt);
      if (Math.abs(roverClean - roverCleanTarget) < 0.002) roverClean = roverCleanTarget;
      // Limpieza de polvo: el rover se acerca al campo solar y vuelve (la altura sigue al terreno).
      const rx = roverHome.x + roverClean * (CLEAN_SPOT.x - roverHome.x);
      const rz = roverHome.z + roverClean * (CLEAN_SPOT.z - roverHome.z);
      const ry = roverClean > 0.001 ? heightAt(rx, rz) : roverHome.y;
      rover.position.set(rx + roverAway * 30, ry, rz + roverAway * 70);
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
