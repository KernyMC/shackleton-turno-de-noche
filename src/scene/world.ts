// Mundo 3D: una maqueta viva de la base lunar que se mira y se toca. Three.js puro, sin Preact.
// La cámara orbita sola; se puede arrastrar para girar y usar la rueda para acercar.
// Tocar un módulo avisa a la interfaz. Solo REFLEJA el estado; nunca calcula reglas del juego.
// Spec: docs/specs/02-primera-persona.md (sección "Maqueta"). Arte: docs/ARTE.md.

import * as THREE from 'three';
import type { ModuleId } from '../sim/types';
import { createAstronaut } from './astronaut';
import type { Astronaut } from './astronaut';
import { createBase } from './base';
import { createRocket } from './rocket';
import { createSky } from './sky';
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
   * altura) y `right` hacia la derecha (0..0.5 del ancho).
   */
  setViewShift(up: number, right?: number): void;
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
  /** Ilumina y adelanta a un astronauta de la fila (o a ninguno). */
  setCrewFocus(id: string | null): void;
  /**
   * Secuencia de entrada: la tripulación se da la vuelta, camina en fila hasta la escotilla del
   * refugio y entra; la cámara la sigue y después sube a la vista de la base.
   * Instantánea con movimiento reducido o con la pestaña oculta.
   */
  flyIn(durationMs: number): Promise<void>;
  dispose(): void;
}

const ORBIT = { radius: 62, minRadius: 34, maxRadius: 90, elevation: 0.42, minElevation: 0.03, maxElevation: 1.1 };
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
/** Posiciones en diagonal de la tripulación en la portada (de la más cercana a la más lejana). */
const TITLE_SPOTS = [
  new THREE.Vector3(-4.9, 0, 21.6),
  new THREE.Vector3(-3.7, 0, 23.3),
  new THREE.Vector3(-2.3, 0, 25.0),
  new THREE.Vector3(-0.7, 0, 26.7),
];
/** Parte de la secuencia (0..1) en la que la tripulación camina; el resto es el vuelo de cámara. */
const WALK_PART = 0.62;

const damp = (current: number, target: number, k: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-k * dt));

