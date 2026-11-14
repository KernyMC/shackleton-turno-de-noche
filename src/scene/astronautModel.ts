// Modelo 3D del astronauta: «Little Astronaut» de Jelle Vermandere (Sketchfab, CC-BY 4.0; ver CREDITS.md).
// Es una malla con esqueleto y una paleta de tres colores (traje, detalles oscuros y acento).
// Aquí se carga una sola vez, se clona por tripulante con su color de acento y se mueve por huesos
// con los mismos valores que calcula `astronaut.ts` (marcha, poses, cabeza). Si el archivo no está
// o falla, `astronaut.ts` sigue usando su astronauta dibujado por código.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { optionalAssets } from './assets';

const MODEL_URL = '/models/astronaut.glb';
/** Altura en unidades de juego (igual que el astronauta dibujado por código). */
const HEIGHT = 2.3;
/** Colores fijos de la paleta: detalles oscuros y traje. El tercero es el color del tripulante. */
const DARK: [number, number, number] = [34, 36, 40];
const SUIT: [number, number, number] = [236, 233, 225];

export interface AstronautRigPose {
  armRx: number; armRz: number; armLx: number; armLz: number;
  legR: number; legL: number; crouch: number;
  headX: number; headY: number; headZ: number;
}

export interface AstronautRig {
  root: THREE.Group;
  /** Sube el brillo propio del acento (foco). */
  setGlow(amount: number): void;
  apply(pose: AstronautRigPose): void;
  dispose(): void;
}

let source: Promise<THREE.Object3D | null> | null = null;

/** Carga el modelo una sola vez. Devuelve null si no está instalado, no hay WebGL o falla. */
export function loadAstronautModel(): Promise<THREE.Object3D | null> {
  source ??= (async () => {
    if (typeof document === 'undefined') return null;
    try {
      if (!(await optionalAssets()).models.includes('astronaut')) return null;
      const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
      return gltf.scene;
    } catch (error) {
      console.warn('[astronaut] Se usa el astronauta dibujado por código:', error);
      return null;
    }
  })();
  return source;
}

/** Paleta 2×2 del modelo con el acento cambiado por el color del tripulante. */
function paletteTexture(color: number): THREE.DataTexture {
  const c = new THREE.Color(color).convertLinearToSRGB();
  const accent: [number, number, number] = [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
  const data = new Uint8Array([...DARK, 255, ...SUIT, 255, ...accent, 255, ...SUIT, 255]);
  const texture = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

interface Driven { bone: THREE.Bone; rest: THREE.Quaternion; parent: THREE.Quaternion; parentInv: THREE.Quaternion }

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

/** Gira un hueso en los ejes del cuerpo (no en los suyos): rest · giro, llevado al marco del padre. */
function drive(d: Driven | undefined, x: number, y: number, z: number): void {
  if (!d) return;
  _q.setFromEuler(_e.set(x, y, z, 'XYZ'));
  d.bone.quaternion.copy(d.parentInv).multiply(_q).multiply(d.parent).multiply(d.rest);
}

export function buildAstronautRig(src: THREE.Object3D, color: number): AstronautRig {
  const root = new THREE.Group();
  const model = SkeletonUtils.clone(src);
  root.add(model);
  // Escala y apoyo en el suelo a partir de la caja de la malla en reposo.
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const scale = HEIGHT / Math.max(0.001, box.max.y - box.min.y);
  model.scale.multiplyScalar(scale);
  model.position.y -= box.min.y * scale;

  const palette = paletteTexture(color);
  const material = new THREE.MeshStandardMaterial({ map: palette, roughness: 0.6, metalness: 0, emissiveMap: palette, emissive: 0xffffff, emissiveIntensity: 0.04 });
  model.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    mesh.material = material;
    mesh.castShadow = true;
    mesh.frustumCulled = false; // la caja de una malla con huesos no sigue a la pose
  });

  // Huesos que se mueven, con su giro de reposo y el de su padre en el marco del cuerpo.
  root.updateMatrixWorld(true);
  const find = (pattern: RegExp): Driven | undefined => {
    let found: THREE.Bone | undefined;
    model.traverse((o) => {
      if (!found && (o as THREE.Bone).isBone && pattern.test(o.name)) found = o as THREE.Bone;
    });
    if (!found?.parent) return undefined;
    const parent = found.parent.getWorldQuaternion(new THREE.Quaternion());
    return { bone: found, rest: found.quaternion.clone(), parent, parentInv: parent.clone().invert() };
  };
  const armR = find(/^UpperArm\.?r/i);
  const armL = find(/^UpperArm\.?l/i);
  const legR = find(/^upperLeg\.?r/i);
  const legL = find(/^upperLeg\.?l/i);
  const shinR = find(/^lowerleg\.?r/i);
  const shinL = find(/^lowerleg\.?l/i);
  const head = find(/^Head_0/i);

  return {
    root,
    setGlow(amount) {
      material.emissiveIntensity = 0.04 + amount * 0.3;
    },
    apply(p) {
      // El modelo viene con los brazos en cruz: se bajan un cuarto de vuelta y encima va el gesto.
      drive(armR, p.armRx, 0, Math.PI / 2 + p.armRz);
      drive(armL, p.armLx, 0, -Math.PI / 2 + p.armLz);
      // Cuclillas: muslo hacia delante y rodilla doblada (el cuerpo baja en `astronaut.ts`).
      drive(legR, p.legR - 1.5 * p.crouch, 0, 0);
      drive(legL, p.legL - 1.5 * p.crouch, 0, 0);
      drive(shinR, 1.9 * p.crouch, 0, 0);
      drive(shinL, 1.9 * p.crouch, 0, 0);
      drive(head, p.headX, p.headY, p.headZ);
    },
    dispose() {
      material.dispose();
      palette.dispose();
    },
  };
}
