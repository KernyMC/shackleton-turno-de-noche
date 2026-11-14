// "¿El Sol me da energía?" hecho visible: campo de paneles solares, batería con 5 celdas y,
// al pasar el día, rayos tenues del Sol y partículas ámbar que viajan panel -> batería -> módulos
// en proporción a la energía del plan. De noche no hay rayos: solo salen de la batería.
// Solo REFLEJA estado (lo que le dice world.ts). Todo en un grupo propio; en reposo, rayos y
// partículas están ocultos (coste de dibujo cero). Sin asignaciones por fotograma.

import * as THREE from 'three';
import type { ModuleId } from '../sim/types';
import { MODULES } from './base';
import { MODULE_TOP } from './modules';

export type EnergyTier = 'high' | 'medium' | 'low';

export interface EnergyFlow {
  group: THREE.Group;
  /** Sol ya suavizado por world.ts: luz 0..1 y azimut en radianes (mismo que el DirectionalLight). */
  setSun(light: number, azimuth: number): void;
  /** Carga de la batería, de 0 a 1. */
  setBattery(fraction: number): void;
  /** Arranca el reparto de energía del día. Sin efecto con movimiento reducido. */
  play(plan: Record<ModuleId, number>, night: boolean): void;
  /**
   * Polvo sobre los paneles: se ven grises y mates y dan menos rayos. Con `puff` (se acaban de limpiar,
   * polvo -> sin polvo) sale una nube que se expande y cae despacio. La nube no sale con movimiento reducido.
   */
  setDust(dusty: boolean, puff?: boolean): void;
  /** Calidad: en baja, la mitad de partículas y sin rayos. */
  setTier(tier: EnergyTier): void;
  update(dt: number, time: number, reduced: boolean): void;
  dispose(): void;
}

// Colores de docs/ARTE.md §3 (el ámbar es el único cálido).
const AMBER = 0xffb347;
const ALERT = 0xff5a4d;

/** Dónde queda el campo de paneles y la batería: fuera de pasillos y anillos de selección. */
const PANEL_X = 23;
const PANEL_ZS = [-6, -2, 2, 6] as const;
const PANEL_POST = 1.2;
const PANEL_TILT = 0.85; // rad: el panel se inclina hacia el Sol
const BATTERY_POS = { x: 7.5, z: 0 };
const BATTERY_SEGMENTS = 5;
const SEG_H = 0.42;
const SEG_GAP = 0.07;
const BATTERY_BASE_H = 0.3;
const BATTERY_TOP = BATTERY_BASE_H + BATTERY_SEGMENTS * (SEG_H + SEG_GAP) + 0.2;
const BATTERY_SCALE = 1.4;

/** Partículas por calidad (total, panel -> batería + batería -> módulos). */
const PARTICLES: Record<EnergyTier, number> = { high: 140, medium: 110, low: 70 };
const MAX_PARTICLES = PARTICLES.high;
/** Cuánto dura el reparto (el día "pasa" ~1,5 s; sobra un poco para que lleguen las últimas). */
const PLAY_SECONDS = 2.5;
/** Fracción de partículas que van de los paneles a la batería (de día). */
const PANEL_SHARE = 0.34;
const TRIP_MIN = 0.85;
const TRIP_SPAN = 0.5;
const SUN_RAY_LENGTH = 14;
/** Los rayos son un recurso visual: más inclinados que el Sol real (casi a ras de suelo parecerían un camino). */
const RAY_ELEVATION = 0.55;
const NIGHT_LIGHT = 0.1;
/** Polvo: cuánto se opacan los paneles y cuánto bajan los rayos y las partículas del Sol. */
const DUST_COVER = 0.72;
const DUST_RAY_CUT = 0.65;
const DUST_PARTICLE_CUT = 0.5;
const DUST_COLOR = 0x938e84;
const PANEL_BLUE = 0x1d4a8a;
const DUST_EMISSIVE = 0x6e6a62;
/** Nube de polvo al limpiar: partículas por calidad, duración y caída lenta (gravedad baja, no la lunar). */
const CLOUD: Record<EnergyTier, number> = { high: 44, medium: 28, low: 14 };
const MAX_CLOUD = CLOUD.high;
const CLOUD_SECONDS = 2.6;
const CLOUD_GRAVITY = 0.7;
const CLOUD_DRAG = 1.1;

const damp = (current: number, target: number, k: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-k * dt));

