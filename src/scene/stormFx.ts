// Tormenta solar que representa lo que pasa: brillo violeta hacia el Sol, lluvia de rayas que cae en
// diagonal sobre la base, domo del refugio que las frena (con pequeños destellos de impacto) y, si la
// tripulación siguió trabajando, un "+X mSv" sobre cada astronauta. Dos intensidades: suave mientras
// el aviso está pendiente y plena (~2,5 s) al resolver el día de la tormenta.
// Solo REFLEJA estado (world.ts lo llama). En reposo todo está oculto (coste de dibujo cero).
// Sin asignaciones por fotograma: buffers fijos, vectores temporales y pools reciclados.
// Movimiento reducido: sin rayas ni destellos; brillo y domo fijos; el "+X mSv" fijo 1,5 s.

import * as THREE from 'three';
import type { StormLevel } from '../sim/types';
import { MODULES } from './base';

export type StormTier = 'high' | 'medium' | 'low';

export interface StormFxOptions {
  /** La tripulación se refugia: aparece el domo y las rayas se detienen en él. */
  sheltered: boolean;
  /** El aviso está pendiente (aún no se ha decidido): solo brillo y pocas rayas. */
  pending: boolean;
}

export interface StormFx {
  group: THREE.Group;
  /** Nivel de la tormenta de hoy (o null: sin tormenta). Se puede llamar cada vez que cambie el estado. */
  setStorm(level: StormLevel | null, options?: Partial<StormFxOptions>): void;
  /** Tormenta a pleno: ~2,5 s con la intensidad del nivel (usa el nivel y el refugio vigentes). */
  burst(): void;
  /** "+X mSv" flotando sobre cada astronauta visible. Texto ya formateado. */
  showDose(text: string): void;
  /** De dónde salen los astronautas: escribe en `out` la posición de la cabeza de `index`; false si no se ve. */
  setCrewSource(source: (index: number, out: THREE.Vector3) => boolean, count: number): void;
  /** Dirección del Sol (misma que el DirectionalLight de world.ts). */
  setSun(azimuth: number, elevation: number): void;
  setTier(tier: StormTier): void;
  /** 0..1: cuánto conviene bajar las luces de la base (domo activo). */
  readonly dim: number;
  update(dt: number, time: number, reduced: boolean): void;
  dispose(): void;
}

// Colores: tormenta = violeta (docs/ARTE.md §3).
const STORM = 0xb48cff;
const DOME = 0x8f9bff;

const LEVELS: StormLevel[] = ['S1', 'S2', 'S3', 'S4'];
/** Rayas por nivel en calidad alta; media = mitad, baja = un cuarto. */
const RAYS: Record<StormLevel, number> = { S1: 120, S2: 220, S3: 340, S4: 480 };
const TIER_SHARE: Record<StormTier, number> = { high: 1, medium: 0.5, low: 0.25 };
const MAX_RAYS = RAYS.S4;
/** Velocidad de caída (m/s) por nivel. */
const SPEED: Record<StormLevel, number> = { S1: 60, S2: 75, S3: 95, S4: 120 };
/** Brillo del cielo por nivel. */
const GLOW: Record<StormLevel, number> = { S1: 0.4, S2: 0.55, S3: 0.7, S4: 0.85 };

const BURST_SECONDS = 2.5;
const BURST_RISE = 0.35;
const BURST_FALL = 0.7;
/** Con el aviso pendiente: cuánto de la lluvia plena se ve. */
const PENDING_RAIN = 0.25;
/** Las rayas son un recurso visual: más empinadas que el Sol real para que se lean desde la cámara alta. */
const FALL_ELEVATION = 0.75;
const FALL_HEIGHT = 70; // m de trayecto
const AREA_RADIUS = 34;
const RAY_LENGTH_MIN = 3.5;
const RAY_LENGTH_SPAN = 4;
/** Con refugio, esta parte de las rayas apunta a la huella del domo (si no, casi ninguna lo tocaría). */
const DOME_BIAS = 0.45;
const DOME_RADIUS = 10.5;
const IMPACTS = 12;
const IMPACT_LIFE = 0.35;
const IMPACT_GAP = 1 / 30; // como mucho 30 impactos por segundo en total
const DOSE_SECONDS = 2.6;
const DOSE_SECONDS_REDUCED = 1.5;
const DOSE_FADE = 0.5;
const SKY_DISTANCE = 280;
const HAZE_DISTANCE = 48;

const damp = (current: number, target: number, k: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-k * dt));

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

