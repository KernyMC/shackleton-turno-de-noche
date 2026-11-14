// Avería que se ve: en cada módulo averiado, una baliza roja giratoria (cúpula emisiva + dos haces
// cónicos aditivos + un halo) y un humo leve que sube despacio. Se apagan con damp al repararse.
// Solo REFLEJA estado (world.ts llama a setBroken). Sin PointLight. En reposo, todo oculto (coste
// de dibujo cero). Con movimiento reducido: baliza fija y encendida, sin humo.
// Sin asignaciones por fotograma: el humo es una función del tiempo (no hay partículas con estado).

import * as THREE from 'three';
import type { ModuleId } from '../sim/types';
import { MODULES } from './base';
import { MODULE_TOP } from './modules';

export type AlarmTier = 'high' | 'medium' | 'low';

export interface AlarmFx {
  group: THREE.Group;
  /** Marca un módulo como averiado o reparado. Avisa (onAlarm) solo al pasar de sano a averiado. */
  setBroken(id: ModuleId, broken: boolean): void;
  /** Calidad: menos humo en media y baja. */
  setTier(tier: AlarmTier): void;
  update(dt: number, time: number, reduced: boolean): void;
  dispose(): void;
}

// Rojo de alerta de docs/ARTE.md §3 (el mismo ALERT de base.ts).
const ALERT = 0xff5a4d;
const SMOKE = 0xa4a6aa;

/** Humo por módulo y calidad. */
const SMOKE_COUNT: Record<AlarmTier, number> = { high: 14, medium: 10, low: 8 };
const MAX_SMOKE = SMOKE_COUNT.high;
const SMOKE_LIFE = 5.2; // s que tarda cada bocanada en subir y desvanecerse
const SMOKE_RISE = 5.5; // m que sube
const SMOKE_PEAK_OPACITY = 0.5;
/** Una vuelta por segundo con dos haces: dos barridos por segundo, muy por debajo de 3 destellos/s. */
const TURN_SPEED = Math.PI * 2;
const BEAM_LENGTH = 10;
const BEAM_RADIUS = 2.4;
const DAMP_K = 3;

const damp = (current: number, target: number, k: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-k * dt));

function softTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

interface BeaconMats {
  dome: THREE.MeshBasicMaterial;
  beam: THREE.MeshBasicMaterial;
  glow: THREE.SpriteMaterial;
}

interface Beacon {
  id: ModuleId;
  group: THREE.Group;
  rotor: THREE.Group;
  glow: THREE.Sprite;
  mats: BeaconMats;
  smoke: THREE.Sprite[];
  smokeMats: THREE.SpriteMaterial[];
  broken: boolean;
  amount: number;
  /** Fase propia para que dos balizas no vayan al compás. */
  phase: number;
}

