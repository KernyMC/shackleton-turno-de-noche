// Accesorios de rol de la tripulación (pocas mallas, geometrías y materiales compartidos):
//   - Valeria: panelito de control con luz cian que parpadea suave (fijo, junto a su módulo);
//   - Mateo: jardinera con plantas y tomates (fija);
//   - Amaru: dosímetro con dial ámbar y aguja (va en su mano);
//   - Lucía: caja de herramientas naranja (va en su mano al caminar; la deja a su lado al trabajar).
// Sin luces dinámicas, sin sombras (van dentro del vidrio). Los colores de la tripulación salen de ARTE.md.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface CrewProps {
  /** Cuelga de aquí en la escena: lleva los accesorios fijos y el que está en el suelo. */
  group: THREE.Group;
  /** Accesorios fijos: la crewWalk les pone posición y giro una sola vez. */
  panel: THREE.Object3D;
  plants: THREE.Object3D;
  /** El dosímetro queda siempre en esta mano. */
  holdDosimeter(hand: THREE.Object3D): void;
  /** La caja en la mano (a tamaño de astronauta) o en el suelo (a tamaño de mundo). */
  holdToolbox(hand: THREE.Object3D): void;
  dropToolbox(x: number, y: number, z: number, yaw: number): void;
  update(time: number, reducedMotion: boolean): void;
  dispose(): void;
}

const CYAN = 0x4fd1e0;
const AMBER = 0xffb347;
const ORANGE = 0xff7a3d;

type V3 = [number, number, number];
const _o = new THREE.Object3D();
function place<G extends THREE.BufferGeometry>(geo: G, p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]): G {
  _o.position.set(...p);
  _o.rotation.set(...r);
  _o.scale.set(...s);
  _o.updateMatrix();
  geo.applyMatrix4(_o.matrix);
  return geo;
}
const merge = (list: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const flat = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    if (n !== g) g.dispose();
    // Solo posición, normal y uv: cualquier otro atributo impediría fusionar.
    for (const name of Object.keys(n.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') n.deleteAttribute(name);
    return n;
  });
  const merged = mergeGeometries(flat, false);
  flat.forEach((g) => g.dispose());
  return merged;
};
const rbox = (w: number, h: number, d: number, r: number): THREE.BufferGeometry => new RoundedBoxGeometry(w, h, d, 2, r);

