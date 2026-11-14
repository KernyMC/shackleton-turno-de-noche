// Mundo 3D: una maqueta viva de la base lunar que se mira y se toca. Three.js puro, sin Preact.
// La cámara orbita sola; se puede arrastrar para girar y usar la rueda para acercar.
// Tocar un módulo avisa a la interfaz. Solo REFLEJA el estado; nunca calcula reglas del juego.
// Spec: docs/specs/02-primera-persona.md (sección "Maqueta"). Arte: docs/ARTE.md.

import * as THREE from 'three';
import type { ModuleId, StormLevel } from '../sim/types';
import { createAlarmFx } from './alarmFx';
import { createStormFx } from './stormFx';
import { createAstronaut } from './astronaut';
import type { Astronaut } from './astronaut';
import { createBase, LANDER_SPOT, MODULES } from './base';
import { createDust } from './dust';
import { createEnergyFlow } from './energyFlow';
import { createRepairFx } from './repairFx';
import { CREW } from '../data/crew';
import { createCrewWalk } from './crewWalk';
import type { CrewWalkState } from './crewWalk';
import { createRocket } from './rocket';
import { createSky, EARTH_SKY } from './sky';
import type { ModuleVisualState } from './base';
import { createTerrain, TEXTURE_URLS } from './terrain';

export interface WorldCallbacks {
  /** Módulo bajo el cursor (o null). */
  onHover(id: ModuleId | null): void;
  /** El jugador tocó un módulo. */
  onSelect(id: ModuleId): void;
  /** Qué recursos reales se cargaron (terreno CGI Moon Kit, modelos GLB). */
  onAssets?(assets: { terrain?: 'real' | 'procedural'; models?: string[] }): void;
  /** Astronauta de la fila de presentación bajo el cursor (o null). */
  onCrewHover?(id: string | null): void;
  /** El jugador tocó un astronauta de la fila. */
  onCrewSelect?(id: string): void;
}

export interface CrewLineupMember {
  id: string;
  color: number;
}

export interface World {
  /** Luz solar del día, de 0 a 1. */
  setSunlight(light: number): void;
  /** Posición del Sol en el horizonte (radianes); avanza con los días. */
  setSunAzimuth(azimuth: number): void;
  setModule(id: ModuleId, state: ModuleVisualState): void;
  /** Módulo elegido: anillo de su color en el suelo. */
  setSelected(id: ModuleId | null): void;
  /** Nombres traducidos de los módulos, para sus rótulos. */
  setLabels(names: Record<ModuleId, string>): void;
  setShelter(active: boolean): void;
  setRoverAway(away: boolean): void;
  /** Tormenta solar en curso: tinte en el horizonte. */
  setStorm(active: boolean): void;
  /**
   * Desplaza la imagen cuando un panel tapa parte de la pantalla: `up` hacia arriba (0..0.5 de la
   * altura) y `right` hacia la derecha (-0.5..0.5 del ancho; negativo = hacia la izquierda).
   */
  setViewShift(up: number, right?: number): void;
  /**
   * Centra la cámara en un módulo (el punto de mira se desplaza y el radio se acerca) o, con null,
   * vuelve al centro de la base y al radio por defecto. Todo amortiguado.
   */
  centerOn(id: ModuleId | null): void;
  /** Posición en pantalla (px, relativa a la ventana) de lo alto de un módulo. */
  projectModule(id: ModuleId): { x: number; y: number } | null;
  /** La tripulación dentro de la base: ánimo, refugio, avería, rover. */
  setCrewState(state: CrewWalkState): void;
  /** Mirar al cielo (estrellas, Vía Láctea y la Tierra) o volver a la vista de la base. */
  setSkyLook(on: boolean): void;
  /** Muestra u oculta los rótulos de los módulos. */
  setLabelsVisible(visible: boolean): void;
  setReducedMotion(reduced: boolean): void;
  /**
   * Pantalla de inicio: la tripulación en fila frente a la base y una cámara baja que hace un
   * travelling lento. Con lista vacía se quita la fila y vuelve la cámara en órbita.
   */
  showCrew(members: CrewLineupMember[]): void;
  /** En la presentación: 'title' es la portada (tripulación de cerca, Tierra y cohete); 'crew' es la fila. */
  setIntroView(view: 'title' | 'crew'): void;
  /** Reparto de energía del día: Sol -> paneles -> batería -> módulos. `night`: sin Sol. */
  playEnergy(plan: Record<ModuleId, number>, night: boolean): void;
  /** Carga de la batería (0..1) en su indicador de celdas. */
  setBattery(fraction: number): void;
  /**
   * Tormenta solar de hoy (null: ninguna): brillo violeta, lluvia suave en el aviso y domo si hay refugio.
   * `pending`: el aviso aún no se ha decidido.
   */
  setStormFx(level: StormLevel | null, options?: { sheltered?: boolean; pending?: boolean }): void;
  /** La tormenta a pleno ~2,5 s (al resolver el día de la tormenta). */
  burstStorm(): void;
  /** "+X mSv" sobre cada astronauta visible (texto ya formateado). */
  showDose(text: string): void;
  /** Secuencia de reparación estilo cómic sobre un módulo. */
  playRepair(id: ModuleId): void;
  /** Textos de las onomatopeyas de la reparación (por idioma). */
  setFxLabels(labels: { clank?: string; shuank?: string }): void;
  /** Ilumina y adelanta a un astronauta de la fila (o a ninguno). */
  setCrewFocus(id: string | null): void;
  /**
   * Secuencia de entrada: la tripulación se da la vuelta, camina en fila hasta la escotilla del
   * refugio y entra; la cámara la sigue y después sube a la vista de la base.
   * Instantánea con movimiento reducido o con la pestaña oculta.
   */
  flyIn(durationMs: number): Promise<void>;
  /**
   * Se resuelve cuando el terreno y los modelos están colocados y sus shaders compilados: a partir de
   * ahí la maqueta se ve completa y sin tirones. Nunca falla (si algo no carga queda la forma simple).
   */
  ready: Promise<void>;
  dispose(): void;
}

