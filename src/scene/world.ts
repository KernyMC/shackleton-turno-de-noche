// Mundo 3D en primera persona (prototipo). Three.js puro, sin Preact.
// Solo REFLEJA el estado y avisa de interacciones; nunca calcula reglas del juego.
// Spec: docs/specs/02-primera-persona.md. Tareas: docs/tasks/B-mundo-3d.md.

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import type { ModuleId } from '../sim/types';

export interface WorldCallbacks {
  /** Módulo al alcance del jugador (o null). */
  onNearModule(id: ModuleId | null): void;
  /** El jugador pulsó E frente a un módulo. */
  onInteract(id: ModuleId): void;
  onLockChange(locked: boolean): void;
}

export interface World {
  lock(): void;
  unlock(): void;
  /** Luz solar del día, de 0 a 1. */
  setSunlight(light: number): void;
  dispose(): void;
}

const MODULES: { id: ModuleId; x: number; z: number; color: number }[] = [
  { id: 'recycler', x: -9, z: -8, color: 0x4fc3f7 },
  { id: 'greenhouse', x: 9, z: -8, color: 0x81c784 },
  { id: 'shield', x: -9, z: 8, color: 0xffb74d },
  { id: 'workshop', x: 9, z: 8, color: 0xe0e0e0 },
];
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

  // Regolito: plano con relieve por senos (B-01 lo cambia por ruido o un mapa de elevación real).
  const groundGeo = new THREE.PlaneGeometry(200, 200, 96, 96);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const far = Math.max(0, Math.hypot(x, z) - 30); // zona de la base plana; borde de cráter lejos
    pos.setY(i, Math.sin(x * 0.4) * Math.cos(z * 0.3) * 0.15 + far * far * 0.01);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  const moduleGeo = new THREE.CylinderGeometry(3, 3, 3.2, 24);
  const domeGeo = new THREE.SphereGeometry(3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const m of MODULES) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd8d4cc,
      emissive: m.color,
      emissiveIntensity: 0.25,
      roughness: 0.7,
    });
    const body = new THREE.Mesh(moduleGeo, mat);
    body.position.set(m.x, 1.6, m.z);
    body.castShadow = true;
    const dome = new THREE.Mesh(domeGeo, mat);
    dome.position.set(m.x, 3.2, m.z);
    dome.castShadow = true;
    const lamp = new THREE.PointLight(m.color, 6, 14);
    lamp.position.set(m.x, 4.5, m.z);
    scene.add(body, dome, lamp);
  }

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
      camera.position.y = EYE_HEIGHT;
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
