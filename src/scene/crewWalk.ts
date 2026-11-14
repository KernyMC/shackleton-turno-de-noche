// La tripulación vive en los pasillos de vidrio y reacciona al juego:
//   - cada uno pasa la mayor parte del tiempo junto a SU módulo, con una acción de rol (accesorios en
//     crewProps.ts) y de vez en cuando camina por su pasillo hasta el núcleo y vuelve (ciclos con
//     tiempos distintos por tripulante, deterministas: PRNG de semilla fija);
//   - si el jugador sube o baja la energía de su módulo, va (o se gira) hacia él y hace un gesto breve;
//   - tormenta + refugio: los cuatro corren al módulo de Blindaje;
//   - reparación marcada: la mecánica corre por el pasillo al módulo averiado, aparece la llave, la barra
//     y las chispas; al terminar vuelve a su taller;
//   - rover fuera: la mecánica sale con él;
//   - noche: linternas de los cascos encendidas;
//   - ánimo: una carita sobre cada uno; si está preocupado camina más lento.
// Solo refleja estado. Todo el azar es visual y determinista (no afecta al juego).
// Con movimiento reducido: sin ciclos ni gestos; cada uno quieto junto a su módulo con su accesorio.

import * as THREE from 'three';
import type { CrewId, CrewMember } from '../data/crew';
import type { ModuleId } from '../sim/types';
import { createRng } from '../sim/rng';
import type { Rng } from '../sim/rng';
import { createAstronaut } from './astronaut';
import type { Astronaut, AstronautPose } from './astronaut';
import { MODULES } from './base';
import { createCrewProps } from './crewProps';

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
  /** Destello del Sol en los visores, de 0 a 1. */
  setGlint(amount: number): void;
  /** Los astronautas cercanos miran hacia un módulo ~3 s (giro amortiguado); null cancela. */
  lookAt(id: ModuleId | null): void;
  /**
   * El jugador cambió la energía de un módulo (delta con signo): su tripulante va (o se gira) hacia él
   * y hace un gesto breve. Como mucho una reacción cada 1,5 s por tripulante; nada con reduced motion.
   */
  react(id: ModuleId, delta: number, newValue: number): void;
  /** Se desbloqueó un módulo: los cuatro aplauden (pose de alegría y un saltito) una vez. Nada con reduced motion ni en refugio. */
  celebrate(): void;
  /** Se pasó el día con una reparación en marcha: la barra se llena y salta una ráfaga de chispas. */
  repairBeat(): void;
  /** Cuántos astronautas hay y dónde está la cabeza de cada uno (false si no se ve). Sin asignar memoria. */
  count: number;
  anchor(index: number, out: THREE.Vector3): boolean;
  update(dt: number, time: number, reducedMotion: boolean): void;
  dispose(): void;
}

const SCALE = 0.62;
const WALK_SPEED = 1.1; // m/s
/** Mirar un aviso: duración, alcance (m) y rapidez del giro. */
const LOOK_SECONDS = 3;
const LOOK_RANGE = 18;
const LOOK_DAMP = 5;
/** Posición en el pasillo (0 = refugio central, 1 = dentro del módulo). */
const HOME_T = 0.66; // su puesto de trabajo, junto a su módulo
const CORE_T = 0.07; // casi en el refugio
const REPAIR_T = 0.82; // donde se planta la mecánica frente al módulo averiado
/** Reacciones a las decisiones: separación mínima, duración del gesto y paciencia para llegar. */
const REACT_COOLDOWN = 1.5;
const GESTURE_SECONDS = 1.2;
const REACT_PATIENCE = 14;
/** Con la reparación marcada la mecánica corre (más que andando, menos que con la tormenta). */
const REPAIR_PACE = 2.7;
const REPAIR_SECONDS = 4;
const BEAT_SECONDS = 1.5;
const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const MOOD_COLOR: Record<Mood, string> = { happy: '#7ccf8a', neutral: '#f2d15c', worried: '#ff6b5e' };

/**
 * Acción de rol junto a su módulo: pose y hacia dónde mira, en metros respecto a su puesto
 * (f: hacia el módulo a lo largo del pasillo; s: hacia el lado). Los accesorios fijos se colocan ahí.
 */