// Cámara casi isométrica: FOV estrecho y radio grande, para el look de maqueta.
const ORBIT = { radius: 93, minRadius: 51, maxRadius: 135, elevation: 0.62, minElevation: 0.03, maxElevation: 1.1 };
/** Campo de visión: la presentación mantiene el suyo; en juego es estrecho (más aún en vertical, 42). */
const FOV = { intro: 46, introPortrait: 62, game: 30, gamePortrait: 42 };
/** Al centrar un módulo el radio se queda en esta fracción del actual. */
const CENTER_ZOOM = 0.6;
const DOUBLE_CLICK_MS = 300;
const CENTER_LOOK = new THREE.Vector3(0, 2, 0);
/** Por debajo de esta elevación la cámara levanta la mirada al cielo. */
const SKY_LOOK_START = 0.3;
const AUTO_SPEED = 0.045; // rad/s
const RESUME_AFTER_MS = 5000;
const CLICK_SLOP_PX = 6;
const STORM_TINT = 0xb48cff;
/** Fila de presentación: delante de la base, mirando a la cámara. */
const LINEUP_Z = 24;
const LINEUP_SPACING = 2.3;
const INTRO_EYE = new THREE.Vector3(0, 3.4, 43);
const INTRO_TARGET = new THREE.Vector3(0, 2.2, 14);
/** Escotilla del refugio, donde entra la tripulación. */
const ENTRY = new THREE.Vector3(0, 0, 6.4);
/**
 * Portada estilo póster: cámara baja y muy cerca, la tripulación en diagonal a la izquierda y
 * el cielo (Tierra grande y cohete) a la derecha.
 */
const TITLE_EYE = new THREE.Vector3(4.4, 1.5, 34);
const TITLE_TARGET = new THREE.Vector3(-2.4, 6.2, 22.5);
/**
 * Desembarco (al pulsar Comenzar): la tripulación sale de la nave de descenso, baja la escalerilla
 * y camina hasta la fila. Fracciones de la secuencia: cada astronauta sale un poco después del
 * anterior, baja (CLIMB), camina (WALK) y se gira hacia la cámara (TURN).
 */
const DISEMBARK_MS = 8000;
const DISEMBARK = { stagger: 0.09, climb: 0.13, walk: 0.53, turn: 0.07 };
/** Escotilla en la cubierta de la nave y pie de la escalerilla (metros desde su centro, hacia la fila). */
const HATCH = { out: 1.4, up: 3.0, foot: 3.2 };
/** Al empezar el desembarco la cámara mira entre la nave y la fila; luego sigue a la tripulación. */
const DISEMBARK_LOOK = new THREE.Vector3(-13, 2.4, 21);
/** Parte de la secuencia (0..1) en la que la tripulación camina; el resto es el vuelo de cámara. */
const WALK_PART = 0.62;

const damp = (current: number, target: number, k: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-k * dt));

/** Dirección fija de la portada (la cámara de portada solo se mece unos centímetros). */
const TITLE_FORWARD = TITLE_TARGET.clone().sub(TITLE_EYE).normalize();
const TITLE_RIGHT = new THREE.Vector3().crossVectors(TITLE_FORWARD, new THREE.Vector3(0, 1, 0)).normalize();

/**
 * Calidad adaptativa. Cada escalón baja el coste: primero la resolución, luego sombras y detalles.
 * Los fps medidos (media de una ventana) mandan: por debajo de dropFps se baja; con holgura sostenida se sube.
 */
