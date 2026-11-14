# Modelos 3D con IA local (ComfyUI + Hunyuan3D)

Alternativa gratuita y sin nube a Meshy (`docs/ASSETS-MESHY.md`) y al modelado por script (`scripts/blender/`).
**Estado:** experimental. El resultado es una forma base, sin textura y con detalle blando: sirve para
bloquear piezas o como punto de partida en Blender, no como pieza final. No sustituye a los 7 modelos de `public/models/`.

Ejemplo ya hecho: `public/models/experiments/habitat-ia.glb` (20 000 triángulos, 361 KB), con su referencia
y vista previa en `docs/previews/habitat-ia-referencia.png` y `habitat-ia.png`.

## Qué necesitas

- ComfyUI (Comfy Desktop o a mano) y una GPU con 16 GB de VRAM (probado en RTX 5060 Ti).
- Blender 4.x o superior (`BLENDER` en `.env`; ver `scripts/blender/run.mjs`).
- Modelos en las carpetas de ComfyUI:

| Carpeta | Archivo | Tamaño |
|---|---|---|
| `models/diffusion_models` | `z_image_turbo_bf16.safetensors` | 11,7 GB |
| `models/text_encoders` | `qwen_3_4b.safetensors` | 7,7 GB |
| `models/vae` | `ae.safetensors` | 0,3 GB |
| `models/checkpoints` | `hunyuan_3d_v2.1.safetensors` ([Comfy-Org/hunyuan3D_2.1_repackaged](https://huggingface.co/Comfy-Org/hunyuan3D_2.1_repackaged)) | 6,9 GB |

## Pasos

1. Abre ComfyUI y pon su dirección en `.env` (`COMFYUI_URL`; Comfy Desktop usa `http://127.0.0.1:8000`).
2. Genera la malla cruda (tarda unos 5–10 min la primera vez; la extracción de la malla va en CPU):

```bash
npm run models:ai3d -- "A small lunar greenhouse dome with a glass roof and a metal frame" crudo.glb
```

3. Reduce a pocos triángulos (objetivo del juego: 30 000 o menos):

```bash
npm run models:reduce -- crudo.glb public/models/experiments/invernadero.glb 20000
```

4. Mírala sin abrir Blender (deja la imagen en `docs/previews/experiments/`):

```bash
node scripts/blender/run.mjs preview experiments/invernadero
```

## Lecciones

- Umbral de la malla **0,6** (el valor por defecto): con 0 sale ruidosa, 22 millones de triángulos.
- `Decimate` solo se atasca en ~520 000 triángulos con mallas de IA; por eso se remalla por vóxeles antes.
- Piezas finas (paneles solares, antenas) se pierden. Se modelan aparte en Blender.
- El texto va en inglés y describe **un solo objeto aislado**. Sin personas ni texto.

## Licencia y créditos

Hunyuan3D 2.1 (Tencent) y Z-Image Turbo (Alibaba Tongyi-MAI) tienen sus propias licencias.
**Pendiente de revisar** antes de usar una malla generada en la entrega del concurso (algunas licencias
limitan territorios o usos). Registrar cada modelo usado en `AI_USAGE.md` y `CREDITS.md`.