export function createAlarmFx(
  heightAt: (x: number, z: number) => number = () => 0,
  onAlarm?: (id: ModuleId) => void,
): AlarmFx {
  const group = new THREE.Group();
  group.visible = false;
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(d: T): T => (disposables.push(d), d);

  const tex = own(softTexture());
  const alert = new THREE.Color(ALERT);

  // Recursos compartidos por todas las balizas.
  const domeGeo = own(new THREE.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const baseGeo = own(new THREE.CylinderGeometry(0.85, 1.0, 0.3, 12));
  const baseMat = own(new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.6, metalness: 0.4 }));

  // Haz: cono abierto con el vértice en el origen y la base hacia +X; color pleno en el vértice y
  // negro lejos (aditivo = transparente). El segundo haz es el primero girado media vuelta.
  const beamGeo = own(new THREE.ConeGeometry(BEAM_RADIUS, BEAM_LENGTH, 16, 1, true));
  beamGeo.translate(0, -BEAM_LENGTH / 2, 0);
  beamGeo.rotateZ(Math.PI / 2);
  {
    const pos = beamGeo.attributes.position!;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = 1 - THREE.MathUtils.clamp(pos.getX(i) / BEAM_LENGTH, 0, 1);
      const f = k * k;
      col.set([alert.r * f, alert.g * f, alert.b * f], i * 3);
    }
    beamGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const makeMats = (): BeaconMats => ({
    dome: own(new THREE.MeshBasicMaterial({ color: ALERT, transparent: true, opacity: 0, toneMapped: false })),
    beam: own(
      new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      }),
    ),
    glow: own(
      new THREE.SpriteMaterial({ map: tex, color: ALERT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    ),
  });

  const beacons: Beacon[] = MODULES.map((m, mi) => {
    const mats = makeMats();
    const g = new THREE.Group();
    g.position.set(m.x, heightAt(m.x, m.z) + MODULE_TOP[m.id] + 0.1, m.z);
    g.visible = false;
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.15;
    const dome = new THREE.Mesh(domeGeo, mats.dome);
    dome.position.y = 0.3;
    const rotor = new THREE.Group();
    rotor.position.y = 0.9;
    const a = new THREE.Mesh(beamGeo, mats.beam);
    const b = new THREE.Mesh(beamGeo, mats.beam);
    b.rotation.y = Math.PI;
    a.frustumCulled = b.frustumCulled = false;
    a.renderOrder = b.renderOrder = 9;
    rotor.add(a, b);
    const glow = new THREE.Sprite(mats.glow);
    glow.position.y = 0.95;
    glow.renderOrder = 10;
    g.add(base, dome, rotor, glow);

    // Humo: cada bocanada tiene su propio material (para su opacidad), todas comparten textura.
    const smoke: THREE.Sprite[] = [];
    const smokeMats: THREE.SpriteMaterial[] = [];
    for (let i = 0; i < MAX_SMOKE; i++) {
      const mat = own(new THREE.SpriteMaterial({ map: tex, color: SMOKE, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      const s = new THREE.Sprite(mat);
      s.visible = false;
      s.renderOrder = 8;
      g.add(s);
      smoke.push(s);
      smokeMats.push(mat);
    }
    group.add(g);
    return { id: m.id, group: g, rotor, glow, mats, smoke, smokeMats, broken: false, amount: 0, phase: mi * 1.7 };
  });
  const byId = new Map<ModuleId, Beacon>(beacons.map((b) => [b.id, b]));

  let tier: AlarmTier = 'high';

  return {
    group,
    setBroken(id, broken) {
      const b = byId.get(id);
      if (!b || b.broken === broken) return;
      b.broken = broken;
      if (broken) onAlarm?.(id);
    },
    setTier(next) {
      tier = next;
    },
    update(dt, time, reduced) {
      let any = false;
      for (const b of beacons) {
        b.amount = reduced ? (b.broken ? 1 : 0) : damp(b.amount, b.broken ? 1 : 0, DAMP_K, dt);
        if (b.amount < 0.01 && !b.broken) {
          if (b.group.visible) {
            b.group.visible = false;
            for (const s of b.smoke) s.visible = false;
          }
          continue;
        }
        any = true;
        b.group.visible = true;
        const amt = b.amount;
        // Giro uniforme; con movimiento reducido la baliza queda fija.
        const angle = reduced ? 0 : time * TURN_SPEED + b.phase;
        b.rotor.rotation.y = angle;
        // Pulso suave de la cúpula, ligado al giro (sin parpadeos duros).
        const pulse = reduced ? 1 : 0.7 + 0.3 * Math.cos(angle * 2);
        b.glow.scale.setScalar(4.2 + 1.8 * pulse);

        // El humo es función del tiempo: sin estado ni asignaciones.
        const count = reduced ? 0 : SMOKE_COUNT[tier];
        for (let i = 0; i < MAX_SMOKE; i++) {
          const s = b.smoke[i]!;
          if (i >= count) {
            s.visible = false;
            continue;
          }
          const u = (time / SMOKE_LIFE + i / count + b.phase * 0.37) % 1;
          // Entra y sale con un seno; sube con frenada y deriva un poco de lado.
          const fade = Math.sin(Math.PI * u);
          s.visible = true;
          s.position.set(
            Math.sin(i * 2.4 + b.phase) * (0.5 + u * 1.4) + u * 0.9,
            0.5 + SMOKE_RISE * (1 - (1 - u) * (1 - u)),
            Math.cos(i * 1.9 + b.phase) * (0.5 + u * 1.4),
          );
          s.scale.setScalar(1.4 + u * 5);
          b.smokeMats[i]!.opacity = SMOKE_PEAK_OPACITY * fade * fade * amt;
        }
        b.mats.dome.opacity = amt;
        b.mats.beam.opacity = 0.4 * amt;
        b.mats.glow.opacity = 0.55 * amt;
      }
      group.visible = any;
    },
    dispose() {
      for (const d of disposables) d.dispose();
      group.removeFromParent();
    },
  };
}
