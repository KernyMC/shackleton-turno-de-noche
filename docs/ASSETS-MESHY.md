# Modelos 3D con Meshy (u otro generador)

El juego funciona sin estos archivos: cada módulo tiene una forma hecha por código. Si generas
modelos y los pones en `public/models/`, el juego los usa en su lugar. La luz ámbar, el aro de
energía en el suelo y el rótulo con ícono **se mantienen**, así que la energía se sigue viendo.

## Qué archivos acepta el juego

| Archivo | Sustituye a | Alto en el juego |
|---|---|---|
| `public/models/recycler.glb` | Reciclador | ~6 m |
| `public/models/greenhouse.glb` | Invernadero | ~4,5 m |
| `public/models/shield.glb` | Blindaje | ~9 m |
| `public/models/workshop.glb` | Taller | ~5,5 m |
| `public/models/shelter.glb` | Refugio central | ~3 m |
| `public/models/rover.glb` | Rover | ~2 m |
| `public/models/lander.glb` | Módulo de aterrizaje | ~6 m |

El juego escala cada modelo solo a esa altura y lo apoya en el suelo. No hace falta acertar el tamaño.

## Ajustes al generar (búscalos en la pantalla de Meshy; los nombres pueden variar)

- Modo **texto a 3D**, estilo **realista** (no cartoon ni low-poly de colores).
- Con texturas **PBR** si lo ofrece.
- Pocos polígonos: objetivo **30 000 triángulos o menos** por modelo.
- Exportar en **GLB**.
- Genera los 5 de la base con el mismo estilo: usa siempre la frase de estilo de abajo, sin cambiarla.

**Frase de estilo (va al final de cada prompt):**

```
realistic NASA-style lunar surface habitat hardware, off-white bone-colored insulated hull panels, visible panel seams and rivets, dark grey mechanical details, thin layer of grey moon dust near the base, hard-surface industrial design, clean silhouette, single object, sits flat on the ground, no astronauts, no text, no logos, no flags, no background
```

**Prompt negativo (si hay casilla):**

```
text, letters, logo, NASA logo, flag, people, astronaut, cartoon, toy, neon, glowing sci-fi lights, purple, blue lights, weapons, floating parts, base plate, ground, terrain, background
```

## Prompts

### 1. Reciclador — `recycler.glb`
```
A compact life support recycling module for a Moon base: a short vertical cylindrical tower with a domed roof, two spherical pressure tanks attached to its sides by pipes, a ring of small radiator fins around the middle, an airlock hatch on the front, 
```
(+ frase de estilo)

### 2. Invernadero — `greenhouse.glb`
```
A lunar greenhouse module: a low wide cylindrical base with a transparent glass geodesic dome on top, metal ribs holding the glass panels, rows of green leafy plants in hydroponic trays visible inside, a small airlock tunnel on one side, 
```
(+ frase de estilo)

### 3. Blindaje — `shield.glb`
```
A radiation shielding generator for a Moon base: a squat octagonal machine housing with a tall central mast, three metal emitter rings stacked around the mast getting smaller toward the top, thick power cables at the base, a small control box on the side, 
```
(+ frase de estilo)

### 4. Taller — `workshop.glb`
```
A lunar base workshop and garage: a rectangular module with a curved barrel roof like a small hangar, a large roll-up door on the front, a small robotic crane arm mounted on one corner, tool crates and a spare wheel beside the door, 
```
(+ frase de estilo)

### 5. Refugio — `shelter.glb`
```
A radiation storm shelter for a Moon base, half buried: a low reinforced dome almost completely covered by a mound of piled grey lunar regolith sandbags, only a heavy round hatch door and a short entrance tunnel exposed, 
```
(+ frase de estilo)

### 6. Rover — `rover.glb`
```
A small pressurized lunar exploration rover: a rounded capsule cabin with large front windows on a six-wheel chassis with wire mesh wheels, a dish antenna and a drill sample arm on the back, headlights, 
```
(+ frase de estilo)

### 7. Módulo de aterrizaje — `lander.glb`
```
A modern crewed lunar lander standing on four landing legs with round footpads, a cylindrical crew cabin on top of a wider descent stage wrapped in gold foil insulation, a ladder down one leg, engine bell underneath, 
```
(+ frase de estilo)

> Para el lander y el rover también hay modelos **reales de NASA** (ver `scripts/README-models.md`);
> si usas los de NASA, cuentan como dato real y suman para "Best Use of Science".

## Después de descargar cada GLB

1. Comprímelo a menos de 2 MB (cambia `entrada.glb` y el nombre de salida):

```bash
npx @gltf-transform/cli optimize entrada.glb public/models/recycler.glb --compress meshopt --texture-compress webp --texture-size 1024
```

Si sigue pesando más de 2 MB, añade `--simplify-ratio 0.3` al final.

2. Abre `public/optional-assets.json` y lista los modelos que pusiste, por ejemplo:

```json
{ "terrain": false, "models": ["recycler", "greenhouse", "shield", "workshop", "shelter"] }
```

3. `npm run dev` y míralo. Si un modelo sale girado o se ve mal, quítalo de la lista y el juego
   vuelve a la forma hecha por código.

## Qué revisar antes de aceptar un modelo

- Se reconoce qué es **de lejos y desde arriba** (la cámara mira la base en diagonal).
- No trae suelo, pedestal ni fondo pegados.
- No trae letras, logos ni banderas (regla del proyecto: nada de logos de NASA).
- Color blanco hueso y gris: sin luces de neón ni morados (ver `docs/ARTE.md`).

## Créditos

Anota cada modelo generado en `CREDITS.md` ("Modelo generado con Meshy a partir de un prompt del
equipo") y en `AI_USAGE.md`. Revisa la licencia de tu plan de Meshy para uso público del modelo.
