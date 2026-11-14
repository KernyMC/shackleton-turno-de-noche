# Créditos

## Equipo Halo Sur
(Añadir nombres y roles.)

## Datos
| Dato | Fuente | Estado |
|---|---|---|
| Tormentas solares (2024) y Sol de hoy | [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) — Community Coordinated Modeling Center, NASA Goddard, vía [api.nasa.gov](https://api.nasa.gov) | Verificado (fechas, tipo, velocidad). Nivel 1–4 y dosis: decisión de diseño |
| Terreno del polo sur (opcional) | [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720), NASA's Scientific Visualization Studio (datos LOLA y LROC WAC). Visualizador: Ernie Wright; científico: Noah Petro | Verificado cuando los archivos están en `public/textures/` |
| Modelos 3D (opcionales) | [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources): *Apollo Lunar Module*, *Space Exploration Vehicle* | Verificado cuando los archivos están en `public/models/` |
| Consumos de soporte vital | NASA Life Support Baseline Values and Assumptions Document (BVAD) — pendiente de citar | Simulado (pendiente) |
| Balance del juego y secuencia de luz de 30 días | Diseño propio | Decisión de diseño |

## Librerías
| Librería | Licencia |
|---|---|
| Astro | MIT |
| Preact y @preact/signals | MIT |
| Three.js | MIT |
| Vitest | MIT |
| sharp (solo script de texturas) | Apache-2.0 |

Tipografías: Space Grotesk e IBM Plex Mono (SIL Open Font License), servidas por Google Fonts.

## Assets externos
- Modelos 3D (`public/models/*.glb`: reciclador, invernadero, blindaje, taller, refugio, rover y módulo de aterrizaje): modelados con Blender mediante script (`scripts/blender/build_models.py`), con texturas generadas por código (`scripts/blender/textures.py`). Se tomaron como referencia visual imágenes conceptuales generadas con IA por el equipo (Gemini y otro generador de imágenes); las imágenes no se incluyen en el juego.
- `public/models/experiments/habitat-ia.glb`: prueba generada con Z-Image Turbo (Alibaba Tongyi-MAI) y Hunyuan3D 2.1 (Tencent) en ComfyUI local, reducida en Blender. No se usa en el juego. Licencias por revisar antes de usarla en la entrega.

Otros: Todo modelo o audio añadido se registra aquí con origen y licencia.

## IA
Efectos de sonido generados con IA (ElevenLabs), una sola vez con `npm run sfx`; el juego no llama a su API.
Desarrollado con ayuda de Claude Code (Anthropic). Ver `AI_USAGE.md`.

## Aviso
Proyecto independiente creado para NASA Space Apps Challenge 2026. No afiliado ni avalado por NASA.

## Equipo
Equipo Halo Sur: Christopher Iza, Kevin Vargas, Eduardo Bazurto, Vanessa Alvear.
Retratos de la tripulación: miembros del equipo Halo Sur, usados con su consentimiento (solo si se añaden fotos en `public/crew/`).
