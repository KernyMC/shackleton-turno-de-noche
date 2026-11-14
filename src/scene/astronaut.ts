// Astronauta "juguete premium": casco grande y redondo, visor dorado con borde, traje blanco hueso
// con anillos de pliegue, panel de pecho con luces, mochila PLSS con tubos, brazos con codo y guantes,
// rodilleras y botas gruesas. El color del tripulante marca cinturón, anillo del pecho, hombros y brazos.
//
// Rendimiento: todas las geometrías son compartidas entre astronautas (se construyen una vez, fusionadas
// por hueso y material) y los materiales estáticos también. Solo son por instancia los materiales que
// cambian con el estado (color y brillo de foco, visor con destello, linterna). Cada astronauta son 19 mallas.
// Con foco, da un paso al frente y se ilumina con su color (halo aditivo, sin luces dinámicas).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildAstronautRig, loadAstronautModel } from './astronautModel';
import type { AstronautRig, AstronautRigPose } from './astronautModel';

/** Poses de trabajo y gestos (se mezclan con damp sobre la animación base). */
export type AstronautPose = 'stand' | 'crouch' | 'reach' | 'carry' | 'inspect' | 'cheer' | 'slump';

export interface Astronaut {
  group: THREE.Group;
  /** Mallas que responden al puntero. */
  pickables: THREE.Object3D[];
  setFocus(focused: boolean): void;
  /** 0 = quieto, 1 = caminando, 2 = corriendo. Mueve piernas y brazos. */
  setWalking(pace: number): void;
  /** Linterna del casco (de noche). */
  setLamp(on: boolean): void;
  /** Destello del Sol en el visor, de 0 a 1. */
  setGlint(amount: number): void;
  /** Pose o gesto con intensidad 0..1 (se amortigua; con movimiento reducido es instantánea). */
  setPose(pose: AstronautPose, amount?: number): void;
  /** Salto corto y flotante de baja gravedad (alegría). */
  hop(): void;
  /** Puntos de la mano (en el hueso del brazo) para sujetar accesorios. */
  hands: { right: THREE.Object3D; left: THREE.Object3D };
  update(dt: number, time: number, reducedMotion: boolean): void;
  dispose(): void;
}

interface PoseDef {
  armR: number; armRw: number; armL: number; armLw: number;
  crouch: number; lean: number; headX: number; out: number;
}
const NONE: PoseDef = { armR: 0, armRw: 0, armL: 0, armLw: 0, crouch: 0, lean: 0, headX: 0, out: 0 };
// rotation.x negativa levanta el brazo hacia delante; -PI lo deja vertical.
const POSES: Record<AstronautPose, PoseDef> = {
  stand: NONE,
  crouch: { armR: -0.85, armRw: 1, armL: -0.85, armLw: 1, crouch: 1, lean: 0.35, headX: 0.25, out: 0 },
  reach: { armR: -1.35, armRw: 1, armL: 0, armLw: 0, crouch: 0, lean: 0.05, headX: 0.05, out: 0 },
  carry: { armR: 0, armRw: 0, armL: -0.35, armLw: 1, crouch: 0, lean: 0, headX: 0, out: 0 },
  inspect: { armR: -0.95, armRw: 1, armL: 0, armLw: 0, crouch: 0, lean: 0.05, headX: 0.4, out: 0 },
  cheer: { armR: -2.8, armRw: 1, armL: 0, armLw: 0, crouch: 0, lean: -0.05, headX: -0.15, out: 0.25 },
  slump: { armR: 0.15, armRw: 1, armL: 0.15, armLw: 1, crouch: 0, lean: 0.3, headX: 0.35, out: -0.08 },
};
/** Cuánto se encogen las piernas con la cuclilla completa y cuánto baja el cuerpo (m). */
const CROUCH_SQUASH = 0.38;
const CROUCH_DROP = 0.74 * CROUCH_SQUASH;

const SUIT = 0xe9e6de;
const DARK = 0x2a2b2e;
const METAL = 0x7d8087;
const AMBER = 0xffb347;
const HALF_PI = Math.PI / 2;

