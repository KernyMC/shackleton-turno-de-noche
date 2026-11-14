// La tripulación camina por los pasillos de vidrio y reacciona al juego:
//   - cada uno patrulla su pasillo (entre su módulo y el centro) con paradas;
//   - tormenta + refugio: los cuatro corren al módulo de Blindaje;
//   - avería: la mecánica va al módulo roto, con un ícono de llave y una barra de reparación;
//   - rover fuera: la mecánica sale con él;
//   - noche: linternas de los cascos encendidas;
//   - ánimo: una carita sobre cada uno; si está preocupado camina más lento.
// Solo refleja estado. La aleatoriedad (paradas) es visual y no afecta al juego.

import * as THREE from 'three';
import type { CrewId, CrewMember } from '../data/crew';
import type { ModuleId } from '../sim/types';
import { createAstronaut } from './astronaut';
import type { Astronaut } from './astronaut';

export type Mood = 'happy' | 'neutral' | 'worried';

export interface CrewWalkState {
  moods: Record<CrewId, Mood>;
  shelter: boolean;
  broken: ModuleId | null;
  repairing: boolean;
  roverAway: boolean;
}

export interface CrewWalk {
  group: THREE.Group;
  setState(state: CrewWalkState): void;
  setNight(night: boolean): void;
  update(dt: number, time: number, reducedMotion: boolean): void;
  dispose(): void;
}

const SCALE = 0.62;
const WALK_SPEED = 1.1; // m/s
const MOOD_COLOR: Record<Mood, string> = { happy: '#7ccf8a', neutral: '#f2d15c', worried: '#ff6b5e' };

