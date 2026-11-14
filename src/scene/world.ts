// Mundo 3D en primera persona (prototipo). Three.js puro, sin Preact.
// Solo REFLEJA el estado y avisa de interacciones; nunca calcula reglas del juego.
// Spec: docs/specs/02-primera-persona.md. Tareas: docs/tasks/B-mundo-3d.md.

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import type { ModuleId } from '../sim/types';
import { createBase, MODULES } from './base';
import type { ModelId } from './base';
import { createTerrain, TEXTURE_URLS } from './terrain';

export interface WorldCallbacks {
  /** Módulo al alcance del jugador (o null). */
  onNearModule(id: ModuleId | null): void;
  /** El jugador pulsó E frente a un módulo. */
  onInteract(id: ModuleId): void;
  onLockChange(locked: boolean): void;
  /** Qué recursos reales se cargaron (terreno CGI Moon Kit, modelos GLB). */
  onAssets?(assets: { terrain?: 'real' | 'procedural'; models?: ModelId[] }): void;
}

export interface World {
  lock(): void;
  unlock(): void;
  /** Luz solar del día, de 0 a 1. */
  setSunlight(light: number): void;
  dispose(): void;
}

const EYE_HEIGHT = 1.7;
const WALK_SPEED = 6;
const REACH = 4.5;
const BOUNDS = 40;

export function createWorld(container: HTMLElement, cb: WorldCallbacks): World {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
  camera.position.set(0, EYE_HEIGHT, 16);

  // Sol rasante del polo sur: sombras largas.
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.5);
  sun.position.set(-60, 9, -30);
  sun.castShadow = true;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  scene.add(sun);
  const ambient = new THREE.AmbientLight(0x8899aa, 0.12);
  scene.add(ambient);

  // Terreno: real (CGI Moon Kit) si las texturas existen, si no procedural. Ver terrain.ts.
  const terrain = createTerrain({
    heightmapUrl: TEXTURE_URLS.height,
    colorMapUrl: TEXTURE_URLS.color,
    metaUrl: TEXTURE_URLS.meta,
  });
  scene.add(terrain.mesh);
  void terrain.ready.then((kind) => cb.onAssets?.({ terrain: kind }));

  // Base: módulos, lander y rover (GLB de NASA 3D Resources si existen). Ver base.ts.
  const base = createBase(terrain.heightAt);
  scene.add(base.group);
  void base.ready.then((models) => cb.onAssets?.({ models }));

  const controls = new PointerLockControls(camera, renderer.domElement);
  const keys = new Set<string>();
  let near: ModuleId | null = null;

  const onKeyDown = (e: KeyboardEvent): void => {
    keys.add(e.code);
    if (e.code === 'KeyE' && controls.isLocked && near) cb.onInteract(near);
  };
  const onKeyUp = (e: KeyboardEvent): void => void keys.delete(e.code);
  const onLock = (): void => cb.onLockChange(true);
  const onUnlock = (): void => {
    keys.clear();
    cb.onLockChange(false);
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  controls.addEventListener('lock', onLock);
  controls.addEventListener('unlock', onUnlock);

  const resize = new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = container;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  resize.observe(container);

  const timer = new THREE.Timer();
  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    if (controls.isLocked) {
      const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const prevX = camera.position.x;
      const prevZ = camera.position.z;
      controls.moveForward(forward * WALK_SPEED * dt);
      controls.moveRight(right * WALK_SPEED * dt);
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -BOUNDS, BOUNDS);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -BOUNDS, BOUNDS);
      // Colisión simple: no atravesar los módulos (B-01 la mejora).
      for (const m of MODULES) {
        if (Math.hypot(camera.position.x - m.x, camera.position.z - m.z) < 3.6) {
          camera.position.x = prevX;
          camera.position.z = prevZ;
        }
      }
      camera.position.y = terrain.heightAt(camera.position.x, camera.position.z) + EYE_HEIGHT;
    }
    let closest: ModuleId | null = null;
    let best = REACH + 3;
    for (const m of MODULES) {
      const d = Math.hypot(camera.position.x - m.x, camera.position.z - m.z);
      if (d < best) {
        best = d;
        closest = m.id;
      }
    }
    if (closest !== near) {
      near = closest;
      cb.onNearModule(near);
    }
    renderer.render(scene, camera);
  });

  return {
    lock: () => controls.lock(),
    unlock: () => controls.unlock(),
    setSunlight(light) {
      sun.intensity = 2.5 * light;
      ambient.intensity = 0.04 + 0.08 * light;
    },
    dispose() {
      renderer.setAnimationLoop(null);
      resize.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      controls.removeEventListener('lock', onLock);
      controls.removeEventListener('unlock', onUnlock);
      controls.dispose();
      terrain.dispose();
      base.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((mat) => mat.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
