// Cohete de la portada: sube por el cielo con su estela. Decorativo y original (blanco hueso con
// franjas oscuras, como el resto de la base). Solo se usa en la presentación.

import * as THREE from 'three';

export interface Rocket {
  group: THREE.Group;
  setVisible(amount: number): void;
  dispose(): void;
}

export function createRocket(): Rocket {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, x = 0, z = 0): THREE.Mesh => {
    geos.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  const white = new THREE.MeshStandardMaterial({ color: 0xece8df, roughness: 0.55, emissive: 0x332a20, emissiveIntensity: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.5 });
  mats.push(white, dark);

  // Cuerpo central por etapas, cono, franjas y propulsores laterales.
  add(new THREE.CylinderGeometry(0.6, 0.6, 5.2, 20), white, 0);
  add(new THREE.CylinderGeometry(0.62, 0.62, 0.35, 20), dark, 1.2);
  add(new THREE.CylinderGeometry(0.62, 0.62, 0.35, 20), dark, -1.0);
  add(new THREE.CylinderGeometry(0.45, 0.6, 1.0, 20), white, 3.1);
  add(new THREE.ConeGeometry(0.45, 1.4, 20), white, 4.3);
  add(new THREE.CylinderGeometry(0.47, 0.47, 0.3, 20), dark, 3.6);
  for (const side of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.32, 0.32, 3.4, 14), white, -0.9, side * 0.86);
    add(new THREE.ConeGeometry(0.32, 0.8, 14), white, 1.2, side * 0.86);
    add(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 14), dark, -0.3, side * 0.86);
  }
  add(new THREE.CylinderGeometry(0.42, 0.62, 0.6, 16), dark, -2.9);

  // Llama y estela: brillan solas (aditivas), más anchas y tenues hacia atrás.
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xffb36b, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  mats.push(flameMat, trailMat, haloMat);
  add(new THREE.ConeGeometry(0.55, 2.4, 16, 1, true), flameMat, -4.4).rotation.x = Math.PI;
  add(new THREE.ConeGeometry(1.6, 34, 20, 1, true), trailMat, -21).rotation.x = Math.PI;
  add(new THREE.ConeGeometry(3.2, 46, 20, 1, true), haloMat, -26).rotation.x = Math.PI;

  return {
    group,
    setVisible(amount) {
      group.visible = amount > 0.01;
      flameMat.opacity = 0.95 * amount;
      trailMat.opacity = 0.35 * amount;
      haloMat.opacity = 0.18 * amount;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