/** Carita dibujada en un lienzo (sin emojis, para respetar la dirección de arte). */
function drawMood(ctx: CanvasRenderingContext2D, mood: Mood): void {
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(11,12,14,0.85)';
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = MOOD_COLOR[mood];
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = MOOD_COLOR[mood];
  ctx.beginPath();
  ctx.arc(23, 27, 3.5, 0, Math.PI * 2);
  ctx.arc(41, 27, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'happy') ctx.arc(32, 34, 11, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (mood === 'neutral') {
    ctx.moveTo(22, 42);
    ctx.lineTo(42, 42);
  } else ctx.arc(32, 50, 11, 1.15 * Math.PI, 1.85 * Math.PI);
  ctx.stroke();
}

/** Llave inglesa con barra de progreso (reparación). */
function drawWrench(ctx: CanvasRenderingContext2D, progress: number): void {
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(11,12,14,0.9)';
  ctx.beginPath();
  ctx.roundRect(2, 2, 60, 60, 12);
  ctx.fill();
  ctx.strokeStyle = '#ff7a3d';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.save();
  ctx.translate(12, 8);
  ctx.scale(2, 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D('M12.5 3.2a3.8 3.8 0 0 0-4.6 5L3.4 12.7a1.6 1.6 0 0 0 2.3 2.3l4.5-4.5a3.8 3.8 0 0 0 5-4.6l-2.3 2.3-2-.4-.4-2Z'));
  ctx.restore();
  ctx.fillStyle = '#23252a';
  ctx.fillRect(8, 50, 48, 6);
  ctx.fillStyle = '#ff7a3d';
  ctx.fillRect(8, 50, 48 * progress, 6);
}

function badge(draw: (ctx: CanvasRenderingContext2D) => void, size: number): { sprite: THREE.Sprite; redraw(draw: (ctx: CanvasRenderingContext2D) => void): void; dispose(): void } {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(size);
  sprite.renderOrder = 12;
  return {
    sprite,
    redraw(next) {
      next(ctx);
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      material.dispose();
    },
  };
}

interface Walker {
  member: CrewMember;
  astro: Astronaut;
  curves: Map<ModuleId, THREE.CatmullRomCurve3>;
  corridor: ModuleId;
  t: number;
  goal: { corridor: ModuleId; t: number };
  pause: number;
  mood: Mood;
  moodBadge: ReturnType<typeof badge>;
  repairTime: number;
}

export function createCrewWalk(routes: Record<ModuleId, THREE.Vector3[]>, members: CrewMember[]): CrewWalk {
  const group = new THREE.Group();
  const curves = new Map<ModuleId, THREE.CatmullRomCurve3>();
  for (const [id, points] of Object.entries(routes) as [ModuleId, THREE.Vector3[]][]) curves.set(id, new THREE.CatmullRomCurve3(points));
  const lengths = new Map([...curves].map(([id, c]) => [id, c.getLength()]));

  const wrench = badge((ctx) => drawWrench(ctx, 0), 0.75);
  wrench.sprite.visible = false;
  group.add(wrench.sprite);

  // Chispas pequeñas en la avería.
  const sparkCount = 14;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkVel = Array.from({ length: sparkCount }, () => new THREE.Vector3());
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({ color: 0xffc46b, size: 0.12, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  group.add(sparks);
  const sparkOrigin = new THREE.Vector3();

  const walkers: Walker[] = members.map((member, i) => {
    const astro = createAstronaut(member.color, i * 1.3);
    astro.group.scale.setScalar(SCALE);
    group.add(astro.group);
    const moodBadge = badge((ctx) => drawMood(ctx, 'happy'), 0.6);
    group.add(moodBadge.sprite);
    return {
      member,
      astro,
      curves,
      corridor: member.module,
      t: 0.2 + i * 0.15,
      goal: { corridor: member.module, t: 0.6 },
      pause: i * 0.8,
      mood: 'happy',
      moodBadge,
      repairTime: 0,
    };
  });

  let state: CrewWalkState = {
    moods: { valeria: 'happy', mateo: 'happy', amaru: 'happy', lucia: 'happy' },
    shelter: false,
    broken: null,
    repairing: false,
    roverAway: false,
  };

  /** A dónde quiere ir cada uno según lo que pasa en la base. */
  const desiredGoal = (w: Walker): { corridor: ModuleId; t: number; hold: boolean } | null => {
    if (state.shelter) return { corridor: 'shield', t: 0.97, hold: true };
    if (w.member.id === 'lucia' && state.roverAway) return { corridor: 'workshop', t: 1, hold: true };
    if (w.member.id === 'lucia' && state.broken) return { corridor: state.broken, t: 0.9, hold: true };
    return null;
  };

  const pos = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  return {
    group,
    setState(next) {
      state = next;
      for (const w of walkers) {
        const mood = next.moods[w.member.id];
        if (mood !== w.mood) {
          w.mood = mood;
          w.moodBadge.redraw((ctx) => drawMood(ctx, mood));
        }
      }
    },
    setNight(night) {
      for (const w of walkers) w.astro.setLamp(night);
    },
    update(dt, time, reducedMotion) {
      let wrenchOn = false;
      for (const w of walkers) {
        const forced = desiredGoal(w);
        if (forced) {
          w.goal = { corridor: forced.corridor, t: forced.t };
          w.pause = 0;
        } else if (w.pause > 0) {
          w.pause -= dt;
        }

        // Para cambiar de pasillo hay que pasar por el centro (t = 0).
        const targetT = w.corridor === w.goal.corridor ? w.goal.t : 0;
        const pace = state.shelter ? 2.4 : w.mood === 'worried' ? 0.6 : 1;
        const step = ((WALK_SPEED * pace) / (lengths.get(w.corridor) ?? 10)) * dt;
        const moving = w.pause <= 0 && Math.abs(targetT - w.t) > 0.002;
        if (moving) {
          w.t += Math.sign(targetT - w.t) * Math.min(step, Math.abs(targetT - w.t));
        } else if (w.corridor !== w.goal.corridor && w.t <= 0.002) {
          w.corridor = w.goal.corridor; // cruza el centro hacia el otro pasillo
        } else if (!forced && w.pause <= 0) {
          // Patrulla: nueva parada al azar en su pasillo.
          w.goal = { corridor: w.member.module, t: 0.15 + Math.random() * 0.75 };
          w.pause = 1.5 + Math.random() * 3;
        }

        const curve = w.curves.get(w.corridor)!;
        curve.getPointAt(THREE.MathUtils.clamp(w.t, 0, 1), pos);
        curve.getTangentAt(THREE.MathUtils.clamp(w.t, 0, 1), tangent);
        if (moving && Math.sign(targetT - w.t) < 0) tangent.negate();
        w.astro.group.position.copy(pos);
        if (moving) w.astro.group.rotation.y = Math.atan2(tangent.x, tangent.z);
        w.astro.setWalking(moving ? (state.shelter ? 2 : 1) : 0);
        // Fuera de la base con el rover: no se ve.
        const outside = w.member.id === 'lucia' && state.roverAway && w.t > 0.98;
        w.astro.group.visible = !outside;
        w.moodBadge.sprite.visible = !outside;
        w.moodBadge.sprite.position.copy(pos).add(new THREE.Vector3(0, 1.75, 0));
        w.astro.update(dt, time, reducedMotion);

        // Reparación: llave y barra que se llena mientras está junto al módulo roto.
        if (w.member.id === 'lucia' && state.broken && !state.roverAway && w.corridor === state.broken && w.t > 0.85) {
          wrenchOn = true;
          w.repairTime += dt;
          const progress = state.repairing ? Math.min(1, w.repairTime / 4) : 0;
          if (Math.floor(time * 4) !== Math.floor((time - dt) * 4)) wrench.redraw((ctx) => drawWrench(ctx, progress));
          wrench.sprite.position.copy(pos).add(new THREE.Vector3(0, 1.95, 0));
          sparkOrigin.copy(pos).add(new THREE.Vector3(0, 0.6, 0)).addScaledVector(tangent, 0.5);
        } else if (w.member.id === 'lucia') {
          w.repairTime = 0;
        }
      }
      wrench.sprite.visible = wrenchOn;

      // Chispas: arcos cortos que caen (gravedad lunar); sin chispas con movimiento reducido.
      sparkMat.opacity = wrenchOn && !reducedMotion ? 0.9 : 0;
      if (sparkMat.opacity > 0) {
        for (let i = 0; i < sparkCount; i++) {
          let x = sparkPos[i * 3]!, y = sparkPos[i * 3 + 1]!, z = sparkPos[i * 3 + 2]!;
          const v = sparkVel[i]!;
          if (y < sparkOrigin.y - 0.6 || v.lengthSq() === 0 || Math.random() < 0.02) {
            x = sparkOrigin.x; y = sparkOrigin.y; z = sparkOrigin.z;
            v.set((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6);
          }
          v.y -= 1.62 * dt;
          sparkPos.set([x + v.x * dt, y + v.y * dt, z + v.z * dt], i * 3);
        }
        sparkGeo.attributes.position!.needsUpdate = true;
      }
    },
    dispose() {
      for (const w of walkers) {
        w.astro.dispose();
        w.moodBadge.dispose();
      }
      wrench.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
    },
  };
}
