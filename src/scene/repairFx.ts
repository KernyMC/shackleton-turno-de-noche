// Reparación estilo cómic sobre el módulo averiado: "¡CLANK!", "¡CLANK!", "¡SHUUANK!" que saltan
// y suben, chispas con gravedad lunar y, al terminar, un destello verde suave y un "✓" dibujado
// en canvas. Solo REFLEJA: world.ts llama a play(id) cuando el día arranca con una reparación.
// Con movimiento reducido: solo el "✓" fijo durante 1 s. Oculto (coste cero) cuando no suena.

import * as THREE from 'three';
import type { ModuleId } from '../sim/types';
import { MODULES } from './base';
import { MODULE_TOP } from './modules';

export interface RepairFx {
  group: THREE.Group;
  /** Textos de las onomatopeyas (por idioma). Lo que falte conserva su valor anterior o el de respaldo. */
  setLabels(labels: { clank?: string; shuank?: string }): void;
  /** Lanza la secuencia sobre un módulo. */
  play(id: ModuleId, reduced?: boolean): void;
  update(dt: number, time: number, reduced: boolean): void;
  dispose(): void;
}

const AMBER = '#ffb347';
const INK = '#0b0c0e';
const OK = 0x7ccf8a;
const FONT = "'Barlow Condensed', system-ui, sans-serif";

/** Línea de tiempo (segundos desde play). */
const BEAT = 0.5; // separación entre onomatopeyas
const WORD_SECONDS = 0.6;
const CHECK_START = 1.7;
const CHECK_SECONDS = 1.2;
const FLASH_SECONDS = 0.9;
const REDUCED_CHECK_SECONDS = 1;
const SPARKS = 36;
const SPARKS_PER_BEAT = 12;
const GRAVITY = 1.62;

const WORDS: ('clank' | 'clank2' | 'shuank')[] = ['clank', 'clank2', 'shuank'];
/** Desplazamientos (m) y giro (rad) de cada palabra: así no se tapan entre sí. */
const WORD_OFFSET = [
  { x: -1.8, z: 0.6, tilt: 0.16 },
  { x: 1.8, z: -0.6, tilt: -0.14 },
  { x: 0, z: 0, tilt: 0.08 },
];