type V3 = [number, number, number];
const _o = new THREE.Object3D();
/** Transforma una geometría en sitio y la devuelve. `parent` es una matriz previa (p. ej. la del codo). */
function place<G extends THREE.BufferGeometry>(geo: G, p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], s: V3 = [1, 1, 1], parent?: THREE.Matrix4): G {
  _o.position.set(...p);
  _o.rotation.set(...r);
  _o.scale.set(...s);
  _o.updateMatrix();
  const m = _o.matrix.clone();
  if (parent) m.premultiply(parent);
  geo.applyMatrix4(m);
  return geo;
}
const merge = (list: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  // Algunas geometrías vienen indexadas y otras no: se igualan antes de fusionar.
  const flatList = list.map((x) => {
    const n = x.index ? x.toNonIndexed() : x;
    if (n !== x) x.dispose();
    return n;
  });
  const g = mergeGeometries(flatList, false);
  flatList.forEach((x) => x.dispose());
  return g;
};
const ball = (r: number, w = 16, h = 12): THREE.SphereGeometry => new THREE.SphereGeometry(r, w, h);
/** Anillo (eje z); con rotación x de PI/2 queda horizontal. */
const torus = (radius: number, tube: number, segments = 20): THREE.TorusGeometry => new THREE.TorusGeometry(radius, tube, 6, segments);
const rbox = (w: number, h: number, d: number, radius: number): THREE.BufferGeometry => new RoundedBoxGeometry(w, h, d, 2, radius);
const flat: V3 = [HALF_PI, 0, 0];

