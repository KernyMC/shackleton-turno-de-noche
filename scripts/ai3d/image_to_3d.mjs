// Genera una malla 3D cruda a partir de un texto, usando tu ComfyUI local (gratis, sin nube).
//   npm run models:ai3d -- "descripción del objeto" salida-cruda.glb
// Pasos: Z-Image Turbo hace una imagen de referencia (objeto aislado, fondo blanco) y
// Hunyuan3D 2.1 la convierte en malla. Luego reduce la malla con `npm run models:reduce`.
// Necesita ComfyUI abierto y estos modelos (ver scripts/README-ia3d.md):
//   diffusion_models/z_image_turbo_bf16.safetensors · text_encoders/qwen_3_4b.safetensors
//   vae/ae.safetensors · checkpoints/hunyuan_3d_v2.1.safetensors
// URL de ComfyUI: variable COMFYUI_URL (Comfy Desktop usa :8000, el resto :8188).

import { writeFileSync } from 'node:fs';

try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env se usa el valor por defecto.
}
const base = (process.env.COMFYUI_URL || 'http://127.0.0.1:8188').replace(/\/$/, '');
const [description, out = 'objeto-crudo.glb'] = process.argv.slice(2);
if (!description) {
  console.error('Uso: npm run models:ai3d -- "descripción del objeto" salida-cruda.glb');
  process.exit(1);
}

const api = async (path, init) => {
  const res = await fetch(base + path, init);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res;
};

// Espera a que ComfyUI termine el trabajo y devuelve sus salidas. La malla puede tardar varios minutos.
const run = async (prompt) => {
  const { prompt_id: id } = await (await api('/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })).json();
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    const history = (await (await api(`/history/${id}`)).json())[id];
    if (!history) continue;
    if (history.status.status_str !== 'success') throw new Error(`ComfyUI falló: ${JSON.stringify(history.status.messages.at(-1))}`);
    return history.outputs;
  }
};
const download = async (file) => Buffer.from(await (await api(`/view?filename=${encodeURIComponent(file.filename)}&subfolder=${encodeURIComponent(file.subfolder)}&type=${file.type}`)).arrayBuffer());

try {
  await api('/system_stats');
} catch {
  console.error(`No encuentro ComfyUI en ${base}. Ábrelo o pon COMFYUI_URL en .env`);
  process.exit(1);
}

console.log('1/2 Imagen de referencia con Z-Image Turbo…');
const imageOut = await run({
  1: { class_type: 'UNETLoader', inputs: { unet_name: 'z_image_turbo_bf16.safetensors', weight_dtype: 'default' } },
  2: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b.safetensors', type: 'lumina2', device: 'default' } },
  3: { class_type: 'VAELoader', inputs: { vae_name: 'ae.safetensors' } },
  4: { class_type: 'CLIPTextEncode', inputs: { text: `${description}, isolated object, centered, plain pure white background, soft even studio lighting, three-quarter view`, clip: ['2', 0] } },
  5: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
  6: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['1', 0], shift: 3 } },
  7: { class_type: 'EmptySD3LatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
  8: { class_type: 'KSampler', inputs: { model: ['6', 0], positive: ['4', 0], negative: ['5', 0], latent_image: ['7', 0], seed: Math.floor(Math.random() * 1e9), steps: 8, cfg: 1, sampler_name: 'res_multistep', scheduler: 'simple', denoise: 1 } },
  9: { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
  10: { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: 'ai3d_ref' } },
});
const png = await download(imageOut[10].images[0]);
const form = new FormData();
form.append('image', new Blob([png], { type: 'image/png' }), 'ai3d_ref.png');
form.append('overwrite', 'true');
await api('/upload/image', { method: 'POST', body: form });
writeFileSync(out.replace(/\.glb$/i, '-referencia.png'), png);

console.log('2/2 Malla con Hunyuan3D 2.1 (tarda varios minutos)…');
const meshOut = await run({
  1: { class_type: 'ImageOnlyCheckpointLoader', inputs: { ckpt_name: 'hunyuan_3d_v2.1.safetensors' } },
  2: { class_type: 'LoadImage', inputs: { image: 'ai3d_ref.png' } },
  3: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['1', 0], shift: 1 } },
  4: { class_type: 'CLIPVisionEncode', inputs: { clip_vision: ['1', 1], image: ['2', 0], crop: 'center' } },
  5: { class_type: 'Hunyuan3Dv2Conditioning', inputs: { clip_vision_output: ['4', 0] } },
  6: { class_type: 'EmptyLatentHunyuan3Dv2', inputs: { resolution: 4096, batch_size: 1 } },
  7: { class_type: 'KSampler', inputs: { model: ['3', 0], positive: ['5', 0], negative: ['5', 1], latent_image: ['6', 0], seed: Math.floor(Math.random() * 1e9), steps: 30, cfg: 5, sampler_name: 'euler', scheduler: 'normal', denoise: 1 } },
  8: { class_type: 'VAEDecodeHunyuan3D', inputs: { samples: ['7', 0], vae: ['1', 2], num_chunks: 8000, octree_resolution: 256 } },
  // Umbral 0,6: con 0 la malla sale ruidosa (22 millones de triángulos).
  9: { class_type: 'VoxelToMesh', inputs: { voxel: ['8', 0], algorithm: 'surface net', threshold: 0.6 } },
  10: { class_type: 'SaveGLB', inputs: { mesh: ['9', 0], filename_prefix: '3d/ai3d' } },
});
writeFileSync(out, await download(meshOut[10]['3d'][0]));
console.log(`Listo: ${out}. Ahora: npm run models:reduce -- ${out} public/models/experiments/nombre.glb 20000`);