export function createCrewProps(scale: number): CrewProps {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const geo = <G extends THREE.BufferGeometry>(g: G): G => (geos.push(g), g);
  const mat = (m: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const x = new THREE.MeshStandardMaterial(m);
    mats.push(x);
    return x;
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D): THREE.Mesh => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = false;
    o.receiveShadow = false;
    parent.add(o);
    return o;
  };

  const darkMat = mat({ color: 0x33353a, roughness: 0.6, metalness: 0.3 });
  const screenMat = mat({ color: 0x0b2a30, emissive: CYAN, emissiveIntensity: 0.6, roughness: 0.4 });
  const lampMat = mat({ color: 0x0b2a30, emissive: CYAN, emissiveIntensity: 1.2 });
  const soilMat = mat({ color: 0x5a3f2c, roughness: 0.95 });
  const leafMat = mat({ color: 0x5fb552, roughness: 0.75 });
  const fruitMat = mat({ color: 0xe0523f, roughness: 0.5 });
  const amberMat = mat({ color: 0x3a2610, emissive: AMBER, emissiveIntensity: 1.1, roughness: 0.5 });
  const orangeMat = mat({ color: ORANGE, roughness: 0.55, metalness: 0.1 });

  // ---- Valeria: panel de control sobre un poste (+z mira hacia la tripulante) ----
  const panel = new THREE.Group();
  panel.scale.setScalar(1.3);
  const panelBody = geo(
    merge([
      place(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 8), [0, 0.25, 0]),
      place(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 12), [0, 0.02, 0]),
      place(rbox(0.5, 0.34, 0.08, 0.02), [0, 0.64, 0], [-0.35, 0, 0]),
    ]),
  );
  mesh(panelBody, darkMat, panel);
  const screenGeo = geo(place(new THREE.PlaneGeometry(0.42, 0.26), [0, 0.0, 0.042]));
  const screenHolder = new THREE.Group();
  screenHolder.position.set(0, 0.64, 0);
  screenHolder.rotation.x = -0.35;
  panel.add(screenHolder);
  mesh(screenGeo, screenMat, screenHolder);
  const lampGeo = geo(new THREE.SphereGeometry(0.03, 8, 6));
  const lamp = mesh(lampGeo, lampMat, screenHolder);
  lamp.position.set(0.2, 0.18, 0.05);
  group.add(panel);

  // ---- Mateo: jardinera con plantas y tomates ----
  const plants = new THREE.Group();
  const planterGeo = geo(
    merge([
      place(rbox(0.8, 0.16, 0.42, 0.04), [0, 0.08, 0]),
      place(new THREE.BoxGeometry(0.72, 0.02, 0.34), [0, 0.165, 0]),
    ]),
  );
  mesh(planterGeo, soilMat, plants);
  const leafParts: THREE.BufferGeometry[] = [];
  const fruitParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const x = -0.3 + i * 0.15;
    const z = i % 2 === 0 ? -0.05 : 0.07;
    const h = 0.26 + (i % 3) * 0.07;
    leafParts.push(place(new THREE.CylinderGeometry(0.012, 0.016, h, 5), [x, 0.17 + h / 2, z]));
    leafParts.push(place(new THREE.SphereGeometry(0.1, 8, 6), [x, 0.17 + h, z], [0, 0, 0], [1, 0.7, 1]));
    leafParts.push(place(new THREE.SphereGeometry(0.07, 8, 6), [x + 0.06, 0.17 + h * 0.6, z + 0.03], [0, 0, 0], [1, 0.6, 1]));
    if (i % 2 === 1) fruitParts.push(place(new THREE.SphereGeometry(0.035, 8, 6), [x - 0.05, 0.17 + h * 0.75, z + 0.07]));
  }
  const leaves = mesh(geo(merge(leafParts)), leafMat, plants);
  mesh(geo(merge(fruitParts)), fruitMat, plants);
  group.add(plants);

  // ---- Amaru: dosímetro en la mano (tamaño de astronauta: lo escala el propio astronauta) ----
  const dosimeter = new THREE.Group();
  mesh(geo(place(rbox(0.26, 0.34, 0.08, 0.025))), darkMat, dosimeter);
  const dial = mesh(geo(place(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 14), [0, 0.04, 0.045], [Math.PI / 2, 0, 0])), amberMat, dosimeter);
  const needlePivot = new THREE.Group();
  needlePivot.position.set(0, 0.04, 0.056);
  dosimeter.add(needlePivot);
  mesh(geo(place(new THREE.BoxGeometry(0.014, 0.065, 0.006), [0, 0.032, 0])), darkMat, needlePivot);
  void dial;
  dosimeter.rotation.x = -1.35;
  dosimeter.position.set(0, 0.04, 0.05);

  // ---- Lucía: caja de herramientas (cuelga de su mano; asa arriba) ----
  const toolbox = new THREE.Group();
  const boxBody = geo(
    merge([
      place(rbox(0.5, 0.26, 0.24, 0.04), [0, -0.2, 0]),
    ]),
  );
  mesh(boxBody, orangeMat, toolbox);
  const handleGeo = geo(
    merge([
      place(new THREE.TorusGeometry(0.1, 0.018, 5, 10, Math.PI), [0, -0.07, 0]),
      place(new THREE.BoxGeometry(0.52, 0.03, 0.26), [0, -0.205, 0]),
      place(new THREE.BoxGeometry(0.06, 0.06, 0.012), [0, -0.2, 0.125]),
    ]),
  );
  mesh(handleGeo, darkMat, toolbox);

  const holdToolbox = (hand: THREE.Object3D): void => {
    group.remove(toolbox);
    hand.add(toolbox);
    toolbox.scale.setScalar(1);
    toolbox.position.set(0, 0.02, 0);
    toolbox.rotation.set(0.35, 0, 0);
  };
  group.add(toolbox);
  toolbox.scale.setScalar(scale);

  return {
    group,
    panel,
    plants,
    holdDosimeter(hand) {
      hand.add(dosimeter);
    },
    holdToolbox,
    dropToolbox(x, y, z, yaw) {
      toolbox.parent?.remove(toolbox);
      group.add(toolbox);
      toolbox.scale.setScalar(scale);
      // El asa queda hacia arriba; la caja apoya en el suelo (su base está 0,33 por debajo del origen).
      toolbox.position.set(x, y + 0.33 * scale, z);
      toolbox.rotation.set(0, yaw, 0);
    },
    update(time, reducedMotion) {
      if (reducedMotion) {
        screenMat.emissiveIntensity = 0.7;
        lampMat.emissiveIntensity = 1.6;
        needlePivot.rotation.z = 0.3;
        leaves.rotation.set(0, 0, 0);
        return;
      }
      // Latido suave de la pantalla y parpadeo redondeado de la luz (sin cortes bruscos).
      screenMat.emissiveIntensity = 0.6 + 0.12 * Math.sin(time * 2.1);
      const blink = Math.sin(time * 2.6) * 0.5 + 0.5;
      lampMat.emissiveIntensity = 0.3 + 1.6 * blink * blink;
      needlePivot.rotation.z = Math.sin(time * 1.7) * 0.6 + Math.sin(time * 4.3) * 0.08;
      leaves.rotation.z = Math.sin(time * 0.9) * 0.025;
      leaves.rotation.x = Math.sin(time * 0.7 + 1) * 0.02;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
