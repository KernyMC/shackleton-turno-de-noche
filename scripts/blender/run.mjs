// Lanza Blender sin ventana para construir los modelos o sacar vistas previas.
//   npm run models:build              → todos los modelos a public/models/
//   npm run models:build -- recycler  → solo uno
//   npm run models:preview -- recycler → docs/previews/recycler.png
// Blender se busca en la variable BLENDER (ruta a blender.exe) o en el PATH.

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env se usa BLENDER del entorno o "blender" del PATH.
}
const blender = process.env.BLENDER || 'blender';
const [mode, ...names] = process.argv.slice(2);
const run = (script, args) => {
  const r = spawnSync(blender, ['--background', '--factory-startup', '--python', script, '--', ...args], { stdio: 'inherit' });
  if (r.error) {
    console.error(`No se pudo ejecutar Blender (${blender}). Pon BLENDER=ruta/a/blender.exe en .env`);
    process.exit(1);
  }
};

if (mode === 'build') run('scripts/blender/build_models.py', ['public/models', ...names]);
else if (mode === 'preview') {
  for (const name of names) {
    const png = resolve(`docs/previews/${name}.png`);
    mkdirSync(dirname(png), { recursive: true });
    run('scripts/blender/preview.py', [`public/models/${name}.glb`, png]);
  }
} else if (mode === 'reduce') run('scripts/ai3d/reduce.py', [resolve(names[0]), resolve(names[1]), ...names.slice(2)]);
else console.error('Uso: run.mjs build [modelo…] | preview <modelo…> | reduce entrada.glb salida.glb [triángulos]');