function radialTexture(stops: [number, string][]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Shared {
  geos: THREE.BufferGeometry[];
  bodySuit: THREE.BufferGeometry;
  bodyMetal: THREE.BufferGeometry;
  bodyDark: THREE.BufferGeometry;
  bodyAccent: THREE.BufferGeometry;
  bodyLight: THREE.BufferGeometry;
  helmet: THREE.BufferGeometry;
  headMetal: THREE.BufferGeometry;
  visor: THREE.BufferGeometry;
  lamp: THREE.BufferGeometry;
  armSuit: THREE.BufferGeometry;
  armAccent: THREE.BufferGeometry;
  armDark: THREE.BufferGeometry;
  legSuit: THREE.BufferGeometry;
  legDark: THREE.BufferGeometry;
  suit: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  panelLight: THREE.MeshStandardMaterial;
  glintTexture: THREE.CanvasTexture;
  haloTexture: THREE.CanvasTexture;
}

let shared: Shared | null = null;
let refs = 0;

function buildShared(): Shared {
  // ---- Cuerpo: torso, pelvis, hombros, cuello, mochila y panel ----
  const bodySuit = merge([
    place(new THREE.CapsuleGeometry(0.36, 0.16, 6, 16), [0, 1.07, 0], [0, 0, 0], [1, 1, 0.82]), // torso
    place(ball(0.32, 18, 12), [0, 0.74, 0], [0, 0, 0], [1, 0.6, 0.85]), // pelvis
    place(ball(0.42, 18, 12), [0, 1.4, 0], [0, 0, 0], [1, 0.45, 0.8]), // yugo de hombros
    place(new THREE.CylinderGeometry(0.24, 0.25, 0.14, 16), [0, 1.47, 0]), // cuello
    place(torus(0.26, 0.07, 18), [0, 1.42, 0], flat, [1, 0.9, 1]), // cuello acolchado
    // pliegues sugeridos: anillos sutiles en el torso
    place(torus(0.365, 0.028, 22), [0, 0.98, 0], flat, [1, 0.82, 1]),
    place(torus(0.372, 0.026, 22), [0, 1.15, 0], flat, [1, 0.82, 1]),
    place(rbox(0.52, 0.62, 0.26, 0.07), [0, 1.12, -0.34]), // mochila PLSS
  ]);
  const bodyMetal = merge([
    place(torus(0.245, 0.035, 18), [0, 1.53, 0], flat), // aro del cuello
    place(rbox(0.46, 0.07, 0.24, 0.03), [0, 1.46, -0.34]), // tapa superior de la mochila
    place(rbox(0.46, 0.07, 0.24, 0.03), [0, 0.8, -0.34]), // tapa inferior
    place(new THREE.CylinderGeometry(0.07, 0.07, 0.46, 10), [-0.15, 1.12, -0.49]), // depósitos
    place(new THREE.CylinderGeometry(0.07, 0.07, 0.46, 10), [0.15, 1.12, -0.49]),
  ]);
  const tubeLeft = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.14, 1.46, -0.4), new THREE.Vector3(-0.24, 1.66, -0.34), new THREE.Vector3(-0.15, 1.7, -0.14), new THREE.Vector3(-0.09, 1.52, -0.1)]);
  const tubeRight = new THREE.CatmullRomCurve3([new THREE.Vector3(0.14, 1.46, -0.4), new THREE.Vector3(0.24, 1.66, -0.34), new THREE.Vector3(0.15, 1.7, -0.14), new THREE.Vector3(0.09, 1.52, -0.1)]);
  const bodyDark = merge([
    place(rbox(0.3, 0.2, 0.06, 0.02), [0, 1.2, 0.3]), // panel de control
    new THREE.TubeGeometry(tubeLeft, 14, 0.026, 5, false), // tubos de la mochila al casco
    new THREE.TubeGeometry(tubeRight, 14, 0.026, 5, false),
    place(rbox(0.12, 0.09, 0.05, 0.02), [0, 0.8, 0.28]), // hebilla del cinturón
  ]);
  const bodyAccent = merge([
    place(torus(0.318, 0.05, 22), [0, 0.8, 0], flat, [1, 0.84, 1]), // cinturón
    place(torus(0.335, 0.032, 22), [0, 1.3, 0], flat, [1, 0.82, 1]), // anillo del pecho
    place(ball(0.022, 8, 6), [-0.09, 1.25, 0.335]), // luz del panel con el color del tripulante
    place(rbox(0.5, 0.05, 0.265, 0.02), [0, 1.3, -0.34]), // franja de la mochila
  ]);
  const bodyLight = merge([
    place(ball(0.022, 8, 6), [0, 1.25, 0.335]),
    place(ball(0.022, 8, 6), [0.09, 1.25, 0.335]),
    place(rbox(0.16, 0.03, 0.02, 0.008), [0, 1.16, 0.332]), // barra de estado
  ]);

  // ---- Cabeza: casco, visor con borde, orejeras y linterna (origen en el centro del casco) ----
  const helmet = ball(0.4, 20, 14);
  const headMetal = merge([
    // borde del visor: una cáscara algo más grande que el visor, detrás de él
    place(new THREE.SphereGeometry(0.418, 20, 10, Math.PI * 0.13, Math.PI * 0.74, Math.PI * 0.22, Math.PI * 0.56)),
    place(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 10), [-0.4, 0, 0], [0, 0, HALF_PI]), // orejeras
    place(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 10), [0.4, 0, 0], [0, 0, HALF_PI]),
    place(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), [0.25, 0.2, 0.235], flat), // carcasa de la linterna
  ]);
  const visor = new THREE.SphereGeometry(0.428, 20, 10, Math.PI * 0.17, Math.PI * 0.66, Math.PI * 0.27, Math.PI * 0.46);
  const lamp = place(ball(0.05, 10, 8), [0.25, 0.2, 0.265]);

  // ---- Brazo (origen en el hombro, cuelga hacia -y; el antebrazo ya viene doblado hacia delante) ----
  const elbow = new THREE.Matrix4().compose(new THREE.Vector3(0, -0.46, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0, 0)), new THREE.Vector3(1, 1, 1));
  const armSuit = merge([
    place(new THREE.CapsuleGeometry(0.12, 0.22, 4, 12), [0, -0.23, 0]), // brazo
    place(new THREE.CapsuleGeometry(0.11, 0.2, 4, 12), [0, -0.21, 0], [0, 0, 0], [1, 1, 1], elbow), // antebrazo
  ]);
  const armAccent = merge([
    place(ball(0.17, 14, 10), [0, 0.02, 0], [0, 0, 0], [1, 0.8, 1]), // hombrera
    place(new THREE.CylinderGeometry(0.128, 0.128, 0.1, 14), [0, -0.3, 0]), // banda del brazo
  ]);
  const armDark = merge([
    place(ball(0.116, 12, 8), [0, 0, 0], [0, 0, 0], [1, 1, 1], elbow), // codo
    place(torus(0.117, 0.035, 14), [0, -0.34, 0], flat, [1, 1, 1], elbow), // puño
    place(ball(0.13, 14, 10), [0, -0.46, 0.0], [0, 0, 0], [1, 1.05, 1], elbow), // guante redondeado
  ]);

  // ---- Pierna (origen en la cadera, el suelo queda en y = -0.74) ----
  const legSuit = merge([
    place(new THREE.CapsuleGeometry(0.15, 0.42, 4, 12), [0, -0.34, 0]), // muslo y pantorrilla
    place(rbox(0.3, 0.18, 0.46, 0.07), [0, -0.64, 0.06]), // bota gruesa
  ]);
  const legDark = merge([
    place(rbox(0.25, 0.16, 0.1, 0.04), [0, -0.3, 0.14]), // rodillera
    place(torus(0.152, 0.03, 14), [0, -0.56, 0], flat), // tobillo
    place(rbox(0.33, 0.07, 0.5, 0.03), [0, -0.705, 0.07]), // suela oscura
  ]);

  const mat = (m: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial(m);
  const s: Shared = {
    geos: [],
    bodySuit, bodyMetal, bodyDark, bodyAccent, bodyLight, helmet, headMetal, visor, lamp, armSuit, armAccent, armDark, legSuit, legDark,
    suit: mat({ color: SUIT, roughness: 0.82 }),
    metal: mat({ color: METAL, roughness: 0.5, metalness: 0.45 }),
    dark: mat({ color: DARK, roughness: 0.7 }),
    panelLight: mat({ color: 0x2a1a08, emissive: AMBER, emissiveIntensity: 1.3 }),
    glintTexture: radialTexture([[0, 'rgba(255,244,214,1)'], [0.35, 'rgba(255,214,140,0.55)'], [1, 'rgba(255,190,100,0)']]),
    haloTexture: radialTexture([[0, 'rgba(255,255,255,0.9)'], [0.45, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]),
  };
  s.geos = [bodySuit, bodyMetal, bodyDark, bodyAccent, bodyLight, helmet, headMetal, visor, lamp, armSuit, armAccent, armDark, legSuit, legDark];
  return s;
}

function acquire(): Shared {
  if (!shared) shared = buildShared();
  refs++;
  return shared;
}

function release(): void {
  if (!shared || --refs > 0) return;
  shared.geos.forEach((g) => g.dispose());
  shared.suit.dispose();
  shared.metal.dispose();
  shared.dark.dispose();
  shared.panelLight.dispose();
  shared.glintTexture.dispose();
  shared.haloTexture.dispose();
  shared = null;
  refs = 0;
}

const damp = (current: number, target: number, k: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-k * dt));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createAstronaut(color: number, phase = 0): Astronaut {
  const sh = acquire();
  const group = new THREE.Group();
  const body = new THREE.Group(); // lo que respira y se inclina
  const head = new THREE.Group(); // lo que gira
  group.add(body);

  // Materiales por instancia: solo lo que cambia con el estado.
  const accent = new THREE.MeshStandardMaterial({ color, roughness: 0.55, emissive: color, emissiveIntensity: 0.15 });
  // Visor dorado y liso: brilla cálido y refleja el Sol rasante.
  const visor = new THREE.MeshStandardMaterial({ color: 0x6b4a14, roughness: 0.12, metalness: 0.65, emissive: 0x7a5420, emissiveIntensity: 0.45 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xfff1c8, emissiveIntensity: 0 });
  const glintMat = new THREE.SpriteMaterial({
    map: sh.glintTexture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const haloMat = new THREE.SpriteMaterial({
    map: sh.haloTexture,
    color,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const ownMaterials = [accent, visor, lamp, glintMat, haloMat];

  const meshes: THREE.Mesh[] = [];
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, shadow = false): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow;
    parent.add(m);
    meshes.push(m);
    return m;
  };

  // Cuerpo (5 mallas) y cabeza (4).
  mesh(sh.bodySuit, sh.suit, body, true);
  mesh(sh.bodyMetal, sh.metal, body);
  mesh(sh.bodyDark, sh.dark, body);
  mesh(sh.bodyAccent, accent, body);
  mesh(sh.bodyLight, sh.panelLight, body);
  head.position.set(0, 1.8, 0);
  body.add(head);
  mesh(sh.helmet, sh.suit, head);
  mesh(sh.headMetal, sh.metal, head);
  mesh(sh.visor, visor, head);
  mesh(sh.lamp, lamp, head);
  const glintSprite = new THREE.Sprite(glintMat);
  glintSprite.scale.setScalar(0.24);
  glintSprite.position.set(0.12, 0.08, 0.45);
  glintSprite.visible = false;
  head.add(glintSprite);

  // Brazos (3 mallas cada uno) con pivote en el hombro.
  const arms: THREE.Group[] = [];
  const hands: THREE.Object3D[] = [];
  const armRest: number[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.5, 1.4, 0);
    shoulder.rotation.z = side * 0.14;
    body.add(shoulder);
    mesh(sh.armSuit, sh.suit, shoulder);
    mesh(sh.armAccent, accent, shoulder);
    mesh(sh.armDark, sh.dark, shoulder);
    arms.push(shoulder);
    armRest.push(side * 0.14);
    // Punto de la mano: donde queda el guante (codo en (0,-0.46,0) girado -0.5 en x).
    const hand = new THREE.Object3D();
    hand.position.set(0, -0.86, 0.22);
    shoulder.add(hand);
    hands.push(hand);
  }
  // Piernas (2 mallas cada una) con pivote en la cadera.
  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.17, 0.74, 0);
    body.add(hip);
    mesh(sh.legSuit, sh.suit, hip, true);
    mesh(sh.legDark, sh.dark, hip);
    legs.push(hip);
  }

  // Halo de foco detrás del cuerpo (en lugar de una luz dinámica por astronauta).
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(3.4, 3.6, 1);
  halo.position.set(0, 1.15, -0.5);
  halo.visible = false;
  group.add(halo);

  const pickables: THREE.Object3D[] = meshes;

  let focusTarget = 0;
  let focus = 0;
  let paceTarget = 0;
  let pace = 0;
  let stride = phase;
  let disposed = false;
  // Pose actual (valores y pesos amortiguados) y objetivo.
  const pose = { armR: 0, armRw: 0, armL: 0, armLw: 0, crouch: 0, lean: 0, headX: 0, out: 0 };
  const poseGoal = { ...pose };
  let hopT = 99;
  const HOP_SECONDS = 1.1;
  const HOP_HEIGHT = 0.4;
  const visorBase = visor.emissiveIntensity;

  // Modelo 3D (si está instalado): sustituye al cuerpo dibujado por código, que queda oculto pero
  // sigue sirviendo para el puntero y como respaldo. Se mueve con los mismos valores.
  let rig: AstronautRig | null = null;
  const rigPose: AstronautRigPose = { armRx: 0, armRz: 0, armLx: 0, armLz: 0, legR: 0, legL: 0, crouch: 0, headX: 0, headY: 0, headZ: 0 };
  void loadAstronautModel().then((src) => {
    if (!src || disposed) return;
    rig = buildAstronautRig(src, color);
    body.add(rig.root);
    meshes.forEach((m) => (m.visible = false));
    glintSprite.position.set(0.16, 0.14, 0.7);
  });
  const syncRig = (): void => {
    if (!rig) return;
    rig.setGlow(focus);
    rigPose.armRx = arms[0]!.rotation.x;
    rigPose.armRz = arms[0]!.rotation.z;
    rigPose.armLx = arms[1]!.rotation.x;
    rigPose.armLz = arms[1]!.rotation.z;
    rigPose.legR = legs[0]!.rotation.x - 0.45 * pose.crouch;
    rigPose.legL = legs[1]!.rotation.x - 0.45 * pose.crouch;
    rigPose.crouch = pose.crouch;
    rigPose.headX = head.rotation.x;
    rigPose.headY = head.rotation.y;
    rigPose.headZ = head.rotation.z;
    rig.apply(rigPose);
  };
  return {
    group,
    pickables,
    setFocus(focused) {
      focusTarget = focused ? 1 : 0;
    },
    setWalking(value) {
      paceTarget = value;
    },
    setLamp(on) {
      lamp.emissiveIntensity = on ? 3 : 0;
    },
    setGlint(amount) {
      const a = Math.min(1, Math.max(0, amount));
      glintMat.opacity = a * 0.9;
      glintSprite.visible = a > 0.01;
      visor.emissiveIntensity = visorBase + a * 0.5;
    },
    hands: { right: hands[0]!, left: hands[1]! },
    setPose(name, amount = 1) {
      const p = POSES[name];
      const a = Math.min(1, Math.max(0, amount));
      // El valor del brazo solo cambia si la pose lo usa: al soltar, el peso baja y el brazo vuelve a la marcha.
      if (p.armRw > 0) poseGoal.armR = p.armR;
      if (p.armLw > 0) poseGoal.armL = p.armL;
      poseGoal.armRw = p.armRw * a;
      poseGoal.armLw = p.armLw * a;
      poseGoal.crouch = p.crouch * a;
      poseGoal.lean = p.lean * a;
      poseGoal.headX = p.headX * a;
      poseGoal.out = p.out * a;
    },
    hop() {
      hopT = 0;
    },
    update(dt, time, reducedMotion) {
      focus = damp(focus, focusTarget, 9, dt);
      pace = damp(pace, paceTarget, 8, dt);
      body.position.z = focus * 0.9; // un paso al frente
      accent.emissiveIntensity = 0.15 + focus * 0.8;
      haloMat.opacity = focus * 0.5;
      halo.visible = focus > 0.01;
      // Pose: con movimiento reducido salta al objetivo; si no, se amortigua.
      const k = reducedMotion ? 1000 : 7;
      pose.armR = damp(pose.armR, poseGoal.armR, k, dt);
      pose.armL = damp(pose.armL, poseGoal.armL, k, dt);
      pose.armRw = damp(pose.armRw, poseGoal.armRw, k, dt);
      pose.armLw = damp(pose.armLw, poseGoal.armLw, k, dt);
      pose.crouch = damp(pose.crouch, poseGoal.crouch, k, dt);
      pose.lean = damp(pose.lean, poseGoal.lean, k, dt);
      pose.headX = damp(pose.headX, poseGoal.headX, k, dt);
      pose.out = damp(pose.out, poseGoal.out, k, dt);
      const squash = 1 - CROUCH_SQUASH * pose.crouch;
      if (reducedMotion) {
        body.scale.y = 1;
        head.rotation.set(pose.headX, 0, 0);
        legs.forEach((l) => {
          l.rotation.x = 0.45 * pose.crouch;
          l.scale.y = squash;
        });
        arms.forEach((a, i) => {
          const w = i === 0 ? pose.armRw : pose.armLw;
          const v = i === 0 ? pose.armR : pose.armL;
          a.rotation.set(v * w, 0, armRest[i]! + (i === 0 ? -1 : 1) * pose.out);
        });
        body.position.y = -CROUCH_DROP * pose.crouch;
        body.rotation.set(pose.lean, 0, 0);
        syncRig();
        return;
      }
      const walk = Math.min(1, pace);
      const run = Math.max(0, pace - 1);
      // Caminar: zancada proporcional al paso; con gravedad lunar, pasos largos y flotantes.
      stride += dt * (4.2 + pace * 2.2) * Math.min(1, pace * 2);
      const s = Math.sin(stride);
      const swing = s * (0.55 * walk + 0.25 * run);
      legs[0]!.rotation.x = swing;
      legs[1]!.rotation.x = -swing;
      // Los brazos mezclan la marcha con la pose de trabajo (peso 0 = marcha pura).
      arms[0]!.rotation.x = -swing * 0.85 * (1 - pose.armRw) + (pose.armR + Math.sin(time * 3.4 + phase) * 0.07) * pose.armRw;
      arms[1]!.rotation.x = swing * 0.85 * (1 - pose.armLw) + pose.armL * pose.armLw;
      legs[0]!.rotation.x += 0.45 * pose.crouch;
      legs[1]!.rotation.x += 0.45 * pose.crouch;
      legs[0]!.scale.y = legs[1]!.scale.y = squash;
      // Respira en reposo y balancea los brazos hacia fuera al andar.
      const breath = Math.sin(time * 1.9 + phase);
      const idle = 1 - walk;
      arms[0]!.rotation.z = armRest[0]! + breath * 0.012 * idle - Math.abs(s) * 0.05 * walk - pose.out;
      arms[1]!.rotation.z = armRest[1]! - breath * 0.012 * idle + Math.abs(s) * 0.05 * walk + pose.out;
      // Rebote suave y flotante (seno al cuadrado: sin picos al tocar el suelo).
      hopT += dt;
      const hop = hopT < HOP_SECONDS ? Math.sin((Math.PI * hopT) / HOP_SECONDS) * HOP_HEIGHT : 0;
      body.position.y = s * s * (0.1 * walk + 0.06 * run) - CROUCH_DROP * pose.crouch + hop;
      body.rotation.x = 0.09 * walk + 0.05 * run + pose.lean;
      body.rotation.y = -s * 0.07 * walk;
      body.rotation.z = Math.cos(stride) * 0.025 * walk;
      body.scale.y = 1 + 0.012 * breath * idle;
      // La cabeza compensa el cuerpo y, en reposo, mira a un lado de vez en cuando.
      const glance = Math.sin(time * 0.7 + phase * 1.7) * smoothstep(0.25, 0.85, Math.sin(time * 0.19 + phase * 2.3));
      head.rotation.y = -body.rotation.y * 0.9 + 0.5 * glance * idle;
      head.rotation.x = -body.rotation.x * 0.8 + 0.05 * Math.sin(time * 0.31 + phase) + pose.headX;
      head.rotation.z = -body.rotation.z * 0.8;
      syncRig();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ownMaterials.forEach((m) => m.dispose());
      rig?.dispose();
      release();
    },
  };
}