function glowTexture(size: number, stops: [number, number][]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, alpha] of stops) g.addColorStop(at, `rgba(255,255,255,${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawDose(canvas: HTMLCanvasElement, text: string): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(11,12,14,0.88)';
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, 22);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#b48cff';
  ctx.stroke();
  let size = 56;
  const font = (px: number): string => `800 ${px}px 'Barlow Condensed', system-ui, sans-serif`;
  ctx.font = font(size);
  const maxW = w * 0.82;
  const measured = ctx.measureText(text).width;
  if (measured > maxW) {
    size = Math.floor((size * maxW) / measured);
    ctx.font = font(size);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f3ecff';
  ctx.fillText(text, w / 2, h / 2 + 2);
}

const DOME_VERTEX = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying float vY;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vY = position.y;
    gl_Position = projectionMatrix * mv;
  }
`;
const DOME_FRAGMENT = /* glsl */ `
  uniform float uAmount;
  uniform float uTime;
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vV;
  varying float vY;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
    float ripple = 0.88 + 0.12 * sin(vY * 0.9 - uTime * 1.4);
    float a = (0.06 + 0.4 * f) * ripple * uAmount;
    gl_FragColor = vec4(uColor, a);
  }
`;

export function createStormFx(heightAt: (x: number, z: number) => number = () => 0): StormFx {
  const group = new THREE.Group();
  group.visible = false;
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(d: T): T => (disposables.push(d), d);
  const rng = makeRng(0x57031);

  // El refugio es el módulo de Blindaje (a donde corre la tripulación).
  const shield = MODULES.find((m) => m.id === 'shield')!;
  const dome = new THREE.Vector3(shield.x, heightAt(shield.x, shield.z), shield.z);

  // --- Cielo: resplandor hacia el Sol y neblina sobre el horizonte de ese lado ---
  const skyTex = own(glowTexture(128, [[0, 0.9], [0.4, 0.4], [1, 0]]));
  const skyMat = own(
    new THREE.SpriteMaterial({ map: skyTex, color: STORM, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  const skyGlow = new THREE.Sprite(skyMat);
  skyGlow.scale.setScalar(420);
  skyGlow.renderOrder = 1;
  skyGlow.visible = false;
  group.add(skyGlow);
  const hazeMat = own(
    new THREE.SpriteMaterial({ map: skyTex, color: STORM, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  const haze = new THREE.Sprite(hazeMat);
  haze.scale.setScalar(90);
  haze.renderOrder = 2;
  haze.visible = false;
  group.add(haze);

  // --- Lluvia de rayas (un solo LineSegments, buffers reutilizados) ---
  const pos = new Float32Array(MAX_RAYS * 6);
  const col = new Float32Array(MAX_RAYS * 6);
  const rayGeo = own(new THREE.BufferGeometry());
  rayGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rayGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  rayGeo.setDrawRange(0, 0);
  const rayMat = own(
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }),
  );
  const rays = new THREE.LineSegments(rayGeo, rayMat);
  rays.frustumCulled = false;
  rays.renderOrder = 8;
  rays.visible = false;
  group.add(rays);
  // Cabeza brillante (blanco violáceo) y cola negra: en aditivo la cola se desvanece sola.
  for (let i = 0; i < MAX_RAYS; i++) {
    const b = 0.55 + rng() * 0.45;
    col[i * 6] = 0.78 * b;
    col[i * 6 + 1] = 0.64 * b;
    col[i * 6 + 2] = 1 * b;
  }

  // Punto de impacto en el suelo de cada raya.
  const ox = new Float32Array(MAX_RAYS);
  const oy = new Float32Array(MAX_RAYS);
  const oz = new Float32Array(MAX_RAYS);
  const progress = new Float32Array(MAX_RAYS);
  const speedJitter = new Float32Array(MAX_RAYS);
  const lengths = new Float32Array(MAX_RAYS);
  /** Distancia (a lo largo de la caída) a la que la raya toca el domo (Infinity: no lo toca). */
  const hitAt = new Float32Array(MAX_RAYS);
  const flashed = new Uint8Array(MAX_RAYS);
  const fall = new THREE.Vector3(0, -1, 0); // dirección en que caen

  // --- Impactos sobre el domo (pool reciclado) ---
  const impactMat: THREE.SpriteMaterial[] = [];
  const impactSprite: THREE.Sprite[] = [];
  const impactLife = new Float32Array(IMPACTS);
  const impactTex = own(glowTexture(32, [[0, 1], [0.4, 0.5], [1, 0]]));
  for (let i = 0; i < IMPACTS; i++) {
    const m = own(new THREE.SpriteMaterial({ map: impactTex, color: 0xdfd0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const s = new THREE.Sprite(m);
    s.visible = false;
    s.renderOrder = 11;
    group.add(s);
    impactMat.push(m);
    impactSprite.push(s);
  }
  let impactNext = 0;
  let impactCooldown = 0;

  // --- Domo del refugio: media esfera con borde fresnel y un anillo en el suelo ---
  const domeGroup = new THREE.Group();
  domeGroup.position.copy(dome);
  domeGroup.visible = false;
  const domeGeo = own(new THREE.SphereGeometry(DOME_RADIUS, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2));
  const domeMat = own(
    new THREE.ShaderMaterial({
      uniforms: { uAmount: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(DOME) } },
      vertexShader: DOME_VERTEX,
      fragmentShader: DOME_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  const domeMesh = new THREE.Mesh(domeGeo, domeMat);
  domeMesh.renderOrder = 7;
  domeMesh.frustumCulled = false;
  const ringGeo = own(new THREE.TorusGeometry(DOME_RADIUS, 0.16, 8, 72));
  const ringMat = own(new THREE.MeshBasicMaterial({ color: DOME, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  ring.renderOrder = 7;
  domeGroup.add(domeMesh, ring);
  group.add(domeGroup);

  // --- "+X mSv" sobre los astronautas ---
  const doseCanvas = Object.assign(document.createElement('canvas'), { width: 256, height: 96 });
  const doseTex = own(new THREE.CanvasTexture(doseCanvas));
  doseTex.colorSpace = THREE.SRGBColorSpace;
  const doseMat = own(new THREE.SpriteMaterial({ map: doseTex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }));
  const MAX_DOSE = 6;
  const doseSprites: THREE.Sprite[] = [];
  for (let i = 0; i < MAX_DOSE; i++) {
    const s = new THREE.Sprite(doseMat);
    s.scale.set(4.8, 1.8, 1);
    s.visible = false;
    s.renderOrder = 15;
    group.add(s);
    doseSprites.push(s);
  }
  let doseText = '';
  let doseClock = Infinity;
  let doseDuration = DOSE_SECONDS;
  let crewSource: ((index: number, out: THREE.Vector3) => boolean) | null = null;
  let crewCount = 0;
  void document.fonts?.ready.then(() => doseText && drawDose(doseCanvas, doseText)).catch(() => undefined);

  // --- Estado ---
  let tier: StormTier = 'high';
  let level: StormLevel | null = null;
  let sheltered = false;
  let pending = false;
  let burstLevel: StormLevel = 'S1';
  let burstSheltered = false;
  let burstLeft = 0;
  let glowAmount = 0;
  let rainAmount = 0;
  let domeAmount = 0;
  let sunAzimuth = 0;
  let sunElevation = 0.15;
  let appliedAzimuth = NaN;
  let appliedElevation = NaN;
  let domeActive = false; // el domo con el que se calcularon los impactos de cada raya
  let active = 0;
  let lastReduced = false;
  const tmp = new THREE.Vector3();
  let dimValue = 0;

  const placeSun = (): void => {
    if (Math.abs(sunAzimuth - appliedAzimuth) < 1e-4 && Math.abs(sunElevation - appliedElevation) < 1e-4) return;
    appliedAzimuth = sunAzimuth;
    appliedElevation = sunElevation;
    const ce = Math.cos(sunElevation);
    skyGlow.position.set(Math.sin(sunAzimuth) * ce * SKY_DISTANCE, Math.sin(sunElevation) * SKY_DISTANCE, Math.cos(sunAzimuth) * ce * SKY_DISTANCE);
    haze.position.set(Math.sin(sunAzimuth) * HAZE_DISTANCE, 5, Math.cos(sunAzimuth) * HAZE_DISTANCE);
    const cf = Math.cos(FALL_ELEVATION);
    fall.set(-Math.sin(sunAzimuth) * cf, -Math.sin(FALL_ELEVATION), -Math.cos(sunAzimuth) * cf);
  };

  const spawn = (i: number, scatter: boolean, withDome: boolean): void => {
    let gx: number;
    let gz: number;
    if (withDome && rng() < DOME_BIAS) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * DOME_RADIUS * 1.02;
      gx = dome.x + Math.cos(a) * r;
      gz = dome.z + Math.sin(a) * r;
    } else {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * AREA_RADIUS;
      gx = Math.cos(a) * r;
      gz = Math.sin(a) * r;
    }
    const gy = heightAt(gx, gz);
    // Punto de impacto en el suelo: la raya se coloca siempre a (s - FALL_HEIGHT) de él, a lo largo de la caída vigente.
    ox[i] = gx;
    oy[i] = gy;
    oz[i] = gz;
    lengths[i] = RAY_LENGTH_MIN + rng() * RAY_LENGTH_SPAN;
    speedJitter[i] = 0.8 + rng() * 0.4;
    progress[i] = scatter ? rng() * (FALL_HEIGHT + lengths[i]!) : -rng() * 8;
    flashed[i] = 0;
    hitAt[i] = Infinity;
    if (withDome) {
      // Recta O + d*s contra la esfera del domo; solo cuenta la mitad de arriba.
      const px = gx - fall.x * FALL_HEIGHT - dome.x;
      const py = gy - fall.y * FALL_HEIGHT - dome.y;
      const pz = gz - fall.z * FALL_HEIGHT - dome.z;
      const b = px * fall.x + py * fall.y + pz * fall.z;
      const c = px * px + py * py + pz * pz - DOME_RADIUS * DOME_RADIUS;
      const disc = b * b - c;
      if (disc > 0) {
        const s1 = -b - Math.sqrt(disc);
        if (s1 > 0 && gy + fall.y * (s1 - FALL_HEIGHT) >= dome.y) hitAt[i] = s1;
      }
    }
  };

  const respawnAll = (withDome: boolean): void => {
    domeActive = withDome;
    for (let i = 0; i < MAX_RAYS; i++) spawn(i, true, withDome);
  };

  const flash = (i: number): void => {
    if (impactCooldown > 0) return;
    impactCooldown = IMPACT_GAP;
    const k = impactNext;
    impactNext = (impactNext + 1) % IMPACTS;
    const s = hitAt[i]!;
    impactSprite[k]!.position.set(ox[i]! + fall.x * (s - FALL_HEIGHT), oy[i]! + fall.y * (s - FALL_HEIGHT), oz[i]! + fall.z * (s - FALL_HEIGHT));
    impactLife[k] = IMPACT_LIFE;
    impactSprite[k]!.visible = true;
  };

  const hideRain = (): void => {
    rays.visible = false;
    rayGeo.setDrawRange(0, 0);
    active = 0;
  };

  placeSun();
  respawnAll(false);

  return {
    group,
    get dim() {
      return dimValue;
    },
    setStorm(next, options = {}) {
      level = next;
      pending = options.pending ?? false;
      sheltered = (options.sheltered ?? false) && next !== null;
      // Si el estallido ya está en marcha y llega el estado definitivo, lo sigue (el refugio no cambia a mitad).
      if (burstLeft > 0 && next !== null) {
        burstLevel = next;
        burstSheltered = sheltered;
      }
    },
    burst() {
      burstLevel = level ?? burstLevel;
      burstSheltered = sheltered;
      burstLeft = BURST_SECONDS;
    },
    showDose(text) {
      if (text !== doseText) {
        doseText = text;
        drawDose(doseCanvas, text);
        doseTex.needsUpdate = true;
      }
      doseClock = 0;
      doseDuration = lastReduced ? DOSE_SECONDS_REDUCED : DOSE_SECONDS;
    },
    setCrewSource(source, count) {
      crewSource = source;
      crewCount = Math.min(MAX_DOSE, count);
    },
    setSun(azimuth, elevation) {
      sunAzimuth = azimuth;
      sunElevation = elevation;
    },
    setTier(next) {
      tier = next;
    },
    update(dt, time, reduced) {
      lastReduced = reduced;
      placeSun();
      const bursting = burstLeft > 0;
      if (bursting) burstLeft = Math.max(0, burstLeft - dt);
      const curLevel: StormLevel | null = bursting ? burstLevel : level;
      const curSheltered = bursting ? burstSheltered : sheltered;

      // Objetivos: brillo (aviso o día), lluvia (solo suave en el aviso, plena en el estallido) y domo.
      let glowTarget = 0;
      if (curLevel) glowTarget = GLOW[curLevel] * (pending && !bursting ? 0.6 : 1);
      if (bursting && level === null) glowTarget = GLOW[burstLevel];
      let rainTarget = 0;
      if (bursting && !reduced) {
        const elapsed = BURST_SECONDS - burstLeft;
        rainTarget = Math.min(1, elapsed / BURST_RISE, burstLeft / BURST_FALL);
      } else if (pending && level && !reduced) rainTarget = PENDING_RAIN;
      const domeTarget = curLevel && curSheltered && !pending ? 1 : 0;

      glowAmount = reduced ? glowTarget : damp(glowAmount, glowTarget, 2.5, dt);
      rainAmount = reduced ? 0 : damp(rainAmount, rainTarget, 6, dt);
      domeAmount = reduced ? domeTarget : damp(domeAmount, domeTarget, 3, dt);
      dimValue = domeAmount;

      // Cielo.
      const glowOn = glowAmount > 0.005;
      skyGlow.visible = haze.visible = glowOn;
      if (glowOn) {
        const pulse = reduced ? 1 : 0.92 + 0.08 * Math.sin(time * 2.2);
        skyMat.opacity = Math.min(1, glowAmount * 0.75 * pulse);
        hazeMat.opacity = Math.min(1, glowAmount * 0.5 * pulse);
      }

      // Domo.
      const domeOn = domeAmount > 0.005;
      domeGroup.visible = domeOn;
      if (domeOn) {
        domeMat.uniforms.uAmount!.value = domeAmount;
        domeMat.uniforms.uTime!.value = reduced ? 0 : time;
        ringMat.opacity = 0.55 * domeAmount;
      }

      // Lluvia.
      const rainLevel: StormLevel = curLevel ?? burstLevel;
      const rainOn = rainAmount > 0.01;
      if (rainOn) {
        const wantDome = curSheltered;
        if (wantDome !== domeActive) respawnAll(wantDome);
        const want = Math.max(1, Math.round(RAYS[rainLevel] * TIER_SHARE[tier] * rainAmount));
        active = Math.min(MAX_RAYS, want);
        rays.visible = true;
        rayMat.opacity = 0.9 * Math.min(1, rainAmount * 2);
        rayGeo.setDrawRange(0, active * 2);
        const speed = SPEED[rainLevel];
        impactCooldown = Math.max(0, impactCooldown - dt);
        for (let i = 0; i < active; i++) {
          let s = progress[i]! + speed * speedJitter[i]! * dt;
          const stop = Math.min(hitAt[i]!, FALL_HEIGHT);
          const len = lengths[i]!;
          if (s >= stop && hitAt[i]! <= FALL_HEIGHT && flashed[i] === 0) {
            flashed[i] = 1;
            if (domeOn) flash(i);
          }
          if (s - len >= stop) {
            spawn(i, false, domeActive);
            s = progress[i]!;
          } else progress[i] = s;
          const head = Math.min(s, stop);
          const tail = Math.min(s - len, stop);
          const o = i * 6;
          const dt0 = tail - FALL_HEIGHT;
          const dh0 = head - FALL_HEIGHT;
          pos[o] = ox[i]! + fall.x * dt0;
          pos[o + 1] = oy[i]! + fall.y * dt0;
          pos[o + 2] = oz[i]! + fall.z * dt0;
          pos[o + 3] = ox[i]! + fall.x * dh0;
          pos[o + 4] = oy[i]! + fall.y * dh0;
          pos[o + 5] = oz[i]! + fall.z * dh0;
        }
        rayGeo.attributes.position!.needsUpdate = true;
      } else if (rays.visible) hideRain();

      // Impactos: ascienden un poco y se apagan.
      let impactsOn = false;
      for (let k = 0; k < IMPACTS; k++) {
        const life = impactLife[k]!;
        if (life <= 0) continue;
        const left = life - dt;
        impactLife[k] = left;
        const s = impactSprite[k]!;
        if (left <= 0 || reduced) {
          impactLife[k] = 0;
          s.visible = false;
          continue;
        }
        impactsOn = true;
        const u = 1 - left / IMPACT_LIFE;
        s.scale.setScalar(1.3 + u * 2.2);
        impactMat[k]!.opacity = 0.7 * (1 - u);
      }

      // "+X mSv": sigue a cada astronauta visible; sube y se desvanece (fijo con movimiento reducido).
      let doseOn = false;
      if (doseClock < doseDuration) {
        doseClock += dt;
        const left = doseDuration - doseClock;
        if (left > 0 && crewSource) {
          doseOn = true;
          const rise = reduced ? 0 : 0.9 * (1 - Math.exp(-3 * doseClock));
          doseMat.opacity = reduced ? 1 : Math.min(1, left / DOSE_FADE, doseClock / 0.15);
          for (let i = 0; i < MAX_DOSE; i++) {
            const sp = doseSprites[i]!;
            const visible = i < crewCount && crewSource(i, tmp);
            sp.visible = visible;
            if (visible) sp.position.set(tmp.x, tmp.y + 1.3 + rise + (i % 2) * 1.5, tmp.z);
          }
        }
        if (!doseOn) for (const sp of doseSprites) sp.visible = false;
      } else if (doseSprites[0]!.visible) for (const sp of doseSprites) sp.visible = false;

      group.visible = glowOn || domeOn || rays.visible || impactsOn || doseOn;
    },
    dispose() {
      for (const d of disposables) d.dispose();
      group.removeFromParent();
    },
  };
}
