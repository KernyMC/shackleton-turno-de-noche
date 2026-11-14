// Cielo lunar: negro, sin atmósfera. La Tierra baja en el horizonte y estrellas que solo se ven
// cuando cae la luz (la cámara está expuesta para el suelo iluminado). docs/ARTE.md §2.

import * as THREE from 'three';

export interface Sky {
  /** `sun` = luz del día 0..1; `storm` = intensidad de la tormenta 0..1. */
  update(sun: number, storm: number): void;
  /**
   * Portada: lleva la Tierra a `position` con tamaño `scale` (0 = posición normal, 1 = póster).
   */
  setHero(amount: number, position: THREE.Vector3, scale: number): void;
  /** Mirar al cielo: 0 = la Tierra en su sitio bajo, 1 = elevada para verse sobre el borde del cráter. */
  setLift(amount: number): void;
  /** Fracción de estrellas que se dibujan (1 = todas). Para calidad baja. */
  setDetail(fraction: number): void;
  dispose(): void;
}

/** PRNG pequeño con semilla fija: el cielo es igual en cada partida. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Textura real de la Tierra (NASA Blue Marble: Next Generation, ver scripts/earth-texture.mjs). */
const EARTH_TEXTURE_URL = '/textures/earth_bluemarble.webp';

/** Respaldo dibujado a mano: océano, continentes difusos y nubes. No es un mapa real. */
function earthTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seeded(7);
  ctx.fillStyle = '#1d4f8f';
  ctx.fillRect(0, 0, size * 2, size);
  const blobs = (count: number, color: string, min: number, max: number): void => {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      ctx.ellipse(rand() * size * 2, size * (0.15 + rand() * 0.7), min + rand() * (max - min), (min + rand() * (max - min)) * 0.6, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  blobs(26, 'rgba(74, 122, 78, 0.9)', 10, 42);
  blobs(18, 'rgba(150, 132, 92, 0.6)', 6, 22);
  ctx.fillStyle = '#e9eef2';
  ctx.fillRect(0, 0, size * 2, size * 0.07);
  ctx.fillRect(0, size * 0.93, size * 2, size * 0.07);
  blobs(60, 'rgba(255, 255, 255, 0.42)', 8, 36);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Posición de la Tierra cuando se mira al cielo: ~22° sobre el horizonte desde la cámara, por encima del borde del cráter. */
export const EARTH_SKY = new THREE.Vector3(-190, 201, -330);

export function createSky(scene: THREE.Scene): Sky {
  const group = new THREE.Group();
  scene.add(group);

  // La Tierra: siempre en el mismo punto del cielo, baja sobre el horizonte.
  // Textura real: Blue Marble: Next Generation (NASA Earth Observatory). Mientras carga, o sin
  // red y sin el archivo, se usa la dibujada a mano.
  let earthMap: THREE.Texture = earthTexture();
  // Iluminación propia: el Sol ilumina la Tierra de lado (fase gibosa vista desde la Luna), con
  // la cara nocturna casi negra y un borde de atmósfera azul. No depende de las luces de la escena.
  const earthUniforms = {
    map: { value: earthMap },
    lightDir: { value: new THREE.Vector3(1, 0.25, 0.35).normalize() },
  };
  const earthMat = new THREE.ShaderMaterial({
    uniforms: earthUniforms,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewW = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 lightDir;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      void main() {
        vec3 n = normalize(vNormalW);
        vec3 albedo = texture2D(map, vUv).rgb;
        float d = dot(n, lightDir);
        float day = smoothstep(-0.12, 0.3, d);
        vec3 lit = albedo * (0.08 + 1.35 * max(d, 0.0));
        // Brillo del Sol sobre el mar: un reflejo pequeño donde el agua es oscura y azul.
        float water = smoothstep(0.12, 0.0, albedo.r - albedo.b * 0.5);
        vec3 h = normalize(lightDir + vViewW);
        lit += vec3(1.0, 0.95, 0.85) * pow(max(dot(n, h), 0.0), 40.0) * 0.35 * water * day;
        vec3 night = albedo * 0.02 + vec3(0.004, 0.008, 0.02);
        vec3 col = mix(night, lit, day);
        // Atmósfera: borde azul, más visible en la cara iluminada.
        float rim = pow(1.0 - max(dot(n, vViewW), 0.0), 2.6);
        col += vec3(0.32, 0.55, 1.0) * rim * (0.15 + 0.85 * day) * 0.9;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(16, 64, 32), earthMat);
  const EARTH_HOME = new THREE.Vector3(-190, 62, -330);
  const homeNow = EARTH_HOME.clone();
  const heroPos = new THREE.Vector3();
  let heroE = 0;
  let heroScale = 1;
  let lift = 0;
  const place = (): void => {
    earth.position.lerpVectors(homeNow, heroPos, heroE);
    earth.scale.setScalar(1 + (heroScale - 1) * heroE);
    earth.rotation.y = 1.1 + heroE * 0.9;
  };
  earth.position.copy(EARTH_HOME);
  earth.rotation.set(0.4, 1.1, 0.25);
  group.add(earth);
  new THREE.TextureLoader().load(
    EARTH_TEXTURE_URL,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      earthMap.dispose();
      earthMap = texture;
      earthUniforms.map.value = texture;
    },
    undefined,
    () => {
      /* sin la textura real se queda la dibujada */
    },
  );
  // Halo de atmósfera: un velo azul muy fino alrededor del disco.
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x6fb4ff, transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(16.9, 48, 24), haloMat);
  earth.add(halo);

  // Estrellas: dos capas (muchas pequeñas, pocas grandes) y una banda densa de Vía Láctea.
  const rand = seeded(42);
  const palette = [new THREE.Color(0xffffff), new THREE.Color(0xcfe0ff), new THREE.Color(0xfff0d8), new THREE.Color(0xffd9b0)];
  const bandNormal = new THREE.Vector3(0.35, 0.8, 0.48).normalize();
  const starLayer = (count: number, size: number, band: boolean): { points: THREE.Points; geo: THREE.BufferGeometry; mat: THREE.PointsMaterial } => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      if (band) {
        // Aplasta el punto hacia el plano de la banda: casi todos quedan cerca de ese círculo.
        const off = v.dot(bandNormal);
        v.addScaledVector(bandNormal, -off * (1 - Math.pow(rand(), 3) * 0.35)).normalize();
      }
      if (v.y < -0.05) v.y = -v.y; // solo el cielo visible
      v.multiplyScalar(620);
      positions.set([v.x, v.y + 10, v.z], i * 3);
      const c = palette[Math.floor(rand() * palette.length)]!.clone().multiplyScalar(0.55 + rand() * 0.45);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const points = new THREE.Points(geo, mat);
    group.add(points);
    return { points, geo, mat };
  };
  const layers = [starLayer(2600, 1.3, false), starLayer(260, 2.6, false), starLayer(3200, 1.1, true)];
  const layerStrength = [1, 1, 0.7];

  const background = new THREE.Color(0x000000);
  const stormColor = new THREE.Color(0x1a0f2e);
  scene.background = background;

  return {
    setHero(amount, position, scale) {
      heroE = amount * amount * (3 - 2 * amount);
      heroPos.copy(position);
      heroScale = scale;
      place();
    },
    setLift(amount) {
      if (Math.abs(amount - lift) < 0.0005) return;
      lift = amount;
      homeNow.lerpVectors(EARTH_HOME, EARTH_SKY, lift * lift * (3 - 2 * lift));
      place();
    },
    setDetail(fraction) {
      for (const layer of layers) layer.geo.setDrawRange(0, Math.floor(layer.geo.attributes.position!.count * fraction));
    },
    update(sun, storm) {
      // De noche se ven todas; de día quedan tenues (la cámara está expuesta para el suelo).
      const night = Math.max(0, 1 - sun * 3.2);
      layers.forEach((layer, i) => {
        layer.mat.opacity = (0.22 + 0.78 * night) * layerStrength[i]!;
      });
      // Tormenta solar: el cielo deja de ser negro puro. Sin tapar la base.
      background.setRGB(0, 0, 0).lerp(stormColor, storm);
    },
    dispose() {
      scene.remove(group);
      earth.geometry.dispose();
      halo.geometry.dispose();
      haloMat.dispose();
      earthMat.dispose();
      earthMap.dispose();
      layers.forEach((layer) => {
        layer.geo.dispose();
        layer.mat.dispose();
      });
    },
  };
}
