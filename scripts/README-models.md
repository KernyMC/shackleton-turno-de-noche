# Modelos 3D reales: NASA 3D Resources

El juego funciona sin estos archivos (geometrías simples). Si pones `public/models/lander.glb` y/o
`public/models/rover.glb`, `src/scene/base.ts` los carga y los escala solo.

Repositorio: https://github.com/nasa/NASA-3D-Resources (rama `master`), carpeta `3D Models/`.
Revisado el 14-11-2026:

| Archivo del juego | Carpeta del repo | Archivo | Tamaño original |
|---|---|---|---|
| `lander.glb` | `3D Models/Apollo Lunar Module/` | `Apollo Lunar Module.glb` | 0,7 MB |
| `rover.glb` | `3D Models/Space Exploration Vehicle/` | `Space Exploration Vehicle.glb` | **22,4 MB** (hay que comprimirlo) |
| (opcional, módulos) | `3D Models/Habitat Demonstration Unit/` | `Habitat Demonstration Unit (part 1).glb` / `(part 2).glb` | 0,5 / 0,7 MB |

El repo no tiene un rover lunar tipo Apolo (LRV) en formato GLB; el *Space Exploration Vehicle*
es un concepto de vehículo presurizado de NASA para exploración planetaria y encaja con una base.

## Descargar sin clonar el repo entero (pesa varios GB)

```bash
curl -L -o lander-src.glb "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Apollo%20Lunar%20Module/Apollo%20Lunar%20Module.glb"
```

```bash
curl -L -o rover-src.glb "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Space%20Exploration%20Vehicle/Space%20Exploration%20Vehicle.glb"
```

(Si `raw.githubusercontent.com` devuelve un archivo pequeño de texto, el GLB está en Git LFS:
descárgalo desde el botón "Download raw file" en la web de GitHub.)

## Comprimir a menos de 2 MB (gltf-transform + meshopt)

```bash
npx @gltf-transform/cli optimize lander-src.glb public/models/lander.glb --compress meshopt --texture-compress webp --texture-size 1024
```

```bash
npx @gltf-transform/cli optimize rover-src.glb public/models/rover.glb --compress meshopt --texture-compress webp --texture-size 1024 --simplify-ratio 0.25
```

- `--compress meshopt`: comprime la geometría. El juego ya trae el decodificador (`MeshoptDecoder` en `base.ts`).
- `--texture-compress webp --texture-size 1024`: texturas WebP de máx. 1024 px.
- `--simplify-ratio 0.25`: deja ~25 % de los triángulos (necesario para el rover de 22 MB). Si aún pesa más de 2 MB, prueba `0.1`.
- Comprueba el tamaño: `ls -la public/models`.

## Créditos

Añade cada modelo usado a `CREDITS.md` ("NASA 3D Resources", nombre del modelo y enlace). Las
guías de uso de medios de NASA piden no usar sus logos ni sugerir aval; los modelos sí se pueden usar.