const easeOutBack = (x: number): number => {
  const c1 = 2.2;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** Palabra de cómic: estallido ámbar detrás, texto blanco grueso con contorno oscuro. */
function drawWord(canvas: HTMLCanvasElement, text: string): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  // Estallido de puntas.
  const spikes = 13;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 1 : 0.76;
    ctx.lineTo(w / 2 + Math.cos(a) * r * (w / 2 - 6), h / 2 + Math.sin(a) * r * (h / 2 - 6));
  }
  ctx.closePath();
  ctx.fillStyle = AMBER;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
  // Texto: se ajusta al ancho disponible.
  let size = 120;
  ctx.font = `800 ${size}px ${FONT}`;
  const maxW = w * 0.7;
  const measured = ctx.measureText(text).width;
  if (measured > maxW) {
    size = Math.floor((size * maxW) / measured);
    ctx.font = `800 ${size}px ${FONT}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(10, size * 0.16);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, w / 2, h / 2 + 4);
  ctx.fillStyle = '#fffaf0';
  ctx.fillText(text, w / 2, h / 2 + 4);
}

function drawCheck(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!;
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(11,12,14,0.88)';
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#7ccf8a';
  ctx.stroke();
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.28, s * 0.52);
  ctx.lineTo(s * 0.44, s * 0.68);
  ctx.lineTo(s * 0.73, s * 0.34);
  ctx.stroke();
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createRepairFx(heightAt: (x: number, z: number) => number = () => 0): RepairFx {
  const group = new THREE.Group();
  group.visible = false;
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(d: T): T => (disposables.push(d), d);

  const anchors = new Map<ModuleId, THREE.Vector3>(
    MODULES.map((m) => [m.id, new THREE.Vector3(m.x, heightAt(m.x, m.z) + MODULE_TOP[m.id], m.z)]),
  );

  // Textos: dos lienzos distintos (CLANK se repite). Se redibujan al cambiar el idioma.
  const text = { clank: '¡CLANK!', shuank: '¡SHUUANK!' };
  const wordCanvas = {
    clank: Object.assign(document.createElement('canvas'), { width: 512, height: 256 }),
    shuank: Object.assign(document.createElement('canvas'), { width: 512, height: 256 }),
  };
  const wordTex = {
    clank: own(new THREE.CanvasTexture(wordCanvas.clank)),
    shuank: own(new THREE.CanvasTexture(wordCanvas.shuank)),
  };
  wordTex.clank.colorSpace = wordTex.shuank.colorSpace = THREE.SRGBColorSpace;
  const paintWords = (): void => {
    drawWord(wordCanvas.clank, text.clank);
    drawWord(wordCanvas.shuank, text.shuank);
    wordTex.clank.needsUpdate = wordTex.shuank.needsUpdate = true;
  };
  paintWords();
  // La fuente del juego puede cargar después: se repinta cuando esté lista.
  void document.fonts?.ready.then(paintWords).catch(() => undefined);

  const spriteMat = (map: THREE.Texture): THREE.SpriteMaterial =>
    own(new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }));
  const words = WORDS.map((id, i) => {
    const material = spriteMat(id === 'shuank' ? wordTex.shuank : wordTex.clank);
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    sprite.renderOrder = 13;
    sprite.userData.index = i;
    group.add(sprite);
    return { sprite, material };
  });

  const checkCanvas = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
  drawCheck(checkCanvas);
  const checkTex = own(new THREE.CanvasTexture(checkCanvas));
  checkTex.colorSpace = THREE.SRGBColorSpace;
  const checkMat = spriteMat(checkTex);
  const check = new THREE.Sprite(checkMat);
  check.visible = false;
  check.renderOrder = 14;
  group.add(check);

  // Destello verde suave: un resplandor aditivo grande sobre el módulo.
  const glowTex = own(glowTexture());
  const flashMat = own(
    new THREE.SpriteMaterial({ map: glowTex, color: OK, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false }),
  );
  const flash = new THREE.Sprite(flashMat);
  flash.visible = false;
  flash.renderOrder = 12;
  group.add(flash);

  // Chispas: arcos cortos con la gravedad de la Luna.
  const sPos = new Float32Array(SPARKS * 3);
  const sVel = new Float32Array(SPARKS * 3);
  const sLife = new Float32Array(SPARKS);
  const sCol = new Float32Array(SPARKS * 3);
  const sGeo = own(new THREE.BufferGeometry());
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const sMat = own(
    new THREE.PointsMaterial({ size: 1.0, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  const sparks = new THREE.Points(sGeo, sMat);
  sparks.frustumCulled = false;
  sparks.renderOrder = 11;
  group.add(sparks);
  let sparkNext = 0;
  let sparksAlive = 0;

  // Estado de la secuencia.
  let running = false;
  let clock = 0;
  let isReduced = false;
  let beatsFired = 0;
  const origin = new THREE.Vector3();
  // Semilla visual fija: las chispas no usan Math.random por fotograma.
  let seed = 12345;
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const burst = (): void => {
    for (let n = 0; n < SPARKS_PER_BEAT; n++) {
      const i = sparkNext;
      sparkNext = (sparkNext + 1) % SPARKS;
      const a = rnd() * Math.PI * 2;
      const r = 0.4 + rnd() * 1.2;
      sPos[i * 3] = origin.x + Math.cos(a) * r * 0.3;
      sPos[i * 3 + 1] = origin.y - 1.4;
      sPos[i * 3 + 2] = origin.z + Math.sin(a) * r * 0.3;
      sVel[i * 3] = Math.cos(a) * r * 1.6;
      sVel[i * 3 + 1] = 2.4 + rnd() * 2.2;
      sVel[i * 3 + 2] = Math.sin(a) * r * 1.6;
      sLife[i] = 0.7 + rnd() * 0.5;
    }
    sparksAlive = SPARKS;
  };

  const hideAll = (): void => {
    running = false;
    group.visible = false;
    for (const w of words) w.sprite.visible = false;
    check.visible = false;
    flash.visible = false;
    sparksAlive = 0;
    sLife.fill(0);
  };

  return {
    group,
    setLabels(labels) {
      let changed = false;
      if (labels.clank && labels.clank !== text.clank) {
        text.clank = labels.clank;
        changed = true;
      }
      if (labels.shuank && labels.shuank !== text.shuank) {
        text.shuank = labels.shuank;
        changed = true;
      }
      if (changed) paintWords();
    },
    play(id, reduced = false) {
      const a = anchors.get(id);
      if (!a) return;
      origin.copy(a);
      running = true;
      clock = 0;
      beatsFired = 0;
      isReduced = reduced;
      sparksAlive = 0;
      sLife.fill(0);
      for (const w of words) {
        w.sprite.visible = false;
        w.material.opacity = 0;
      }
      group.visible = true;
    },
    update(dt, _time, reduced) {
      if (!running) return;
      clock += dt;
      const lowMotion = isReduced || reduced;

      if (lowMotion) {
        // Solo el "✓" fijo durante 1 s, sin chispas ni palabras.
        check.visible = clock < REDUCED_CHECK_SECONDS;
        check.position.set(origin.x, origin.y + 1.5, origin.z);
        check.scale.setScalar(2.4);
        checkMat.opacity = 1;
        if (!check.visible) hideAll();
        return;
      }

      // Onomatopeyas: escala que salta (easeOutBack), sube y se desvanece.
      for (let i = 0; i < words.length; i++) {
        const w = words[i]!;
        const age = clock - i * BEAT;
        const on = age >= 0 && age < WORD_SECONDS;
        w.sprite.visible = on;
        if (!on) continue;
        if (i >= beatsFired) {
          beatsFired = i + 1;
          burst();
        }
        const u = age / WORD_SECONDS;
        const pop = easeOutBack(Math.min(1, age / 0.18));
        const size = (i === 2 ? 6.4 : 5.2) * Math.max(0.01, pop);
        const o = WORD_OFFSET[i]!;
        w.sprite.scale.set(size, size / 2, 1);
        w.sprite.position.set(origin.x + o.x, origin.y + 1.2 + u * 2.6, origin.z + o.z);
        w.material.rotation = o.tilt;
        w.material.opacity = u < 0.45 ? 1 : 1 - (u - 0.45) / 0.55;
      }

      // Destello verde y "✓" al terminar.
      const ct = clock - CHECK_START;
      const showCheck = ct >= 0 && ct < CHECK_SECONDS;
      check.visible = showCheck;
      if (showCheck) {
        const pop = easeOutBack(Math.min(1, ct / 0.25));
        check.scale.setScalar(2.4 * Math.max(0.01, pop));
        check.position.set(origin.x, origin.y + 1.6 + ct * 0.5, origin.z);
        checkMat.opacity = ct < CHECK_SECONDS - 0.3 ? 1 : (CHECK_SECONDS - ct) / 0.3;
      }
      const ft = clock - CHECK_START;
      const showFlash = ft >= 0 && ft < FLASH_SECONDS;
      flash.visible = showFlash;
      if (showFlash) {
        const k = Math.sin((ft / FLASH_SECONDS) * Math.PI);
        flashMat.opacity = 0.55 * k;
        flash.scale.setScalar(9 + ft * 3);
        flash.position.set(origin.x, origin.y - 1.5, origin.z);
      }

      // Chispas.
      if (sparksAlive > 0) {
        let alive = 0;
        for (let i = 0; i < SPARKS; i++) {
          if (sLife[i]! <= 0) {
            sCol[i * 3] = sCol[i * 3 + 1] = sCol[i * 3 + 2] = 0;
            continue;
          }
          sLife[i] = sLife[i]! - dt;
          sVel[i * 3 + 1] = sVel[i * 3 + 1]! - GRAVITY * dt;
          sPos[i * 3] = sPos[i * 3]! + sVel[i * 3]! * dt;
          sPos[i * 3 + 1] = sPos[i * 3 + 1]! + sVel[i * 3 + 1]! * dt;
          sPos[i * 3 + 2] = sPos[i * 3 + 2]! + sVel[i * 3 + 2]! * dt;
          const f = Math.min(1, Math.max(0, sLife[i]! * 1.6));
          sCol[i * 3] = f;
          sCol[i * 3 + 1] = f * 0.78;
          sCol[i * 3 + 2] = f * 0.35;
          alive++;
        }
        sparksAlive = alive;
        sGeo.attributes.position!.needsUpdate = true;
        sGeo.attributes.color!.needsUpdate = true;
      }

      if (clock > CHECK_START + CHECK_SECONDS && sparksAlive === 0) hideAll();
    },
    dispose() {
      for (const d of disposables) d.dispose();
      group.removeFromParent();
    },
  };
}