const ROLE: Record<CrewId, { pose: AstronautPose; face: [number, number] }> = {
  valeria: { pose: 'reach', face: [0.3, -0.34] }, // panel de control
  mateo: { pose: 'crouch', face: [0, -0.36] }, // jardinera
  amaru: { pose: 'inspect', face: [1, 0] }, // dosímetro en la mano
  lucia: { pose: 'stand', face: [1, 0] }, // caja de herramientas en el suelo, a su lado
};
/** Dónde deja Lucía la caja respecto a ella (lado, m). */
const TOOLBOX_SIDE = 0.34;

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

/** Ciclo de su día: en su puesto, camina al núcleo, espera un momento y vuelve. */
type Phase = 'home' | 'out' | 'core' | 'back';

interface Walker {
  member: CrewMember;
  astro: Astronaut;
  corridor: ModuleId;
  t: number;
  goal: { corridor: ModuleId; t: number };
  pause: number;
  mood: Mood;
  moodBadge: ReturnType<typeof badge>;
  repairTime: number;
  rng: Rng;
  phase: Phase;
  timer: number;
  forced: boolean;
  /** Reacción pedida por el jugador: espera a llegar a su puesto y entonces hace el gesto. */
  react: { pending: boolean; up: boolean; amount: number; patience: number };
  gesture: { left: number; up: boolean; amount: number };
  cool: number;
  /** Hacia dónde mira en su puesto (mundo, x/z). */
  face: { x: number; z: number };
  /** Lucía: la caja va en la mano mientras camina y en el suelo mientras trabaja. */
  carrying: boolean;
}

