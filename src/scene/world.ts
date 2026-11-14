// Mundo 3D: una maqueta viva de la base lunar que se mira y se toca. Three.js puro, sin Preact.
// La cámara orbita sola; se puede arrastrar para girar y usar la rueda para acercar.
// Tocar un módulo avisa a la interfaz. Solo REFLEJA el estado; nunca calcula reglas del juego.
// Spec: docs/specs/02-primera-persona.md (sección "Maqueta"). Arte: docs/ARTE.md.

import * as THREE from 'three';
import type { ModuleId } from '../sim/types';
import { createBase } from './base';
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
}

export interface World {
  /** Luz solar del día, de 0 a 1. */
  setSunlight(light: number): void;
  /** Posición del Sol en el horizonte (radianes); avanza con los días. */
  setSunAzimuth(azimuth: number): void;
  setModule(id: ModuleId, state: ModuleVisualState): void;
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
  /** Muestra u oculta los rótulos de los módulos. */
  setLabelsVisible(visible: boolean): void;
  setReducedMotion(reduced: boolean): void;
  dispose(): void;
}

const ORBIT = { radius: 62, minRadius: 34, maxRadius: 90, elevation: 0.42, minElevation: 0.16, maxElevation: 1.1 };
const AUTO_SPEED = 0.045; // rad/s
const RESUME_AFTER_MS = 5000;
const CLICK_SLOP_PX = 6;
const STORM_TINT = 0xb48cff;

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

  // --- Cámara en órbita ---
  let angle = 0.6;
  let elevation = ORBIT.elevation;
  let radius = ORBIT.radius;
  let lastInteraction = -Infinity;
  let width = 1;
  let height = 1;

  const placeCamera = (): void => {
    const flat = Math.cos(elevation) * radius;
    camera.position.set(Math.sin(angle) * flat, Math.sin(elevation) * radius + lookAt.y, Math.cos(angle) * flat);
    camera.lookAt(lookAt);
  };

  // --- Puntero: arrastrar gira, tocar selecciona ---
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered: ModuleId | null = null;
  let pointerDirty = false;
  let drag: { id: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null = null;

  const pick = (clientX: number, clientY: number): ModuleId | null => {
    const rect = dom.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
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
      if (drag.moved) {
        angle -= (e.clientX - drag.x) * 0.006;
        elevation = THREE.MathUtils.clamp(elevation + (e.clientY - drag.y) * 0.004, ORBIT.minElevation, ORBIT.maxElevation);
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
    if (wasClick) {
      const id = pick(e.clientX, e.clientY);
      if (id) cb.onSelect(id);
    }
  };
  const onPointerLeave = (): void => setHovered(null);
  const onWheel = (e: WheelEvent): void => {
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

    if (!reducedMotion && !drag && performance.now() - lastInteraction > RESUME_AFTER_MS) angle += AUTO_SPEED * dt;
    placeCamera();

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
      setHovered(pick(lastPointer.x, lastPointer.y));
    }

    base.update(dt, time, reducedMotion);
    renderer.render(scene, camera);
  });

  return {
    setSunlight: (light) => void (sunTarget = THREE.MathUtils.clamp(light, 0, 1)),
    setSunAzimuth: (azimuth) => void (azimuthTarget = azimuth),
    setModule: (id, state) => base.setModule(id, state),
    setLabels: (names) => base.setLabels(names),
    setShelter: (active) => base.setShelter(active),
    setRoverAway: (away) => base.setRoverAway(away),
    setStorm: (active) => void (stormTarget = active ? 1 : 0),
    setViewShift: (up, right = 0) => {
      shiftTarget = THREE.MathUtils.clamp(up, 0, 0.5);
      shiftXTarget = THREE.MathUtils.clamp(right, 0, 0.5);
    },
    setLabelsVisible: (visible) => base.setLabelsVisible(visible),
    setReducedMotion: (reduced) => void (reducedMotion = reduced),
    dispose() {
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
