// Astronauta low-poly amable: cuerpo de cápsulas, casco con visor reflectante y mochila.
// Hecho con geometrías de Three.js (sin modelos externos). Animación idle sutil: respira y
// mueve la cabeza. Con foco, da un paso al frente y se ilumina con su color.

import * as THREE from 'three';

const SUIT = 0xe9e6de;
const DARK = 0x2a2b2e;

export interface Astronaut {
  group: THREE.Group;
  /** Mallas que responden al puntero. */
  pickables: THREE.Object3D[];
  setFocus(focused: boolean): void;
  update(dt: number, time: number, reducedMotion: boolean): void;
  dispose(): void;
}

const damp = (current: number, target: number, k: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-k * dt));

export function createAstronaut(color: number, phase = 0): Astronaut {
  const group = new THREE.Group();
  const body = new THREE.Group(); // lo que respira
  const head = new THREE.Group(); // lo que gira
  group.add(body);

  const suit = new THREE.MeshStandardMaterial({ color: SUIT, roughness: 0.75 });
  const accent = new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.6 });
  // Visor dorado-oscuro y muy liso: refleja el Sol rasante.
  const visor = new THREE.MeshStandardMaterial({ color: 0x1b1a17, roughness: 0.06, metalness: 1, emissive: 0x3a2a10, emissiveIntensity: 0.25 });
  const materials = [suit, accent, dark, visor];
  const geometries: THREE.BufferGeometry[] = [];
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh => {
    geometries.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  // Piernas y botas.
  for (const side of [-1, 1]) {
    mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 10), suit, body, side * 0.18, 0.5, 0);
    mesh(new THREE.BoxGeometry(0.28, 0.16, 0.4), dark, body, side * 0.18, 0.08, 0.05);
  }
  // Torso, cinturón de color y panel del pecho.
  mesh(new THREE.CapsuleGeometry(0.38, 0.42, 6, 14), suit, body, 0, 1.16, 0);
  mesh(new THREE.TorusGeometry(0.39, 0.06, 6, 20), accent, body, 0, 0.92, 0).rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.34, 0.24, 0.08), accent, body, 0, 1.24, 0.36);
  mesh(new THREE.BoxGeometry(0.14, 0.06, 0.05), dark, body, 0, 1.24, 0.41);
  // Brazos con hombreras de color y guantes.
  for (const side of [-1, 1]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.13, 0.46, 4, 10), suit, body, side * 0.5, 1.12, 0);
    arm.rotation.z = side * 0.18;
    mesh(new THREE.SphereGeometry(0.16, 12, 8), accent, body, side * 0.47, 1.42, 0);
    mesh(new THREE.SphereGeometry(0.12, 10, 8), dark, body, side * 0.56, 0.8, 0.02);
  }
  // Mochila de soporte vital con franja de color.
  mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), suit, body, 0, 1.22, -0.4);
  mesh(new THREE.BoxGeometry(0.62, 0.08, 0.32), accent, body, 0, 1.4, -0.4);
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 8), dark, body, 0.2, 1.68, -0.42);

  // Cabeza: casco, visor y aro del cuello.
  head.position.set(0, 1.78, 0);
  body.add(head);
  mesh(new THREE.SphereGeometry(0.34, 22, 16), suit, head);
  const shield = mesh(new THREE.SphereGeometry(0.3, 22, 16, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.22, Math.PI * 0.5), visor, head, 0, 0, 0.06);
  shield.scale.set(1, 1, 1.05);
  mesh(new THREE.TorusGeometry(0.27, 0.06, 6, 20), accent, head, 0, -0.28, 0).rotation.x = Math.PI / 2;
  // Linterna del casco (se usará de noche).
  mesh(new THREE.BoxGeometry(0.1, 0.07, 0.1), dark, head, 0.26, 0.12, 0.18);

  // Luz de foco: ilumina al astronauta seleccionado con su color.
  const glow = new THREE.PointLight(color, 0, 5, 1.8);
  glow.position.set(0, 2.6, 0.8);
  group.add(glow);

  const pickables: THREE.Object3D[] = [];
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) pickables.push(o);
  });

  let focusTarget = 0;
  let focus = 0;
  return {
    group,
    pickables,
    setFocus(focused) {
      focusTarget = focused ? 1 : 0;
    },
    update(dt, time, reducedMotion) {
      focus = damp(focus, focusTarget, 9, dt);
      body.position.z = focus * 0.9; // un paso al frente
      glow.intensity = focus * 9;
      accent.emissiveIntensity = 0.15 + focus * 0.7;
      if (reducedMotion) {
        body.scale.y = 1;
        head.rotation.y = 0;
        return;
      }
      body.scale.y = 1 + 0.012 * Math.sin(time * 1.9 + phase); // respira
      head.rotation.y = 0.28 * Math.sin(time * 0.45 + phase * 1.7) + focus * 0.0;
      head.rotation.x = 0.06 * Math.sin(time * 0.31 + phase);
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