export function createCrewWalk(routes: Record<ModuleId, THREE.Vector3[]>, members: CrewMember[]): CrewWalk {
  const group = new THREE.Group();
  const curves = new Map<ModuleId, THREE.CatmullRomCurve3>();
  for (const [id, points] of Object.entries(routes) as [ModuleId, THREE.Vector3[]][]) curves.set(id, new THREE.CatmullRomCurve3(points));
  const lengths = new Map([...curves].map(([id, c]) => [id, c.getLength()]));

  const props = createCrewProps(SCALE);
  group.add(props.group);

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
  // Las chispas se mueven por todo el pasillo: no se recortan por su caja inicial.
  sparks.frustumCulled = false;
  group.add(sparks);
  const sparkOrigin = new THREE.Vector3();
  const sparkRng = createRng(7);

  const pos = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmpTan = new THREE.Vector3();

  const homeAt = (id: ModuleId, out: THREE.Vector3, outTangent: THREE.Vector3): void => {
    const c = curves.get(id)!;
    c.getPointAt(HOME_T, out);
    c.getTangentAt(HOME_T, outTangent);
  };

  const walkers: Walker[] = members.map((member, i) => {
    const astro = createAstronaut(member.color, i * 1.3);
    // Dentro del vidrio su sombra no se ve: no la calculamos (rendimiento).
    astro.group.traverse((o) => (o.castShadow = false));
    astro.group.scale.setScalar(SCALE);
    group.add(astro.group);
    const moodBadge = badge((ctx) => drawMood(ctx, 'happy'), 0.6);
    group.add(moodBadge.sprite);

    // Su puesto: posición, lado y hacia dónde mira. Los accesorios fijos se colocan aquí una sola vez.
    homeAt(member.module, tmp, tmpTan);
    side.set(-tmpTan.z, 0, tmpTan.x);
    const [f, s] = ROLE[member.id].face;
    const face = { x: tmp.x + tmpTan.x * f + side.x * s, z: tmp.z + tmpTan.z * f + side.z * s };
    if (member.id === 'valeria') {
      props.panel.position.set(face.x, tmp.y, face.z);
      props.panel.rotation.y = Math.atan2(tmp.x - face.x, tmp.z - face.z);
    } else if (member.id === 'mateo') {
      props.plants.position.set(face.x, tmp.y, face.z);
      props.plants.rotation.y = Math.atan2(-tmpTan.z, tmpTan.x); // su lado largo, a lo largo del pasillo
    } else if (member.id === 'amaru') {
      props.holdDosimeter(astro.hands.right);
    } else {
      props.dropToolbox(tmp.x + side.x * TOOLBOX_SIDE, tmp.y, tmp.z + side.z * TOOLBOX_SIDE, Math.atan2(-tmpTan.z, tmpTan.x));
    }

    const rng = createRng(1009 + i * 7919);
    const walker: Walker = {
      member,
      astro,
      corridor: member.module,
      t: HOME_T,
      goal: { corridor: member.module, t: HOME_T },
      pause: 0,
      mood: 'happy',
      moodBadge,
      repairTime: 0,
      rng,
      phase: 'home',
      // Cada uno sale de paseo en un momento distinto.
      timer: 5 + i * 9 + rng.next() * 8,
      forced: false,
      react: { pending: false, up: true, amount: 1, patience: 0 },
      gesture: { left: 0, up: true, amount: 1 },
      cool: 0,
      face,
      carrying: false,
    };
    astro.group.position.copy(tmp);
    astro.group.rotation.y = Math.atan2(face.x - tmp.x, face.z - tmp.z);
    return walker;
  });
  const lucia = walkers.find((w) => w.member.id === 'lucia');

  let state: CrewWalkState = {
    moods: { valeria: 'happy', mateo: 'happy', amaru: 'happy', lucia: 'happy' },
    shelter: false,
    broken: null,
    repairing: false,
    roverAway: false,
  };

  /** A dónde quiere ir cada uno según lo que pasa en la base (prioridad sobre su rutina). */
  const desiredGoal = (w: Walker): { corridor: ModuleId; t: number } | null => {
    if (state.shelter) return { corridor: 'shield', t: 0.97 };
    if (w.member.id === 'lucia' && state.roverAway) return { corridor: 'workshop', t: 1 };
    if (w.member.id === 'lucia' && state.broken && state.repairing) return { corridor: state.broken, t: REPAIR_T };
    return null;
  };

  const backHome = (w: Walker): void => {
    w.phase = 'back';
    w.goal = { corridor: w.member.module, t: HOME_T };
  };

  let lookTarget: { x: number; z: number } | null = null;
  let lookLeft = 0;
  let beatLeft = 0;
  let wrenchWasOn = false;
  return {
    group,
    count: walkers.length,
    lookAt(id) {
      const m = id ? MODULES.find((mod) => mod.id === id) : null;
      lookTarget = m ? { x: m.x, z: m.z } : null;
      lookLeft = m ? LOOK_SECONDS : 0;
    },
    react(id, delta, newValue) {
      const w = walkers.find((x) => x.member.module === id);
      if (!w || delta === 0 || w.forced || w.cool > 0) return;
      w.cool = REACT_COOLDOWN;
      w.react.pending = true;
      w.react.up = delta > 0;
      // Bajar a 0 es el golpe más fuerte; bajar un poco, un suspiro.
      w.react.amount = delta > 0 ? 1 : newValue <= 0 ? 1 : 0.45;
      w.react.patience = REACT_PATIENCE;
    },
    repairBeat() {
      beatLeft = BEAT_SECONDS;
    },
    celebrate() {
      if (state.shelter) return;
      for (const w of walkers) {
        if (w.forced || !w.astro.group.visible) continue;
        w.react.pending = false;
        w.gesture.left = GESTURE_SECONDS + 0.4;
        w.gesture.up = true;
        w.gesture.amount = 1;
        w.astro.hop();
      }
    },
    anchor(index, out) {
      const w = walkers[index];
      if (!w || !w.astro.group.visible) return false;
      out.copy(w.astro.group.position);
      out.y += 1.75;
      return true;
    },
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
    setGlint(amount) {
      for (const w of walkers) w.astro.setGlint(amount);
    },
    update(dt, time, reducedMotion) {
      let wrenchOn = false;
      let repairProgress = 0;
      if (lookLeft > 0) lookLeft -= dt;
      if (beatLeft > 0) beatLeft -= dt;
      const looking = lookLeft > 0 ? lookTarget : null;
      props.update(time, reducedMotion);
      for (const w of walkers) {
        const isLucia = w === lucia;
        if (w.cool > 0) w.cool -= dt;
        const forced = desiredGoal(w);
        const wasForced = w.forced;
        w.forced = forced !== null;
        const module = w.member.module;
        const homeSpot = w.corridor === module && Math.abs(w.t - HOME_T) < 0.015;
        if (forced) {
          w.goal = forced;
          w.pause = 0;
          w.react.pending = false;
          w.gesture.left = 0;
          w.phase = 'back';
        } else if (reducedMotion) {
          // Sin paseos ni gestos: quieto en su puesto con su accesorio.
          w.corridor = module;
          w.t = HOME_T;
          w.goal = { corridor: module, t: HOME_T };
          w.phase = 'home';
          w.react.pending = false;
          w.gesture.left = 0;
        } else {
          if (wasForced) backHome(w);
          if (w.pause > 0) w.pause -= dt;
          // Reacción pedida: va a su puesto y hace el gesto (o lo olvida si tarda demasiado).
          if (w.react.pending) {
            w.react.patience -= dt;
            if (w.react.patience <= 0) w.react.pending = false;
            else {
              if (w.phase !== 'back' || w.goal.corridor !== module || w.goal.t !== HOME_T) backHome(w);
              if (homeSpot && w.pause <= 0) {
                w.react.pending = false;
                w.gesture.left = GESTURE_SECONDS;
                w.gesture.up = w.react.up;
                w.gesture.amount = w.react.amount;
                if (w.react.up) w.astro.hop();
              }
            }
          }
          if (w.gesture.left > 0) {
            w.gesture.left -= dt;
            if (w.gesture.left <= 0) {
              w.phase = 'home';
              w.timer = 12 + w.rng.next() * 14;
            }
          } else if (!w.react.pending) {
            const arrived = w.corridor === w.goal.corridor && Math.abs(w.t - w.goal.t) <= 0.004;
            if (w.phase === 'home') {
              if (!homeSpot) backHome(w);
              else if (w.pause <= 0 && (w.timer -= dt) <= 0) {
                w.phase = 'out';
                w.goal = { corridor: module, t: CORE_T };
              }
            } else if (w.phase === 'out') {
              if (arrived) {
                w.phase = 'core';
                w.timer = 2.5 + w.rng.next() * 2.5;
              }
            } else if (w.phase === 'core') {
              if (w.pause <= 0 && (w.timer -= dt) <= 0) backHome(w);
            } else if (arrived) {
              w.phase = 'home';
              w.timer = 14 + w.rng.next() * 18;
            }
          }
        }
        // Un aviso cerca: se detienen a mirar (el tiempo que dure la mirada).
        if (looking && !forced && Math.hypot(looking.x - w.astro.group.position.x, looking.z - w.astro.group.position.z) < LOOK_RANGE) {
          w.pause = Math.max(w.pause, lookLeft);
        }

        // Para cambiar de pasillo hay que pasar por el centro (t = 0).
        const targetT = w.corridor === w.goal.corridor ? w.goal.t : 0;
        const repairRun = forced !== null && isLucia && !state.shelter && !state.roverAway;
        const hurry = state.shelter ? 2.4 : repairRun ? REPAIR_PACE : w.mood === 'worried' ? 0.6 : 1;
        const step = ((WALK_SPEED * hurry) / (lengths.get(w.corridor) ?? 10)) * dt;
        const holding = w.gesture.left > 0;
        const moving = !holding && w.pause <= 0 && Math.abs(targetT - w.t) > 0.002;
        if (moving) {
          w.t += Math.sign(targetT - w.t) * Math.min(step, Math.abs(targetT - w.t));
        } else if (!holding && w.corridor !== w.goal.corridor && w.t <= 0.002) {
          w.corridor = w.goal.corridor; // cruza el centro hacia el otro pasillo
        }

        const curve = curves.get(w.corridor)!;
        const tt = THREE.MathUtils.clamp(w.t, 0, 1);
        curve.getPointAt(tt, pos);
        curve.getTangentAt(tt, tangent);
        if (moving && Math.sign(targetT - w.t) < 0) tangent.negate();
        w.astro.group.position.copy(pos);
        const atHome = w.corridor === module && Math.abs(w.t - HOME_T) < 0.015 && !moving;
        const atRepair = isLucia && !!state.broken && state.repairing && !state.roverAway && !state.shelter && w.corridor === state.broken && Math.abs(w.t - REPAIR_T) < 0.03 && !moving;
        if (moving) w.astro.group.rotation.y = Math.atan2(tangent.x, tangent.z);
        else {
          // Parado: mira un aviso cercano, su trabajo o el módulo que repara; el giro es amortiguado.
          let wantX = 0;
          let wantZ = 0;
          let has = false;
          if (looking && Math.hypot(looking.x - pos.x, looking.z - pos.z) < LOOK_RANGE) {
            wantX = looking.x;
            wantZ = looking.z;
            has = true;
          } else if (atRepair) {
            const m = MODULES.find((mod) => mod.id === state.broken);
            if (m) {
              wantX = m.x;
              wantZ = m.z;
              has = true;
            }
          } else if (atHome) {
            wantX = w.face.x;
            wantZ = w.face.z;
            has = true;
          }
          if (has && Math.hypot(wantX - pos.x, wantZ - pos.z) > 0.01) {
            const delta = wrapAngle(Math.atan2(wantX - pos.x, wantZ - pos.z) - w.astro.group.rotation.y);
            w.astro.group.rotation.y += reducedMotion ? delta : delta * (1 - Math.exp(-LOOK_DAMP * dt));
          }
        }
        w.astro.setWalking(moving ? (hurry > 1.5 ? 2 : 1) : 0);

        // Pose: gesto de reacción > reparar > acción de su rol en su puesto > caminar (con la caja de Lucía).
        let pose: AstronautPose = 'stand';
        let amount = 1;
        if (w.gesture.left > 0) {
          pose = w.gesture.up ? 'cheer' : 'slump';
          amount = w.gesture.amount;
        } else if (atRepair) pose = 'reach';
        else if (atHome && !forced) pose = ROLE[w.member.id].pose;
        if (isLucia) {
          // La caja: en la mano al caminar, en el suelo a su lado al trabajar.
          const working = !moving && (atHome || atRepair);
          if (working && w.carrying) {
            side.set(-tangent.z, 0, tangent.x);
            props.dropToolbox(pos.x + side.x * TOOLBOX_SIDE, pos.y, pos.z + side.z * TOOLBOX_SIDE, Math.atan2(-tangent.z, tangent.x));
            w.carrying = false;
          } else if (!working && !w.carrying) {
            props.holdToolbox(w.astro.hands.left);
            w.carrying = true;
          }
          if (w.carrying && pose === 'stand') pose = 'carry';
        }
        w.astro.setPose(pose, amount);

        // Fuera de la base con el rover: no se ve.
        const outside = isLucia && state.roverAway && w.t > 0.98;
        w.astro.group.visible = !outside;
        w.moodBadge.sprite.visible = !outside;
        w.moodBadge.sprite.position.set(pos.x, pos.y + 1.75, pos.z);
        w.astro.update(dt, time, reducedMotion);

        // Reparación: llave y barra que se llenan mientras está plantada frente al módulo roto.
        if (atRepair) {
          wrenchOn = true;
          w.repairTime += dt;
          repairProgress = beatLeft > 0 ? 1 : Math.min(1, w.repairTime / REPAIR_SECONDS);
          // La llave sustituye a la carita mientras trabaja (si no, se pisan).
          w.moodBadge.sprite.visible = false;
          wrench.sprite.position.set(pos.x, pos.y + 1.95, pos.z);
          sparkOrigin.set(pos.x + tangent.x * 0.5, pos.y + 0.6, pos.z + tangent.z * 0.5);
        } else if (isLucia) {
          w.repairTime = 0;
        }
      }
      if (wrenchOn) {
        if (!wrenchWasOn || Math.floor(time * 4) !== Math.floor((time - dt) * 4)) wrench.redraw((ctx) => drawWrench(ctx, repairProgress));
      }
      wrenchWasOn = wrenchOn;
      wrench.sprite.visible = wrenchOn;

      // Chispas: arcos cortos que caen (gravedad lunar); sin chispas con movimiento reducido.
      sparkMat.opacity = wrenchOn && !reducedMotion ? (beatLeft > 0 ? 1 : 0.9) : 0;
      if (sparkMat.opacity > 0) {
        const respawn = beatLeft > 0 ? 0.12 : 0.02;
        for (let i = 0; i < sparkCount; i++) {
          let x = sparkPos[i * 3]!, y = sparkPos[i * 3 + 1]!, z = sparkPos[i * 3 + 2]!;
          const v = sparkVel[i]!;
          if (y < sparkOrigin.y - 0.6 || v.lengthSq() === 0 || sparkRng.next() < respawn) {
            x = sparkOrigin.x; y = sparkOrigin.y; z = sparkOrigin.z;
            v.set((sparkRng.next() - 0.5) * 1.6, 0.6 + sparkRng.next() * 1.2, (sparkRng.next() - 0.5) * 1.6);
          }
          v.y -= 1.62 * dt;
          sparkPos[i * 3] = x + v.x * dt;
          sparkPos[i * 3 + 1] = y + v.y * dt;
          sparkPos[i * 3 + 2] = z + v.z * dt;
        }
        sparkGeo.attributes.position!.needsUpdate = true;
      }
    },
    dispose() {
      for (const w of walkers) {
        w.astro.dispose();
        w.moodBadge.dispose();
      }
      props.dispose();
      wrench.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
    },
  };
}
