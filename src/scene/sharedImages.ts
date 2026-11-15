// Imágenes compartidas entre GLB: los modelos de la base repiten las mismas texturas
// (71 imágenes, solo 17 distintas). Sin esto cada archivo decodifica y sube a la GPU su copia
// (~98 MB de VRAM en vez de ~22 MB). Se identifica cada imagen por el hash de sus bytes y se
// decodifica una vez; cada textura es un clon que comparte la misma `source`, así three.js
// la sube una sola vez por renderer. Los clones conservan su propio sampler y transformación.
import type * as THREE from 'three';
import type { GLTFLoaderPlugin, GLTFParser } from 'three/addons/loaders/GLTFLoader.js';

const decoded = new Map<string, Promise<THREE.Texture>>();

/** FNV-1a de 32 bits sobre los bytes, más la longitud: suficiente para distinguir imágenes. */
function hashBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i]!, 0x01000193);
  return `${bytes.length}:${(h >>> 0).toString(36)}`;
}

type ImageSourceLoader = (sourceIndex: number, loader: unknown) => Promise<THREE.Texture>;

/** Plugin de GLTFLoader: `loader.register(sharedImages)`. */
export function sharedImages(parser: GLTFParser): GLTFLoaderPlugin {
  const p = parser as GLTFParser & { loadImageSource: ImageSourceLoader };
  const original = p.loadImageSource.bind(p);
  p.loadImageSource = (sourceIndex, loader) => {
    const def = (parser.json as { images?: { bufferView?: number }[] }).images?.[sourceIndex];
    if (def?.bufferView === undefined) return original(sourceIndex, loader);
    return parser.getDependency('bufferView', def.bufferView).then((buffer: ArrayBuffer) => {
      const key = hashBytes(buffer);
      let pending = decoded.get(key);
      if (!pending) {
        pending = original(sourceIndex, loader);
        decoded.set(key, pending);
        pending.catch(() => decoded.delete(key));
      }
      return pending.then((texture) => texture.clone());
    });
  };
  return { name: 'halo_shared_images' };
}