type Tier = 'high' | 'medium' | 'low';
const QUALITY_STEPS: { pixelRatio: number; tier: Tier }[] = [
  { pixelRatio: 2, tier: 'high' },
  { pixelRatio: 1.5, tier: 'high' },
  { pixelRatio: 1.25, tier: 'medium' },
  { pixelRatio: 1, tier: 'medium' },
  { pixelRatio: 1, tier: 'low' },
];
const QUALITY = {
  windowSec: 1.5, // ventana de medida
  warmupSec: 1.2, // tras un cambio o el arranque (compilación de shaders) no se mide
  dropFps: 50,
  panicFps: 28, // por debajo se bajan dos escalones de golpe
  raiseFps: 56,
  raiseAfterSec: 8, // holgura sostenida antes de subir
  raiseAfterMaxSec: 120, // si subir provocó una bajada, se espera el doble cada vez, hasta este tope
  regretSec: 20, // bajar antes de este tiempo tras subir cuenta como arrepentimiento
  stallSec: 0.25, // un fotograma más lento que esto (pestaña dormida) no cuenta
};
/** Sombras: mapa grande en alta, la mitad de lado en media; se redibujan a esta cadencia o cuando se mueve el Sol. */
const SHADOW_SIZE: Record<Tier, number> = { high: 2048, medium: 1024, low: 1024 };
const SHADOW_REFRESH_MS = 66;
const SHADOW_REFRESH_INTRO_MS = 33;
const SUN_SHADOW_EPS = 0.0015; // rad de cambio del Sol que obliga a redibujar sombras
const DENSITY: Record<Tier, { dust: number; stars: number }> = {
  high: { dust: 1, stars: 1 },
  medium: { dust: 0.5, stars: 1 },
  low: { dust: 0, stars: 0.5 },
};
/** Modo ahorro: tras esto sin interacción (y fuera de la presentación) se limita a ~30 fps. */
const SAVER_AFTER_MS = 6000;
const SAVER_FRAME_MS = 28;
/** El hover (rayo contra los módulos) se resuelve como mucho a esta cadencia. */
const HOVER_MS = 60;
/** Mirar al cielo: la Tierra queda a esta fracción del medio campo de visión sobre el centro (tercio superior). */
const SKY_EARTH_HEADROOM = 0.4;
const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export function createWorld(container: HTMLElement, cb: WorldCallbacks): World {
  // Con pantallas densas (DPR >= 1.5) el antialias de hardware sale muy caro y casi no se nota: se decide al crear.
  const deviceRatio = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ antialias: deviceRatio < 1.5, powerPreference: 'high-performance' });
  const ladder = QUALITY_STEPS.map((q) => ({ pixelRatio: Math.min(deviceRatio, q.pixelRatio), tier: q.tier })).filter(
    (q, i, all) => i === 0 || q.pixelRatio !== all[i - 1]!.pixelRatio || q.tier !== all[i - 1]!.tier,
  );
  let qualityStep = 0;
  renderer.setPixelRatio(ladder[0]!.pixelRatio);
  renderer.shadowMap.enabled = true;
  // Las sombras se redibujan solo cuando cambia el Sol o a baja cadencia (hay figuras que se mueven).
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (import.meta.env.DEV) Object.assign(window, { __renderer: renderer });
  container.appendChild(renderer.domElement);
  const dom = renderer.domElement;
  dom.style.touchAction = 'none';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  if (import.meta.env.DEV) Object.assign(window, { __scene: scene });
  const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 1400);
  const lookAt = CENTER_LOOK.clone();
  const lookGoal = CENTER_LOOK.clone();

  // Sol rasante del polo sur: sombras largas y duras. Sin niebla: en la Luna no hay aire.
  const sun = new THREE.DirectionalLight(0xfffaf2, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  // Relleno: brillo azul tenue de la Tierra arriba y regolito abajo (docs/ARTE.md §4).
  const fill = new THREE.HemisphereLight(0x1c2a40, 0x5a5751, 0.5);
  scene.add(fill);
  // Rebote del regolito: el suelo iluminado devuelve algo de luz al lado en sombra.
  // Sin sombras propias, desde el lado opuesto al Sol: los módulos se leen sin aplanar la escena.
  const bounce = new THREE.DirectionalLight(0xcfc8bb, 0);
  scene.add(bounce);
  // Brillo del horizonte durante una tormenta solar.
  const stormGlow = new THREE.HemisphereLight(STORM_TINT, 0x000000, 0);
  scene.add(stormGlow);

  const sky = createSky(scene);

  const terrain = createTerrain({
    heightmapUrl: TEXTURE_URLS.height,
    colorMapUrl: TEXTURE_URLS.color,
    metaUrl: TEXTURE_URLS.meta,
  });
  scene.add(terrain.mesh);
  void terrain.ready.then((kind) => cb.onAssets?.({ terrain: kind }));

  const base = createBase(terrain.heightAt);
  scene.add(base.group);
  // La tripulación camina por los pasillos de vidrio.
  const walkers = createCrewWalk(base.routes, CREW);
  scene.add(walkers.group);
  // Paneles solares, batería y flujo de energía; efectos de reparación.
  const energy = createEnergyFlow(terrain.heightAt);
  scene.add(energy.group);
  const repairFx = createRepairFx(terrain.heightAt);
  scene.add(repairFx.group);
  // Avería (baliza y humo; los astronautas cercanos miran) y tormenta solar (cielo, lluvia, domo, dosis).
  const alarmFx = createAlarmFx(terrain.heightAt, (id) => walkers.lookAt(id));
  scene.add(alarmFx.group);
  const stormFx = createStormFx(terrain.heightAt);
  stormFx.setCrewSource((i, out) => walkers.anchor(i, out), walkers.count);
  scene.add(stormFx.group);
  if (import.meta.env.DEV) Object.assign(window, { __energy: energy, __repairFx: repairFx, __alarm: alarmFx, __storm: stormFx });
  const dust = createDust(terrain.heightAt);
  scene.add(dust.points);
  void base.ready.then((models) => cb.onAssets?.({ models }));
  // Lista: todo colocado y los shaders compilados antes de quitar la pantalla de carga (si no,
  // cada modelo que aparece compila sus materiales en pleno juego y da tirones).
  // Mientras carga no se mide la calidad: los tirones de la carga la bajarían sin motivo.
  let loading = true;
  const ready: Promise<void> = Promise.all([terrain.ready.catch(() => null), base.ready.catch(() => [])])
    .then(() => renderer.compileAsync(scene, camera).catch(() => undefined))
    .then(() => {
      loading = false;
      shadowDirty = true;
      qualityWarmup = QUALITY.warmupSec;
    });

  // --- Estado que persigue a su objetivo (nada salta) ---
  let sunTarget = 1;
  let sunShown = 1;
  let azimuthTarget = 0;
  let azimuthShown = 0;
  let stormTarget = 0;
  let stormShown = 0;
  let shiftTarget = 0;
  let shiftShown = 0;
  let shiftXTarget = 0;
  let shiftXShown = 0;
  let reducedMotion = false;

  // --- Tripulación en fila (pantalla de inicio) ---
  const crew = new Map<string, Astronaut>();
  const crewGroup = new THREE.Group();
  scene.add(crewGroup);
  let crewHovered: string | null = null;
  let crewFocused: string | null = null;
  let introMode = false;
  let fly: {
    start: number;
    duration: number;
    fromEye: THREE.Vector3;
    fromTarget: THREE.Vector3;
    starts: Map<string, THREE.Vector3>;
    resolve: () => void;
  } | null = null;
  const flyEye = new THREE.Vector3();
  const flyTarget = new THREE.Vector3();
  const ease = (t: number): number => t * t * (3 - 2 * t);
  let introViewTarget = 1;
  let introView = 1;
  const lineupSpots = new Map<string, THREE.Vector3>();
  /** Momento en que empezó el desembarco (null: la tripulación sigue dentro de la nave). */
  let disembarkAt: number | null = null;
  const landerBase = new THREE.Vector3(LANDER_SPOT.x, 0, LANDER_SPOT.z);
  const landerDir = new THREE.Vector3();
  const hatchPos = new THREE.Vector3();
  const footPos = new THREE.Vector3();
  const rocket = createRocket();
  rocket.setVisible(0);
  scene.add(rocket.group);
  const heroEarth = new THREE.Vector3();
  const introEye = new THREE.Vector3();
  const introTarget = new THREE.Vector3();
  const orbitEye = new THREE.Vector3();
  // Vectores temporales: el bucle no crea objetos.
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpPos = new THREE.Vector3();
  const tmpMid = new THREE.Vector3();
  const tmpAhead = new THREE.Vector3();
  const tmpCentroid = new THREE.Vector3();
  const tmpProject = new THREE.Vector3();

  // --- Cámara en órbita ---
  let angle = 0.6;
  let elevation = ORBIT.elevation;
  let radius = ORBIT.radius;
  let radiusGoal = ORBIT.radius;
  let centered: ModuleId | null = null;
  let radiusBeforeCenter = ORBIT.radius;
  let lastInteraction = -Infinity;
  let width = 1;
  let height = 1;
  let portrait = false;
  let fovShown = -1; // -1: se fija en el primer fotograma
  let lastClick = { time: -Infinity, x: 0, y: 0 };
  const presentationFov = (): number => (portrait ? FOV.introPortrait : FOV.intro);
  const gameFov = (): number => (portrait ? FOV.gamePortrait : FOV.game);

  const orbitPosition = (out: THREE.Vector3): THREE.Vector3 => {
    const flat = Math.cos(elevation) * radius;
    return out.set(
      lookAt.x + Math.sin(angle) * flat,
      Math.sin(elevation) * radius + lookAt.y,
      lookAt.z + Math.cos(angle) * flat,
    );
  };
  const skyTarget = new THREE.Vector3();
  let skyLook: number | null = null; // elevación objetivo del botón "Mirar el cielo"
  let elevationBeforeSky = ORBIT.elevation;
  /** Ángulo de órbita al que gira la cámara (hacia la Tierra al ir al cielo; el anterior al volver). */
  let angleGoal: number | null = null;
  let angleBeforeSky = 0;
  let skyOn = false;
  let skyAmount = 0; // 0..1, amortiguado: mezcla la mirada al cielo y eleva la Tierra
  const placeCamera = (): void => {
    camera.position.copy(orbitPosition(orbitEye));
    // Cuanto más baja la cámara, más levanta la mirada: con la cámara a ras de suelo se ve el cielo.
    const lift = THREE.MathUtils.clamp((SKY_LOOK_START - elevation) / (SKY_LOOK_START - ORBIT.minElevation), 0, 1);
    const e = lift * lift * (3 - 2 * lift);
    let liftY = 70;
    if (skyAmount > 0.001) {
      // Mirar al cielo: la mirada sube lo justo para que la Tierra quede centrada y en el tercio superior.
      const flat = Math.hypot(camera.position.x - lookAt.x, camera.position.z - lookAt.z);
      const earthDist = Math.hypot(EARTH_SKY.x - camera.position.x, EARTH_SKY.z - camera.position.z);
      const earthElevation = Math.atan2(EARTH_SKY.y - camera.position.y, earthDist);
      const pitch = earthElevation - SKY_EARTH_HEADROOM * THREE.MathUtils.degToRad(gameFov() / 2);
      liftY = THREE.MathUtils.lerp(70, Math.tan(pitch) * flat + (camera.position.y - lookAt.y), skyAmount);
    }
    skyTarget.copy(lookAt).setY(lookAt.y + e * liftY);
    camera.lookAt(skyTarget);
  };
  /** Cámara baja de la presentación, con un travelling lateral muy lento. */
  const introPose = (time: number): void => {
    const travel = reducedMotion ? 0 : Math.sin(time * 0.09) * 3.2;
    introEye.copy(INTRO_EYE).setX(travel);
    introEye.y += terrain.heightAt(travel, INTRO_EYE.z);
    introTarget.copy(INTRO_TARGET).setX(travel * 0.35);
    const e = introView * introView * (3 - 2 * introView);
    if (introView < 0.999) {
      // Entre la portada y la fila: la cámara se aparta y baja con suavidad.
      const sway = reducedMotion ? 0 : Math.sin(time * 0.12) * 0.25;
      const titleEye = tmpA.copy(TITLE_EYE);
      titleEye.x += sway;
      titleEye.y += sway * 0.3 + terrain.heightAt(TITLE_EYE.x, TITLE_EYE.z);
      introEye.lerpVectors(titleEye, introEye, e);
      introTarget.lerpVectors(TITLE_TARGET, introTarget, e);
    }
    // Desembarco: en la portada la tripulación sigue dentro de la nave; al pulsar Comenzar sale
    // uno a uno, baja la escalerilla, camina hasta su sitio en la fila y se gira hacia la cámara.
    const D = DISEMBARK;
    const p =
      disembarkAt === null ? 0 : reducedMotion ? 1 : Math.min(1, (performance.now() - disembarkAt) / DISEMBARK_MS);
    const outward = Math.atan2(landerDir.x, landerDir.z);
    let i = 0;
    for (const [id, a] of crew) {
      const spot = lineupSpots.get(id);
      if (!spot) continue;
      // Sale primero quien va más lejos (la punta derecha de la fila): nadie se cruza.
      const order = crew.size - 1 - i++;
      const s = disembarkAt === null ? -1 : reducedMotion ? 1 : p - order * D.stagger;
      a.group.visible = s >= 0;
      if (s < 0) {
        a.setWalking(0);
        continue;
      }
      const climb = THREE.MathUtils.clamp(s / D.climb, 0, 1);
      const walk = THREE.MathUtils.clamp((s - D.climb) / D.walk, 0, 1);
      const turn = THREE.MathUtils.clamp((s - D.climb - D.walk) / D.turn, 0, 1);
      const pos = a.group.position;
      if (climb < 1) {
        pos.lerpVectors(hatchPos, footPos, ease(climb));
        a.group.rotation.y = outward;
        a.setWalking(0.8);
      } else if (walk < 1) {
        pos.lerpVectors(footPos, spot, ease(walk));
        pos.y = terrain.heightAt(pos.x, pos.z);
        a.group.rotation.y = Math.atan2(spot.x - footPos.x, spot.z - footPos.z);
        a.setWalking(1.6);
      } else {
        pos.copy(spot);
        a.group.rotation.y = Math.atan2(spot.x - footPos.x, spot.z - footPos.z) * (1 - ease(turn));
        a.setWalking(0);
      }
    }
    // La cámara empieza mirando a la nave y acompaña a la tripulación hasta encuadrar la fila.
    const follow = disembarkAt === null ? 0 : ease(THREE.MathUtils.clamp((p - 0.25) / 0.6, 0, 1));
    introTarget.lerp(DISEMBARK_LOOK, (1 - follow) * e);
    // Tierra de póster y cohete subiendo, solo en la portada.
    const forward = TITLE_FORWARD;
    const right = TITLE_RIGHT;
    heroEarth.copy(TITLE_EYE).addScaledVector(forward, 260).addScaledVector(right, 105);
    heroEarth.y += 55;
    sky.setHero(1 - e, heroEarth, 4.2);
    const loop = reducedMotion ? 0.45 : (time * 0.035) % 1;
    rocket.group.position.copy(TITLE_EYE).addScaledVector(forward, 150).addScaledVector(right, 18 + loop * 40);
    rocket.group.position.y += 6 + loop * 55;
    tmpB.copy(rocket.group.position).addScaledVector(right, 40);
    tmpB.y += 55;
    rocket.group.lookAt(tmpB);
    rocket.group.rotateX(Math.PI / 2);
    rocket.setVisible((1 - e) * Math.min(1, loop * 6, (1 - loop) * 6));
  };

  // --- Puntero: arrastrar gira, tocar selecciona ---
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered: ModuleId | null = null;
  let pointerDirty = false;
  let drag: { id: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null = null;

  const aim = (clientX: number, clientY: number): void => {
    const rect = dom.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  };
  const pickCrew = (clientX: number, clientY: number): string | null => {
    aim(clientX, clientY);
    // Solo quien ya ha salido de la nave se puede tocar.
    const pickables = [...crew.values()].filter((a) => a.group.visible).flatMap((a) => a.pickables);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (!hit) return null;
    for (const [id, a] of crew) if (a.pickables.includes(hit.object)) return id;
    return null;
  };
  const setCrewHovered = (id: string | null): void => {
    if (id === crewHovered) return;
    crewHovered = id;
    dom.style.cursor = id ? 'pointer' : 'default';
    cb.onCrewHover?.(id);
  };
  const pick = (clientX: number, clientY: number): ModuleId | null => {
    aim(clientX, clientY);
    const hit = raycaster.intersectObjects(base.pickables, false)[0];
    return (hit?.object.userData.moduleId as ModuleId | undefined) ?? null;
  };
  const setHovered = (id: ModuleId | null): void => {
    if (id === hovered) return;
    hovered = id;
    base.setHover(id);
    dom.style.cursor = id ? 'pointer' : 'grab';
    cb.onHover(id);
  };

  let lastPointer = { x: 0, y: 0 };
  let lastPickAt = 0;
  /** Última vez que pasó algo (puntero, rueda, panel...): sale del modo ahorro. Distinto de lastInteraction, que gobierna la órbita automática. */
  let lastActivity = performance.now();
  const onPointerDown = (e: PointerEvent): void => {
    lastActivity = performance.now();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
    dom.setPointerCapture(e.pointerId);
    lastInteraction = performance.now();
  };
  const onPointerMove = (e: PointerEvent): void => {
    lastPointer = { x: e.clientX, y: e.clientY };
    lastActivity = performance.now();
    if (drag && e.pointerId === drag.id) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > CLICK_SLOP_PX) drag.moved = true;
      if (drag.moved && !introMode) {
        angle -= (e.clientX - drag.x) * 0.006;
        elevation = THREE.MathUtils.clamp(elevation + (e.clientY - drag.y) * 0.004, ORBIT.minElevation, ORBIT.maxElevation);
        skyLook = null;
        angleGoal = null;
        skyOn = false;
        dom.style.cursor = 'grabbing';
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
      lastInteraction = performance.now();
    } else {
      pointerDirty = true; // el hover se resuelve una vez por frame
    }
  };
  const onPointerUp = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.id) return;
    const wasClick = !drag.moved;
    drag = null;
    if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
    dom.style.cursor = hovered ? 'pointer' : 'grab';
    if (wasClick && introMode) {
      const id = pickCrew(e.clientX, e.clientY);
      if (id) cb.onCrewSelect?.(id);
    } else if (wasClick) {
      const id = pick(e.clientX, e.clientY);
      const now = performance.now();
      const isDouble =
        now - lastClick.time < DOUBLE_CLICK_MS && Math.hypot(e.clientX - lastClick.x, e.clientY - lastClick.y) <= CLICK_SLOP_PX * 2;
      if (isDouble) {
        // Doble clic: centra el módulo (o vuelve al centro si se toca suelo vacío).
        lastClick = { time: -Infinity, x: 0, y: 0 };
        centerOn(id);
      } else {
        lastClick = { time: now, x: e.clientX, y: e.clientY };
        if (id) cb.onSelect(id);
      }
    }
  };
  const onPointerLeave = (): void => {
    setHovered(null);
    if (introMode) setCrewHovered(null);
  };
  const onWheel = (e: WheelEvent): void => {
    if (introMode) return;
    e.preventDefault();
    lastActivity = performance.now();
    radiusGoal = THREE.MathUtils.clamp(radiusGoal + e.deltaY * 0.045, ORBIT.minRadius, ORBIT.maxRadius);
    lastInteraction = performance.now();
  };
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointercancel', onPointerUp);
  dom.addEventListener('pointerleave', onPointerLeave);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.style.cursor = 'grab';

  /** Centra la cámara en un módulo (o en la base si id es null). Amortiguado; instantáneo con movimiento reducido. */
  function centerOn(id: ModuleId | null): void {
    if (id) {
      const m = MODULES.find((mod) => mod.id === id);
      if (!m) return;
      if (centered === null) radiusBeforeCenter = radiusGoal;
      centered = id;
      lookGoal.set(m.x, terrain.heightAt(m.x, m.z) + CENTER_LOOK.y, m.z);
      radiusGoal = THREE.MathUtils.clamp(radiusBeforeCenter * CENTER_ZOOM, ORBIT.minRadius, ORBIT.maxRadius);
    } else {
      centered = null;
      lookGoal.copy(CENTER_LOOK);
      radiusGoal = ORBIT.radius;
    }
    if (reducedMotion) {
      lookAt.copy(lookGoal);
      radius = radiusGoal;
    }
    lastInteraction = lastActivity = performance.now();
  }

  const applyViewOffset = (): void => {
    if (Math.abs(shiftShown) < 0.002 && Math.abs(shiftXShown) < 0.002) camera.clearViewOffset();
    else camera.setViewOffset(width, height, -Math.round(width * shiftXShown), Math.round(height * shiftShown), width, height);
  };

  const resize = new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = container;
    if (w === 0 || h === 0) return;
    width = w;
    height = h;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // En pantallas verticales se abre el campo de visión (se aplica cada fotograma, amortiguado).
    portrait = w / h < 0.8;
    applyViewOffset();
    camera.updateProjectionMatrix();
    qualityWarmup = QUALITY.warmupSec;
    shadowDirty = true;
  });
  resize.observe(container);

  // No gastar batería con la pestaña oculta ni con el lienzo fuera de pantalla.
  let running = true;
  let tabVisible = true;
  let canvasVisible = true;
  const syncRunning = (): void => {
    const next = tabVisible && canvasVisible;
    if (next && !running) {
      timer.reset();
      qualityWarmup = QUALITY.warmupSec;
      lastActivity = performance.now();
    }
    running = next;
  };
  const onVisibility = (): void => {
    tabVisible = !document.hidden;
    syncRunning();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const intersection =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          canvasVisible = entries[entries.length - 1]!.isIntersecting;
          syncRunning();
        })
      : null;
  intersection?.observe(container);

  // --- Calidad adaptativa: mide el tiempo de fotograma durante todo el juego (docs: DECISIONES.md) ---
  let shadowDirty = true;
  let shadowAt = -Infinity;
  let shadowAzimuth = NaN;
  let shadowElevation = NaN;
  const applyTier = (tier: Tier): void => {
    const shadows = tier !== 'low';
    renderer.shadowMap.enabled = shadows;
    sun.castShadow = shadows;
    const size = SHADOW_SIZE[tier];
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    // La transmisión del vidrio renderiza la escena una vez más: en media va a la mitad de resolución, en baja se quita.
    renderer.transmissionResolutionScale = tier === 'high' ? 1 : 0.5;
    base.setLowQuality(tier === 'low');
    energy.setTier(tier);
    alarmFx.setTier(tier);
    stormFx.setTier(tier);
    dust.setDensity(DENSITY[tier].dust);
    sky.setDetail(DENSITY[tier].stars);
    shadowDirty = true;
  };
  const applyStep = (step: number): void => {
    qualityStep = THREE.MathUtils.clamp(step, 0, ladder.length - 1);
    const q = ladder[qualityStep]!;
    if (renderer.getPixelRatio() !== q.pixelRatio) {
      renderer.setPixelRatio(q.pixelRatio);
      renderer.setSize(width, height);
    }
    applyTier(q.tier);
    if (import.meta.env.DEV) Object.assign(window, { __quality: { step: qualityStep, ...q } });
  };
  let qualityTime = 0;
  let qualityFrames = 0;
  let qualityWarmup = QUALITY.warmupSec;
  let goodTime = 0;
  let raiseAfter = QUALITY.raiseAfterSec;
  let lastRaiseAt = -Infinity;
  const measureQuality = (rawDt: number, now: number, saver: boolean): void => {
    if (!running || saver || loading) return;
    if (rawDt > QUALITY.stallSec) {
      qualityTime = qualityFrames = 0;
      return;
    }
    if (qualityWarmup > 0) {
      qualityWarmup -= rawDt;
      return;
    }
    qualityTime += rawDt;
    qualityFrames++;
    if (qualityTime < QUALITY.windowSec) return;
    const fps = qualityFrames / qualityTime;
    const spent = qualityTime;
    qualityTime = qualityFrames = 0;
    if (fps < QUALITY.dropFps && qualityStep < ladder.length - 1) {
      if (now - lastRaiseAt < QUALITY.regretSec * 1000) raiseAfter = Math.min(raiseAfter * 2, QUALITY.raiseAfterMaxSec);
      goodTime = 0;
      applyStep(qualityStep + (fps < QUALITY.panicFps ? 2 : 1));
      qualityWarmup = QUALITY.warmupSec;
    } else if (fps >= QUALITY.raiseFps && qualityStep > 0) {
      goodTime += spent;
      if (goodTime >= raiseAfter) {
        goodTime = 0;
        lastRaiseAt = now;
        applyStep(qualityStep - 1);
        qualityWarmup = QUALITY.warmupSec;
      }
    } else {
      goodTime = 0;
    }
  };
  applyStep(0);

  const timer = new THREE.Timer();
  let lastFrameAt = 0;
  renderer.setAnimationLoop(() => {
    if (!running) return;
    const now = performance.now();
    // Modo ahorro: en reposo (sin interacción, sin presentación ni vuelo) basta con ~30 fps; la cámara orbita muy despacio.
    const saver = !introMode && !fly && !drag && now - lastActivity > SAVER_AFTER_MS;
    if (saver && now - lastFrameAt < SAVER_FRAME_MS) return;
    lastFrameAt = now;
    if (import.meta.env.DEV) Object.assign(window, { __renderer: renderer, __scene: scene });
    timer.update();
    const rawDt = timer.getDelta();
    const dt = Math.min(rawDt, 0.1);
    const time = timer.getElapsed();

    if (fly) {
      const t = Math.min(1, (performance.now() - fly.start) / fly.duration);
      // 1) La tripulación camina en fila hasta la escotilla y entra.
      const centroid = tmpCentroid.set(0, 0, 0);
      let walking = 0;
      [...crew.entries()].forEach(([id, a], i) => {
        const from = fly!.starts.get(id)!;
        const local = THREE.MathUtils.clamp((t - 0.04 - i * 0.05) / (WALK_PART - 0.1), 0, 1);
        const turn = THREE.MathUtils.clamp((t - i * 0.03) / 0.1, 0, 1);
        // Dos tramos: hacia el centro de la fila y luego en fila india hasta la escotilla.
        const mid = tmpMid.set(from.x * 0.25, 0, (from.z + ENTRY.z) / 2 + 2);
        const k = ease(local);
        const pos = k < 0.5 ? tmpPos.copy(from).lerp(mid, k * 2) : tmpPos.copy(mid).lerp(ENTRY, (k - 0.5) * 2);
        pos.y = terrain.heightAt(pos.x, pos.z);
        const ahead = tmpAhead.copy(k < 0.5 ? mid : ENTRY).sub(pos);
        a.group.position.copy(pos);
        if (turn < 1) a.group.rotation.y = Math.PI * ease(turn);
        else if (ahead.lengthSq() > 0.01) a.group.rotation.y = Math.atan2(ahead.x, ahead.z);
        a.setWalking(local > 0 && local < 1 ? 1.4 : 0);
        // Al llegar a la escotilla se encoge rápido: ha entrado.
        a.group.scale.setScalar(1.05 * (local < 0.94 ? 1 : Math.max(0.001, (1 - local) / 0.06)));
        a.group.visible = local < 1;
        if (local < 1) {
          centroid.add(pos);
          walking++;
        }
      });
      if (walking > 0) centroid.divideScalar(walking);
      else centroid.copy(ENTRY);
      if (t < WALK_PART) {
        // La cámara se acerca detrás de ellos y los sigue con la mirada.
        const w = ease(t / WALK_PART);
        flyEye.copy(fly.fromEye).lerp(tmpA.set(centroid.x * 0.5, fly.fromEye.y + 1.2, ENTRY.z + 17), w);
        flyTarget.copy(fly.fromTarget).lerp(tmpB.set(centroid.x, 1.6, centroid.z - 2), w);
        camera.position.copy(flyEye);
        camera.lookAt(flyTarget);
      } else {
        // 2) La cámara sube y gira hasta la vista de la base.
        const w = ease((t - WALK_PART) / (1 - WALK_PART));
        orbitPosition(orbitEye);
        camera.position.lerpVectors(flyEye, orbitEye, w);
        camera.position.y += Math.sin(Math.PI * w) * 5;
        camera.lookAt(introTarget.lerpVectors(flyTarget, lookAt, w));
        // El campo de visión se cierra hacia el de juego a la vez que la cámara sube.
        fovShown = THREE.MathUtils.lerp(presentationFov(), gameFov(), w);
      }
      if (t >= 1) {
        const done = fly.resolve;
        fly = null;
        introMode = false;
        done();
      }
    } else if (introMode) {
      introView = reducedMotion ? introViewTarget : damp(introView, introViewTarget, 1.5, dt);
      introPose(time);
      camera.position.copy(introEye);
      camera.lookAt(introTarget);
    } else {
      if (angleGoal !== null && !drag) {
        // Gira por el camino más corto hasta el ángulo objetivo (la Tierra al mirar al cielo; el anterior al volver).
        const delta = wrapAngle(angleGoal - angle);
        angle = reducedMotion || Math.abs(delta) < 0.002 ? angleGoal : angle + delta * (1 - Math.exp(-2.2 * dt));
        if (angle === angleGoal && !skyOn) angleGoal = null;
      } else if (!reducedMotion && !drag && !skyOn && now - lastInteraction > RESUME_AFTER_MS) angle += AUTO_SPEED * dt;
      if (skyLook !== null && !drag) elevation = reducedMotion ? skyLook : damp(elevation, skyLook, 2.2, dt);
      // El punto de mira y el radio persiguen su objetivo (doble clic, rueda).
      if (reducedMotion) {
        lookAt.copy(lookGoal);
        radius = radiusGoal;
      } else {
        const k = 1 - Math.exp(-4 * dt);
        lookAt.lerp(lookGoal, k);
        radius += (radiusGoal - radius) * k;
      }
      placeCamera();
    }

    // Campo de visión: el de presentación en portada/fila/vuelo; el estrecho en juego (suave).
    const fovTarget = introMode || fly ? presentationFov() : gameFov();
    if (fovShown < 0 || reducedMotion) fovShown = fovTarget;
    else if (!fly) fovShown = damp(fovShown, fovTarget, 3, dt);
    if (Math.abs(camera.fov - fovShown) > 0.001) {
      camera.fov = fovShown;
      camera.updateProjectionMatrix();
    }

    sunShown = damp(sunShown, sunTarget, 1.6, dt);
    azimuthShown = damp(azimuthShown, azimuthTarget, 1.2, dt);
    stormShown = damp(stormShown, stormTarget, 2.5, dt);
    // Sol rasante, pero algo más alto que la realidad (≈5°–13°) para que el suelo se lea bien.
    const sunElevation = 0.09 + sunShown * 0.14;
    sun.position.set(Math.sin(azimuthShown) * 120, Math.sin(sunElevation) * 120, Math.cos(azimuthShown) * 120);
    sun.intensity = sunShown * 5.4;
    bounce.position.set(-Math.sin(azimuthShown) * 100, 40, -Math.cos(azimuthShown) * 100);
    bounce.intensity = sunShown * 0.7;
    // De noche queda el brillo de la Tierra: poco, pero la maqueta se sigue viendo.
    fill.intensity = 0.75 + sunShown * 0.65;
    // Tormenta: un resplandor violeta suave desde arriba y el cielo deja de ser negro puro.
    stormGlow.intensity = stormShown * (reducedMotion ? 0.14 : 0.12 + 0.05 * Math.sin(time * 2.2));
    sky.update(sunShown, stormShown);
    skyAmount = reducedMotion ? (skyOn ? 1 : 0) : damp(skyAmount, skyOn ? 1 : 0, 2.2, dt);
    sky.setLift(skyAmount);
    // De noche se sube la exposición para que la base ilumine su entorno.
    renderer.toneMappingExposure = 1.75 - sunShown * 0.45;

    const previousShift = shiftShown + shiftXShown;
    shiftShown = reducedMotion ? shiftTarget : damp(shiftShown, shiftTarget, 8, dt);
    shiftXShown = reducedMotion ? shiftXTarget : damp(shiftXShown, shiftXTarget, 8, dt);
    if (Math.abs(shiftShown + shiftXShown - previousShift) > 0.0005) {
      applyViewOffset();
      camera.updateProjectionMatrix();
    }

    if (pointerDirty && !drag && now - lastPickAt >= HOVER_MS) {
      pointerDirty = false;
      lastPickAt = now;
      if (introMode && introViewTarget === 1) setCrewHovered(pickCrew(lastPointer.x, lastPointer.y));
      else setHovered(pick(lastPointer.x, lastPointer.y));
    }
    // Destello del Sol en los visores: más fuerte con luz y cuando la cámara mira desde el lado del Sol.
    const camLen = Math.hypot(camera.position.x, camera.position.z) || 1;
    const sunSide =
      (camera.position.x / camLen) * Math.sin(azimuthShown) + (camera.position.z / camLen) * Math.cos(azimuthShown);
    const glint = sunShown * (0.55 + 0.45 * (sunSide * 0.5 + 0.5));
    walkers.setGlint(glint);
    for (const [id, a] of crew) {
      a.setFocus(!fly && (id === crewFocused || id === crewHovered));
      a.setGlint(glint);
      a.update(dt, time, reducedMotion);
    }
    dust.update(dt, time, sunShown, reducedMotion);

    base.update(dt, time, reducedMotion);
    // De noche: pasillos al 30 % y linternas de los cascos encendidas.
    const night = sunShown < 0.15;
    base.setCorridorLight((night ? 0.3 : 1) * (1 - 0.5 * stormFx.dim));
    walkers.setNight(night);
    walkers.group.visible = !introMode && !fly;
    if (walkers.group.visible) walkers.update(dt, time, reducedMotion);
    energy.setSun(sunShown, azimuthShown);
    energy.update(dt, time, reducedMotion);
    repairFx.update(dt, time, reducedMotion);
    alarmFx.update(dt, time, reducedMotion);
    stormFx.setSun(azimuthShown, sunElevation);
    stormFx.update(dt, time, reducedMotion);
    measureQuality(rawDt, now, saver);
    if (renderer.shadowMap.enabled) {
      // Sombras: se redibujan si el Sol se movió, tras cambios de calidad o de tamaño, y a baja cadencia
      // (las figuras de los pasillos y el rover se mueven). El resto del tiempo se reutiliza el mapa.
      const refresh = introMode || fly ? SHADOW_REFRESH_INTRO_MS : SHADOW_REFRESH_MS;
      const sunMoved = Math.abs(azimuthShown - shadowAzimuth) + Math.abs(sunElevation - shadowElevation) > SUN_SHADOW_EPS;
      if (shadowDirty || sunMoved || now - shadowAt >= refresh) {
        renderer.shadowMap.needsUpdate = true;
        shadowDirty = false;
        shadowAt = now;
        if (sunMoved) {
          shadowAzimuth = azimuthShown;
          shadowElevation = sunElevation;
        }
      }
    }
    renderer.render(scene, camera);
  });

  return {
    setSunlight: (light) => void (sunTarget = THREE.MathUtils.clamp(light, 0, 1)),
    setSunAzimuth: (azimuth) => void (azimuthTarget = azimuth),
    setModule: (id, state) => {
      base.setModule(id, state);
      alarmFx.setBroken(id, state.broken);
    },
    setSelected: (id) => base.setSelected(id),
    setLabels: (names) => base.setLabels(names),
    setShelter: (active) => base.setShelter(active),
    setRoverAway: (away) => base.setRoverAway(away),
    setStorm: (active) => void (stormTarget = active ? 1 : 0),
    setViewShift: (up, right = 0) => {
      lastActivity = performance.now();
      shiftTarget = THREE.MathUtils.clamp(up, 0, 0.5);
      shiftXTarget = THREE.MathUtils.clamp(right, -0.5, 0.5);
    },
    centerOn,
    setLabelsVisible: (visible) => base.setLabelsVisible(visible),
    setCrewState: (state) => walkers.setState(state),
    projectModule(id) {
      const m = MODULES.find((mod) => mod.id === id);
      if (!m) return null;
      const v = tmpProject.set(m.x, terrain.heightAt(m.x, m.z) + 5, m.z).project(camera);
      if (v.z > 1) return null;
      const rect = dom.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    },
    setSkyLook(on) {
      if (on === skyOn) return;
      if (on) {
        if (!skyOn) {
          elevationBeforeSky = Math.max(elevation, SKY_LOOK_START);
          angleBeforeSky = angle;
        }
        skyLook = ORBIT.minElevation;
        // La cámara se pone al otro lado de la Tierra respecto al punto de mira, mirándola de frente.
        angleGoal = Math.atan2(lookGoal.x - EARTH_SKY.x, lookGoal.z - EARTH_SKY.z);
      } else {
        skyLook = elevationBeforeSky;
        angleGoal = angleBeforeSky;
      }
      skyOn = on;
      lastInteraction = lastActivity = performance.now();
    },
    setReducedMotion: (reduced) => void (reducedMotion = reduced),
    showCrew(members) {
      for (const a of crew.values()) {
        crewGroup.remove(a.group);
        a.dispose();
      }
      crew.clear();
      lineupSpots.clear();
      disembarkAt = null;
      // Escotilla y pie de la escalerilla, en el lado de la nave que mira a la fila.
      landerDir.set(-landerBase.x, 0, LINEUP_Z - landerBase.z).normalize();
      const ground = terrain.heightAt(landerBase.x, landerBase.z);
      hatchPos.copy(landerBase).addScaledVector(landerDir, HATCH.out).setY(ground + HATCH.up);
      footPos.copy(landerBase).addScaledVector(landerDir, HATCH.foot);
      footPos.y = terrain.heightAt(footPos.x, footPos.z);
      members.forEach((m, i) => {
        const a = createAstronaut(m.color, i * 1.7);
        const x = (i - (members.length - 1) / 2) * LINEUP_SPACING;
        a.group.position.set(x, terrain.heightAt(x, LINEUP_Z), LINEUP_Z);
        a.group.visible = false; // dentro de la nave hasta el desembarco
        lineupSpots.set(m.id, a.group.position.clone());
        a.group.scale.setScalar(1.05);
        crewGroup.add(a.group);
        crew.set(m.id, a);
      });
      lastActivity = performance.now();
      introMode = members.length > 0;
      if (introMode) fovShown = -1; // la presentación entra directa con su campo de visión
      dom.style.cursor = introMode ? 'default' : 'grab';
      // La fila mira a la cámara: el Sol de la presentación los ilumina de frente y de lado.
      if (introMode) azimuthTarget = azimuthShown = 0.55;
    },
    setIntroView(view) {
      introViewTarget = view === 'title' ? 0 : 1;
      if (reducedMotion) introView = introViewTarget;
      // Comenzar: la tripulación desembarca. Volver a la portada: vuelve a estar dentro de la nave.
      if (view === 'crew' && disembarkAt === null) disembarkAt = performance.now();
      if (view === 'title') disembarkAt = null;
      lastActivity = performance.now();
    },
    setCrewFocus: (id) => void (crewFocused = id),
    playEnergy: (plan, night) => energy.play(plan, night),
    setBattery: (fraction) => energy.setBattery(fraction),
    playRepair: (id) => repairFx.play(id, reducedMotion),
    setFxLabels: (labels) => repairFx.setLabels(labels),
    setStormFx: (level, options) => stormFx.setStorm(level, options),
    burstStorm: () => stormFx.burst(),
    showDose: (text) => stormFx.showDose(text),
    ready,
    flyIn(durationMs) {
      if (!introMode) return Promise.resolve();
      if (reducedMotion || durationMs <= 0 || !running) {
        introMode = false;
        return Promise.resolve();
      }
      crewFocused = null;
      crewHovered = null;
      sky.setHero(0, heroEarth, 1);
      rocket.setVisible(0);
      return new Promise<void>((resolve) => {
        fly = {
          start: performance.now(),
          duration: durationMs,
          fromEye: camera.position.clone(),
          fromTarget: introTarget.clone(),
          starts: new Map([...crew.entries()].map(([id, a]) => [id, a.group.position.clone()])),
          resolve,
        };
        flyEye.copy(camera.position);
        flyTarget.copy(introTarget);
      });
    },
    dispose() {
      for (const a of crew.values()) a.dispose();
      rocket.dispose();
      dust.dispose();
      renderer.setAnimationLoop(null);
      resize.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      intersection?.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointercancel', onPointerUp);
      dom.removeEventListener('pointerleave', onPointerLeave);
      dom.removeEventListener('wheel', onWheel);
      walkers.dispose();
      energy.dispose();
      repairFx.dispose();
      alarmFx.dispose();
      stormFx.dispose();
      sky.dispose();
      terrain.dispose();
      base.dispose();
      renderer.dispose();
      dom.remove();
    },
  };
}