export function createWorld(container: HTMLElement, cb: WorldCallbacks): World {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const dom = renderer.domElement;
  dom.style.touchAction = 'none';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 1400);
  const lookAt = new THREE.Vector3(0, 2, 0);

  // Sol rasante del polo sur: sombras largas y duras. Sin niebla: en la Luna no hay aire.
  const sun = new THREE.DirectionalLight(0xfffaf2, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  const fill = new THREE.HemisphereLight(0x101826, 0x3b3a38, 0.5);
  scene.add(fill);
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
  void base.ready.then((models) => cb.onAssets?.({ models }));

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
  const titleSpots = new Map<string, THREE.Vector3>();
  const rocket = createRocket();
  rocket.setVisible(0);
  scene.add(rocket.group);
  const heroEarth = new THREE.Vector3();
  const introEye = new THREE.Vector3();
  const introTarget = new THREE.Vector3();
  const orbitEye = new THREE.Vector3();

  // --- Cámara en órbita ---
  let angle = 0.6;
  let elevation = ORBIT.elevation;
  let radius = ORBIT.radius;
  let lastInteraction = -Infinity;
  let width = 1;
  let height = 1;

  const orbitPosition = (out: THREE.Vector3): THREE.Vector3 => {
    const flat = Math.cos(elevation) * radius;
    return out.set(Math.sin(angle) * flat, Math.sin(elevation) * radius + lookAt.y, Math.cos(angle) * flat);
  };
  const skyTarget = new THREE.Vector3();
  let skyLook: number | null = null; // elevación objetivo del botón "Mirar el cielo"
  let elevationBeforeSky = ORBIT.elevation;
  const placeCamera = (): void => {
    camera.position.copy(orbitPosition(orbitEye));
    // Cuanto más baja la cámara, más levanta la mirada: con la cámara a ras de suelo se ve el cielo.
    const lift = THREE.MathUtils.clamp((SKY_LOOK_START - elevation) / (SKY_LOOK_START - ORBIT.minElevation), 0, 1);
    const e = lift * lift * (3 - 2 * lift);
    skyTarget.copy(lookAt).setY(lookAt.y + e * 70);
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
      const titleEye = TITLE_EYE.clone().add(new THREE.Vector3(sway, sway * 0.3, 0));
      titleEye.y += terrain.heightAt(TITLE_EYE.x, TITLE_EYE.z);
      introEye.lerpVectors(titleEye, introEye, e);
      introTarget.lerpVectors(TITLE_TARGET, introTarget, e);
    }
    // La tripulación pasa de la diagonal de la portada a la fila, mirando a cámara.
    for (const [id, a] of crew) {
      const from = titleSpots.get(id);
      const to = lineupSpots.get(id);
      if (!from || !to) continue;
      a.group.position.lerpVectors(from, to, e);
      a.group.position.y = terrain.heightAt(a.group.position.x, a.group.position.z);
      const faceTitle = Math.atan2(TITLE_EYE.x - from.x, TITLE_EYE.z - from.z) * 0.8;
      a.group.rotation.y = faceTitle * (1 - e);
    }
    // Tierra de póster y cohete subiendo, solo en la portada.
    const forward = TITLE_TARGET.clone().sub(TITLE_EYE).normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    heroEarth.copy(TITLE_EYE).addScaledVector(forward, 260).addScaledVector(right, 105).add(new THREE.Vector3(0, 55, 0));
    sky.setHero(1 - e, heroEarth, 4.2);
    const loop = reducedMotion ? 0.45 : (time * 0.035) % 1;
    rocket.group.position.copy(TITLE_EYE).addScaledVector(forward, 150).addScaledVector(right, 18 + loop * 40).add(new THREE.Vector3(0, 6 + loop * 55, 0));
    rocket.group.lookAt(rocket.group.position.clone().addScaledVector(right, 40).add(new THREE.Vector3(0, 55, 0)));
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
    const pickables = [...crew.values()].flatMap((a) => a.pickables);
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
  const onPointerDown = (e: PointerEvent): void => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
    dom.setPointerCapture(e.pointerId);
    lastInteraction = performance.now();
  };
  const onPointerMove = (e: PointerEvent): void => {
    lastPointer = { x: e.clientX, y: e.clientY };
    if (drag && e.pointerId === drag.id) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > CLICK_SLOP_PX) drag.moved = true;
      if (drag.moved && !introMode) {
        angle -= (e.clientX - drag.x) * 0.006;
        elevation = THREE.MathUtils.clamp(elevation + (e.clientY - drag.y) * 0.004, ORBIT.minElevation, ORBIT.maxElevation);
        skyLook = null;
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
      if (id) cb.onSelect(id);
    }
  };
  const onPointerLeave = (): void => {
    setHovered(null);
    if (introMode) setCrewHovered(null);
  };
  const onWheel = (e: WheelEvent): void => {
    if (introMode) return;
    e.preventDefault();
    radius = THREE.MathUtils.clamp(radius + e.deltaY * 0.03, ORBIT.minRadius, ORBIT.maxRadius);
    lastInteraction = performance.now();
  };
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointercancel', onPointerUp);
  dom.addEventListener('pointerleave', onPointerLeave);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.style.cursor = 'grab';

  const applyViewOffset = (): void => {
    if (shiftShown < 0.002 && shiftXShown < 0.002) camera.clearViewOffset();
    else camera.setViewOffset(width, height, -Math.round(width * shiftXShown), Math.round(height * shiftShown), width, height);
  };

  const resize = new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = container;
    if (w === 0 || h === 0) return;
    width = w;
    height = h;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // En pantallas verticales se abre el campo de visión para que quepa toda la base.
    camera.fov = w / h < 0.8 ? 62 : 46;
    applyViewOffset();
    camera.updateProjectionMatrix();
  });
  resize.observe(container);

  // No gastar batería con la pestaña oculta.
  let running = true;
  const onVisibility = (): void => {
    running = !document.hidden;
    if (running) timer.reset();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const timer = new THREE.Timer();
  renderer.setAnimationLoop(() => {
    if (!running) return;
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    const time = timer.getElapsed();

    if (fly) {
      const t = Math.min(1, (performance.now() - fly.start) / fly.duration);
      // 1) La tripulación camina en fila hasta la escotilla y entra.
      const centroid = new THREE.Vector3();
      let walking = 0;
      [...crew.entries()].forEach(([id, a], i) => {
        const from = fly!.starts.get(id)!;
        const local = THREE.MathUtils.clamp((t - 0.04 - i * 0.05) / (WALK_PART - 0.1), 0, 1);
        const turn = THREE.MathUtils.clamp((t - i * 0.03) / 0.1, 0, 1);
        // Dos tramos: hacia el centro de la fila y luego en fila india hasta la escotilla.
        const mid = new THREE.Vector3(from.x * 0.25, 0, (from.z + ENTRY.z) / 2 + 2);
        const k = ease(local);
        const pos = k < 0.5 ? from.clone().lerp(mid, k * 2) : mid.clone().lerp(ENTRY, (k - 0.5) * 2);
        pos.y = terrain.heightAt(pos.x, pos.z);
        const ahead = (k < 0.5 ? mid : ENTRY).clone().sub(pos);
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
        flyEye.copy(fly.fromEye).lerp(new THREE.Vector3(centroid.x * 0.5, fly.fromEye.y + 1.2, ENTRY.z + 17), w);
        flyTarget.copy(fly.fromTarget).lerp(new THREE.Vector3(centroid.x, 1.6, centroid.z - 2), w);
        camera.position.copy(flyEye);
        camera.lookAt(flyTarget);
      } else {
        // 2) La cámara sube y gira hasta la vista de la base.
        const w = ease((t - WALK_PART) / (1 - WALK_PART));
        orbitPosition(orbitEye);
        camera.position.lerpVectors(flyEye, orbitEye, w);
        camera.position.y += Math.sin(Math.PI * w) * 5;
        camera.lookAt(introTarget.lerpVectors(flyTarget, lookAt, w));
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
      if (!reducedMotion && !drag && performance.now() - lastInteraction > RESUME_AFTER_MS) angle += AUTO_SPEED * dt;
      if (skyLook !== null && !drag) elevation = reducedMotion ? skyLook : damp(elevation, skyLook, 2.2, dt);
      placeCamera();
    }

    sunShown = damp(sunShown, sunTarget, 1.6, dt);
    azimuthShown = damp(azimuthShown, azimuthTarget, 1.2, dt);
    stormShown = damp(stormShown, stormTarget, 2.5, dt);
    const sunElevation = 0.05 + sunShown * 0.11; // 3°–9° sobre el horizonte
    sun.position.set(Math.sin(azimuthShown) * 120, Math.sin(sunElevation) * 120, Math.cos(azimuthShown) * 120);
    sun.intensity = sunShown * 4.4;
    fill.intensity = 0.35 + sunShown * 0.55;
    // Tormenta: un resplandor violeta suave desde arriba y el cielo deja de ser negro puro.
    stormGlow.intensity = stormShown * (reducedMotion ? 0.14 : 0.12 + 0.05 * Math.sin(time * 2.2));
    sky.update(sunShown, stormShown);
    // De noche se sube la exposición para que la base ilumine su entorno.
    renderer.toneMappingExposure = 1.55 - sunShown * 0.5;

    const previousShift = shiftShown + shiftXShown;
    shiftShown = damp(shiftShown, shiftTarget, 8, dt);
    shiftXShown = damp(shiftXShown, shiftXTarget, 8, dt);
    if (Math.abs(shiftShown + shiftXShown - previousShift) > 0.0005) {
      applyViewOffset();
      camera.updateProjectionMatrix();
    }

    if (pointerDirty && !drag) {
      pointerDirty = false;
      if (introMode && introViewTarget === 1) setCrewHovered(pickCrew(lastPointer.x, lastPointer.y));
      else setHovered(pick(lastPointer.x, lastPointer.y));
    }
    for (const [id, a] of crew) {
      a.setFocus(!fly && (id === crewFocused || id === crewHovered));
      a.update(dt, time, reducedMotion);
    }

    base.update(dt, time, reducedMotion);
    renderer.render(scene, camera);
  });

  return {
    setSunlight: (light) => void (sunTarget = THREE.MathUtils.clamp(light, 0, 1)),
    setSunAzimuth: (azimuth) => void (azimuthTarget = azimuth),
    setModule: (id, state) => base.setModule(id, state),
    setSelected: (id) => base.setSelected(id),
    setLabels: (names) => base.setLabels(names),
    setShelter: (active) => base.setShelter(active),
    setRoverAway: (away) => base.setRoverAway(away),
    setStorm: (active) => void (stormTarget = active ? 1 : 0),
    setViewShift: (up, right = 0) => {
      shiftTarget = THREE.MathUtils.clamp(up, 0, 0.5);
      shiftXTarget = THREE.MathUtils.clamp(right, 0, 0.5);
    },
    setLabelsVisible: (visible) => base.setLabelsVisible(visible),
    setSkyLook(on) {
      if (on) {
        elevationBeforeSky = Math.max(elevation, SKY_LOOK_START);
        skyLook = ORBIT.minElevation;
      } else {
        skyLook = elevationBeforeSky;
      }
      lastInteraction = performance.now();
    },
    setReducedMotion: (reduced) => void (reducedMotion = reduced),
    showCrew(members) {
      for (const a of crew.values()) {
        crewGroup.remove(a.group);
        a.dispose();
      }
      crew.clear();
      lineupSpots.clear();
      titleSpots.clear();
      members.forEach((m, i) => {
        const a = createAstronaut(m.color, i * 1.7);
        const x = (i - (members.length - 1) / 2) * LINEUP_SPACING;
        a.group.position.set(x, terrain.heightAt(x, LINEUP_Z), LINEUP_Z);
        lineupSpots.set(m.id, a.group.position.clone());
        titleSpots.set(m.id, (TITLE_SPOTS[i] ?? TITLE_SPOTS[0]!).clone());
        a.group.scale.setScalar(1.05);
        crewGroup.add(a.group);
        crew.set(m.id, a);
      });
      introMode = members.length > 0;
      dom.style.cursor = introMode ? 'default' : 'grab';
      // La fila mira a la cámara: el Sol de la presentación los ilumina de frente y de lado.
      if (introMode) azimuthTarget = azimuthShown = 0.55;
    },
    setIntroView(view) {
      introViewTarget = view === 'title' ? 0 : 1;
      if (reducedMotion) introView = introViewTarget;
    },
    setCrewFocus: (id) => void (crewFocused = id),
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
      renderer.setAnimationLoop(null);
      resize.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointercancel', onPointerUp);
      dom.removeEventListener('pointerleave', onPointerLeave);
      dom.removeEventListener('wheel', onWheel);
      sky.dispose();
      terrain.dispose();
      base.dispose();
      renderer.dispose();
      dom.remove();
    },
  };
}