/** Generador pseudoaleatorio pequeño (visual; el reparto no depende del azar del motor). */
function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function cellTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0a1226';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#27457a';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 32, 0);
    ctx.lineTo(i * 32, 128);
    ctx.stroke();
  }
  for (let j = 0; j <= 2; j++) {
    ctx.beginPath();
    ctx.moveTo(0, j * 64);
    ctx.lineTo(128, j * 64);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Manchas suaves para el velo de polvo (mapa de opacidad): el polvo no cubre parejo. */
function dustAlphaTexture(rng: () => number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgb(150,150,150)';
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 26; i++) {
    const x = rng() * 64;
    const y = rng() * 64;
    const r = 6 + rng() * 14;
    const v = rng() > 0.35 ? 255 : 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${v},${v},${v},0.8)`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function createEnergyFlow(heightAt: (x: number, z: number) => number = () => 0): EnergyFlow {
  const group = new THREE.Group();
  const rng = makeRng(0x5eed);
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(d: T): T => (disposables.push(d), d);

  // --- Paneles solares ---
  const cells = own(cellTexture());
  const panelMat = own(
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: cells, roughness: 0.28, metalness: 0.55, emissive: 0x1d4a8a, emissiveIntensity: 0 }),
  );
  const panelGeo = own(new THREE.BoxGeometry(3.4, 0.1, 2.2));
  const veilGeo = own(new THREE.PlaneGeometry(3.3, 2.1));
  const veilMat = own(
    new THREE.MeshStandardMaterial({
      color: DUST_COLOR, roughness: 1, metalness: 0, transparent: true, opacity: 0, alphaMap: own(dustAlphaTexture(rng)), depthWrite: false,
    }),
  );
  const veils: THREE.Mesh[] = [];
  const postGeo = own(new THREE.CylinderGeometry(0.09, 0.12, PANEL_POST, 8));
  const metalMat = own(new THREE.MeshStandardMaterial({ color: 0x6a6b6e, roughness: 0.55, metalness: 0.35 }));
  const posts = new THREE.InstancedMesh(postGeo, metalMat, PANEL_ZS.length);
  posts.castShadow = true;
  const m4 = new THREE.Matrix4();
  const pivots: THREE.Group[] = [];
  /** Centro de cada panel (origen de los rayos y de las partículas que salen de él). */
  const panelCenters: THREE.Vector3[] = [];
  PANEL_ZS.forEach((z, i) => {
    const y = heightAt(PANEL_X, z);
    m4.makeTranslation(PANEL_X, y + PANEL_POST / 2, z);
    posts.setMatrixAt(i, m4);
    const pivot = new THREE.Group();
    pivot.position.set(PANEL_X, y + PANEL_POST, z);
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.rotation.x = PANEL_TILT;
    panel.position.y = 0.3;
    panel.castShadow = true;
    panel.receiveShadow = true;
    // Velo de polvo sobre la cara del panel (oculto mientras no hay polvo).
    const veil = new THREE.Mesh(veilGeo, veilMat);
    veil.rotation.x = -Math.PI / 2;
    veil.position.y = 0.058;
    veil.renderOrder = 1;
    veil.visible = false;
    panel.add(veil);
    veils.push(veil);
    pivot.add(panel);
    group.add(pivot);
    pivots.push(pivot);
    panelCenters.push(new THREE.Vector3(PANEL_X, y + PANEL_POST + 0.3, z));
  });
  posts.instanceMatrix.needsUpdate = true;
  group.add(posts);

  // --- Batería: 5 celdas apiladas que se encienden con la carga ---
  const bx = BATTERY_POS.x;
  const bz = BATTERY_POS.z;
  const by = heightAt(bx, bz);
  const battery = new THREE.Group();
  battery.position.set(bx, by, bz);
  battery.scale.setScalar(BATTERY_SCALE);
  const darkMat = own(new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.7, metalness: 0.3 }));
  const baseGeo = own(new THREE.BoxGeometry(2.3, BATTERY_BASE_H, 2.3));
  const capGeo = own(new THREE.BoxGeometry(1.7, 0.2, 1.7));
  const base = new THREE.Mesh(baseGeo, darkMat);
  base.position.y = BATTERY_BASE_H / 2;
  const cap = new THREE.Mesh(capGeo, metalMat);
  cap.position.y = BATTERY_TOP - 0.1;
  base.castShadow = cap.castShadow = true;
  base.receiveShadow = cap.receiveShadow = true;
  battery.add(base, cap);
  const segGeo = own(new THREE.BoxGeometry(1.9, SEG_H, 1.9));
  const segMats: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < BATTERY_SEGMENTS; i++) {
    const mat = own(new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.5, metalness: 0.2, emissive: AMBER, emissiveIntensity: 0 }));
    segMats.push(mat);
    const seg = new THREE.Mesh(segGeo, mat);
    seg.position.y = BATTERY_BASE_H + SEG_H / 2 + i * (SEG_H + SEG_GAP) + SEG_GAP / 2;
    seg.castShadow = true;
    battery.add(seg);
  }
  group.add(battery);
  const batteryPoint = new THREE.Vector3(bx, by + BATTERY_TOP * BATTERY_SCALE * 0.7, bz);

  // --- Rayos del Sol sobre los paneles (aditivos, muy sutiles) ---
  const rayGeo = own(new THREE.CylinderGeometry(0.26, 0.26, 1, 10, 1, true));
  {
    // Degradado: color pleno junto al panel (y < 0) y negro lejos (aditivo = transparente).
    const pos = rayGeo.attributes.position!;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = pos.getY(i) < 0 ? 1 : 0;
      col.set([1 * k, 0.96 * k, 0.88 * k], i * 3);
    }
    rayGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const rayMat = own(
    new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }),
  );
  const rays = panelCenters.map(() => {
    const ray = new THREE.Mesh(rayGeo, rayMat);
    ray.visible = false;
    ray.renderOrder = 4;
    ray.frustumCulled = false;
    group.add(ray);
    return ray;
  });

  // --- Partículas de energía (un solo Points, buffers reutilizados) ---
  const pPos = new Float32Array(MAX_PARTICLES * 3);
  const pCol = new Float32Array(MAX_PARTICLES * 3);
  const pGeo = own(new THREE.BufferGeometry());
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const sprite = own(glowTexture());
  const pMat = own(
    new THREE.PointsMaterial({
      size: 2.2, map: sprite, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }),
  );
  const points = new THREE.Points(pGeo, pMat);
  points.visible = false;
  points.frustumCulled = false;
  points.renderOrder = 5;
  group.add(points);

  // --- Nube de polvo (un solo Points con color RGBA por partícula; oculta en reposo) ---
  const cPos = new Float32Array(MAX_CLOUD * 3);
  const cCol = new Float32Array(MAX_CLOUD * 4);
  const cVel = new Float32Array(MAX_CLOUD * 3);
  const cDelay = new Float32Array(MAX_CLOUD);
  const cLife = new Float32Array(MAX_CLOUD);
  const cGeo = own(new THREE.BufferGeometry());
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  cGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 4));
  const cMat = own(
    new THREE.PointsMaterial({ size: 3.4, map: sprite, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }),
  );
  const cloud = new THREE.Points(cGeo, cMat);
  cloud.visible = false;
  cloud.frustumCulled = false;
  cloud.renderOrder = 6;
  group.add(cloud);
  let cloudCount = 0;
  let cloudT = -1; // < 0: sin nube

  // Estado por partícula: A (origen), C (control del arco), B (destino), progreso, velocidad, espera.
  const path = new Float32Array(MAX_PARTICLES * 9);
  const prog = new Float32Array(MAX_PARTICLES);
  const speed = new Float32Array(MAX_PARTICLES);
  const wait = new Float32Array(MAX_PARTICLES);
  /** Destino: -1 = panel -> batería; 0..3 = batería -> módulo. */
  const kind = new Int8Array(MAX_PARTICLES).fill(-2);
  const moduleTop = MODULES.map((m) => new THREE.Vector3(m.x, heightAt(m.x, m.z) + MODULE_TOP[m.id] * 0.55, m.z));
  const moduleIndex = new Map<ModuleId, number>(MODULES.map((m, i) => [m.id, i]));
  const weights = new Float32Array(MODULES.length);

  const spawn = (i: number): void => {
    const k = kind[i]!;
    let ax: number, ay: number, az: number, tx: number, ty: number, tz: number;
    if (k < 0) {
      const p = panelCenters[Math.floor(rng() * panelCenters.length)]!;
      ax = p.x + (rng() - 0.5) * 2.4;
      ay = p.y + 0.2;
      az = p.z + (rng() - 0.5) * 1.6;
      tx = batteryPoint.x;
      ty = batteryPoint.y + 0.4;
      tz = batteryPoint.z;
    } else {
      ax = batteryPoint.x;
      ay = batteryPoint.y + 0.5;
      az = batteryPoint.z;
      const m = moduleTop[k]!;
      tx = m.x + (rng() - 0.5) * 2;
      ty = m.y;
      tz = m.z + (rng() - 0.5) * 2;
    }
    const dist = Math.hypot(tx - ax, tz - az);
    const o = i * 9;
    path[o] = ax; path[o + 1] = ay; path[o + 2] = az;
    path[o + 3] = (ax + tx) / 2 + (rng() - 0.5) * 1.5;
    path[o + 4] = Math.max(ay, ty) + 2.2 + dist * 0.22 + rng() * 1.2;
    path[o + 5] = (az + tz) / 2 + (rng() - 0.5) * 1.5;
    path[o + 6] = tx; path[o + 7] = ty; path[o + 8] = tz;
    prog[i] = 0;
    speed[i] = 1 / (TRIP_MIN + rng() * TRIP_SPAN);
  };

  // --- Estado ---
  let tier: EnergyTier = 'high';
  let light = 1;
  let azimuth = 0;
  let appliedAzimuth = NaN;
  let appliedElevation = NaN;
  let batteryTarget = 0.5;
  let batteryShown = 0.5;
  let playing = false;
  let playTime = 0;
  let nightPlay = false;
  let rayAmount = 0;
  let glowShown = 0;
  let dusty = false;
  let dustTarget = 0;
  let dustShown = 0;
  let dustFirst = true;
  let puffPending = false;
  let active = 0; // partículas en uso
  let flying = 0; // partículas todavía en vuelo
  const sunDir = new THREE.Vector3(0, 1, 0);
  const UP = new THREE.Vector3(0, 1, 0);
  const alertColor = new THREE.Color(ALERT);
  const amberColor = new THREE.Color(AMBER);
  const dustColor = new THREE.Color(DUST_EMISSIVE);
  let dustApply = false;

  /** Nube al limpiar: sale de los paneles, se expande hacia los lados y cae despacio. */
  const startCloud = (): void => {
    cloudCount = Math.min(MAX_CLOUD, CLOUD[tier]);
    cloudT = 0;
    for (let i = 0; i < cloudCount; i++) {
      const p = panelCenters[i % panelCenters.length]!;
      cPos[i * 3] = p.x + (rng() - 0.5) * 2.6;
      cPos[i * 3 + 1] = p.y + 0.1;
      cPos[i * 3 + 2] = p.z + (rng() - 0.5) * 1.8;
      const dir = rng() * Math.PI * 2;
      const sp = 0.7 + rng() * 1.7;
      cVel[i * 3] = Math.cos(dir) * sp;
      cVel[i * 3 + 1] = 0.9 + rng() * 1.5;
      cVel[i * 3 + 2] = Math.sin(dir) * sp;
      cDelay[i] = rng() * 0.35;
      cLife[i] = 1.6 + rng() * 0.8;
      cCol.set([0.6, 0.58, 0.53, 0], i * 4);
    }
    cGeo.setDrawRange(0, cloudCount);
    cloud.visible = true;
  };
  const updateCloud = (dt: number): void => {
    cloudT += dt;
    const drag = Math.exp(-CLOUD_DRAG * dt);
    for (let i = 0; i < cloudCount; i++) {
      const t = cloudT - cDelay[i]!;
      if (t < 0) {
        cCol[i * 4 + 3] = 0;
        continue;
      }
      const o = i * 3;
      cVel[o] = cVel[o]! * drag;
      cVel[o + 2] = cVel[o + 2]! * drag;
      cVel[o + 1] = cVel[o + 1]! * drag - CLOUD_GRAVITY * dt;
      cPos[o] = cPos[o]! + cVel[o]! * dt;
      cPos[o + 1] = cPos[o + 1]! + cVel[o + 1]! * dt;
      cPos[o + 2] = cPos[o + 2]! + cVel[o + 2]! * dt;
      // Se posa sobre los paneles: nunca baja de su altura.
      const floor = panelCenters[i % panelCenters.length]!.y - 0.3;
      if (cPos[o + 1]! < floor) {
        cPos[o + 1] = floor;
        cVel[o + 1] = 0;
      }
      const k = Math.min(1, t / cLife[i]!);
      cCol[i * 4 + 3] = Math.min(1, t / 0.15) * (1 - k) * (1 - k) * 0.55;
    }
    cGeo.attributes.position!.needsUpdate = true;
    cGeo.attributes.color!.needsUpdate = true;
    if (cloudT > CLOUD_SECONDS) {
      cloudT = -1;
      cloud.visible = false;
    }
  };

  const placeSun = (): void => {
    // Misma fórmula que el Sol de world.ts: elevación 0,09 + luz * 0,14.
    const elevation = 0.09 + light * 0.14;
    if (Math.abs(azimuth - appliedAzimuth) < 1e-4 && Math.abs(elevation - appliedElevation) < 1e-4) return;
    appliedAzimuth = azimuth;
    appliedElevation = elevation;
    const ce = Math.cos(RAY_ELEVATION);
    sunDir.set(Math.sin(azimuth) * ce, Math.sin(RAY_ELEVATION), Math.cos(azimuth) * ce);
    for (const p of pivots) p.rotation.y = azimuth;
    rays.forEach((ray, i) => {
      const c = panelCenters[i]!;
      ray.quaternion.setFromUnitVectors(UP, sunDir);
      ray.scale.set(1, SUN_RAY_LENGTH, 1);
      ray.position.copy(c).addScaledVector(sunDir, SUN_RAY_LENGTH / 2);
    });
  };
  placeSun();

  const paintBattery = (): void => {
    const level = batteryShown * BATTERY_SEGMENTS;
    const low = batteryShown < 0.2;
    for (let i = 0; i < BATTERY_SEGMENTS; i++) {
      const m = segMats[i]!;
      const on = THREE.MathUtils.clamp(level - i, 0, 1);
      m.emissive.copy(low ? alertColor : amberColor);
      m.emissiveIntensity = 0.04 + on * 1.1;
    }
  };
  paintBattery();

  const stopAll = (): void => {
    playing = false;
    active = 0;
    flying = 0;
    kind.fill(-2);
    points.visible = false;
  };

  return {
    group,
    setSun(l, az) {
      light = THREE.MathUtils.clamp(l, 0, 1);
      azimuth = az;
    },
    setBattery(fraction) {
      batteryTarget = THREE.MathUtils.clamp(fraction, 0, 1);
    },
    setTier(next) {
      if (next === tier) return;
      tier = next;
      if (playing) stopAll();
    },
    setDust(next, puff) {
      if (dustFirst) {
        // El primer estado se aplica de golpe (cargar la partida no levanta ninguna nube).
        dustFirst = false;
        dustShown = next ? 1 : 0;
        dustApply = true;
      } else if (puff && dusty && !next) puffPending = true;
      dusty = next;
      dustTarget = next ? 1 : 0;
    },
    play(plan, night) {
      stopAll();
      playing = true;
      nightPlay = night;
      playTime = 0;
      const total = Math.min(MAX_PARTICLES, PARTICLES[tier]);
      let sum = 0;
      weights.fill(0);
      for (const [id, i] of moduleIndex) {
        const w = Math.max(0, plan[id] ?? 0);
        weights[i] = w;
        sum += w;
      }
      // Con polvo salen menos partículas del Sol; las que van a los módulos no cambian.
      const fullPanel = night ? 0 : sum > 0 ? Math.round(total * PANEL_SHARE) : total;
      const panelCount = night || sum <= 0 ? fullPanel : Math.round(fullPanel * (dusty ? 1 - DUST_PARTICLE_CUT : 1));
      const moduleCount = sum > 0 ? total - fullPanel : 0;
      active = panelCount + moduleCount;
      let n = 0;
      for (let i = 0; i < panelCount; i++, n++) {
        kind[n] = -1;
        spawn(n);
        wait[n] = (i / Math.max(1, panelCount)) * 1.4 + rng() * 0.2;
      }
      // Reparto por módulo en proporción a la energía asignada (método del mayor resto).
      let given = 0;
      let acc = 0;
      for (let m = 0; m < weights.length; m++) {
        acc += weights[m]!;
        const upTo = sum > 0 ? Math.round((acc / sum) * moduleCount) : 0;
        for (; given < upTo; given++, n++) {
          kind[n] = m;
          spawn(n);
          // De día salen un poco después de que la energía llegue a la batería.
          wait[n] = (night ? 0 : 0.45) + (given / Math.max(1, moduleCount)) * 1.1 + rng() * 0.2;
        }
      }
      flying = n;
      active = n;
      for (let i = 0; i < n; i++) pPos[i * 3 + 1] = -100; // fuera de vista hasta que salgan
      pGeo.setDrawRange(0, n);
      points.visible = n > 0;
    },
    update(dt, time, reduced) {
      placeSun();
      const day = light >= NIGHT_LIGHT;
      // Paneles: brillan con el Sol y se apagan de noche.
      glowShown = damp(glowShown, playing && day && !reduced ? 1 : 0, 5, dt);
      // Polvo: velo gris, mate y sin brillo; con la limpieza los paneles vuelven a brillar.
      if (dustShown !== dustTarget || dustApply) {
        dustApply = false;
        dustShown = reduced ? dustTarget : damp(dustShown, dustTarget, 2.2, dt);
        if (Math.abs(dustShown - dustTarget) < 0.003) dustShown = dustTarget;
        veilMat.opacity = DUST_COVER * dustShown;
        const showVeil = dustShown > 0.005;
        for (const v of veils) v.visible = showVeil;
        panelMat.roughness = 0.28 + 0.5 * dustShown;
        panelMat.metalness = 0.55 - 0.35 * dustShown;
        panelMat.emissive.setHex(PANEL_BLUE).lerp(dustColor, dustShown);
      }
      const shine = 1 - 0.8 * dustShown;
      panelMat.emissiveIntensity = ((day ? 0.04 + light * 0.14 : 0) + glowShown * 0.5 * (reduced ? 0 : 0.8 + 0.2 * Math.sin(time * 3))) * shine;
      if (puffPending) {
        puffPending = false;
        if (!reduced) startCloud();
      }
      if (cloudT >= 0) updateCloud(dt);
      // Batería: el indicador persigue a su objetivo.
      if (Math.abs(batteryShown - batteryTarget) > 0.0005) {
        batteryShown = reduced ? batteryTarget : damp(batteryShown, batteryTarget, 4, dt);
        paintBattery();
      }

      // Rayos: solo de día, mientras pasa el día y en calidad media o alta.
      const wantRays = playing && day && !nightPlay && tier !== 'low' && !reduced;
      rayAmount = damp(rayAmount, wantRays ? 1 : 0, 4, dt);
      const raysOn = rayAmount > 0.01;
      rayMat.opacity = 0.07 * rayAmount * light * (1 - DUST_RAY_CUT * dustShown);
      for (const ray of rays) ray.visible = raysOn;

      if (!playing && flying === 0) return;
      if (playing) {
        playTime += dt;
        if (playTime >= PLAY_SECONDS) playing = false;
      }

      // Partículas: curva de Bézier cuadrática; fundido de entrada y salida con un seno.
      let still = 0;
      for (let i = 0; i < active; i++) {
        if (kind[i] === -2) continue;
        if (wait[i]! > 0) {
          wait[i] = wait[i]! - dt;
          still++;
          pCol[i * 3] = pCol[i * 3 + 1] = pCol[i * 3 + 2] = 0;
          continue;
        }
        let t = prog[i]! + speed[i]! * dt;
        if (t >= 1) {
          if (playing) {
            t = 0;
            spawn(i);
          } else {
            kind[i] = -2;
            pCol[i * 3] = pCol[i * 3 + 1] = pCol[i * 3 + 2] = 0;
            pPos[i * 3 + 1] = -100;
            continue;
          }
        }
        prog[i] = t;
        still++;
        const o = i * 9;
        const u = 1 - t;
        const a = u * u;
        const b = 2 * u * t;
        const c = t * t;
        pPos[i * 3] = a * path[o]! + b * path[o + 3]! + c * path[o + 6]!;
        pPos[i * 3 + 1] = a * path[o + 1]! + b * path[o + 4]! + c * path[o + 7]!;
        pPos[i * 3 + 2] = a * path[o + 2]! + b * path[o + 5]! + c * path[o + 8]!;
        const fade = Math.sin(Math.PI * t);
        const glow = fade * (0.55 + 0.45 * Math.sin(time * 9 + i * 1.7));
        // Ámbar (el único cálido); un toque más claro en el centro del trayecto.
        pCol[i * 3] = glow;
        pCol[i * 3 + 1] = glow * (0.66 + 0.2 * fade);
        pCol[i * 3 + 2] = glow * (0.28 + 0.3 * fade);
      }
      flying = still;
      pGeo.attributes.position!.needsUpdate = true;
      pGeo.attributes.color!.needsUpdate = true;
      if (!playing && flying === 0) stopAll();
    },
    dispose() {
      for (const d of disposables) d.dispose();
      posts.dispose();
      group.removeFromParent();
    },
  };
}
