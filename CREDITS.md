# Créditos

## Equipo Halo Sur
(Añadir nombres y roles.)

## Datos
| Dato | Fuente | Estado |
|---|---|---|
| Tormentas solares (2024) y Sol de hoy | [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) — Community Coordinated Modeling Center, NASA Goddard, vía [api.nasa.gov](https://api.nasa.gov) | Verificado (fechas, tipo, velocidad). Nivel 1–4 y dosis: decisión de diseño |
| Terreno del polo sur (opcional, **no incluido en la demo publicada**: allí el terreno es generado por código) | [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720), NASA's Scientific Visualization Studio (datos LOLA y LROC WAC). Visualizador: Ernie Wright; científico: Noah Petro | Verificado solo si los archivos se instalan en `public/textures/` |
| Modelos 3D de la base, el módulo lunar y el vehículo | **Modelado propio** del equipo con Blender (`scripts/blender/build_models.py`). No son modelos de NASA; [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) se consultó solo como referencia visual | Decisión de diseño |
| La Tierra en el cielo | [Blue Marble: Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry), NASA Earth Observatory (enero de 2004), reducida a 2048×1024 | Verificado |
| Radiación medida en la Estación Espacial | [RadLab](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) (OSDR Radiation Dosimetry Database), instrumento Lidal, abril de 2022 | Verificado. Solo se usa para comparar; no cambia las reglas |
| Estudios de la tarjeta «Ciencia real» | [NASA OSDR](https://osdr.nasa.gov/bio/repo/) (Open Science Data Repository): OSD-73, OSD-342, OSD-268, OSD-772 | Verificado (título y enlace de cada estudio) |
| Producción de comida en la Luna | [Agencia Espacial Canadiense (CSA)](https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/), agencia aliada del reto | Verificado |
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

Tipografías, auto-alojadas con `@fontsource` (el juego no las pide a ningún servidor externo): **B612** (PolarSys / Airbus, Intactile Design; SIL Open Font License 1.1) y **Barlow Condensed** (Jeremy Tribby; SIL Open Font License 1.1).

## Assets externos
- Modelos 3D (`public/models/*.glb`: reciclador, invernadero, blindaje, taller, refugio, rover y módulo de aterrizaje): modelados con Blender mediante script (`scripts/blender/build_models.py`), con texturas generadas por código (`scripts/blender/textures.py`). Se tomaron como referencia visual imágenes conceptuales generadas con IA por el equipo (Gemini y otro generador de imágenes); las imágenes no se incluyen en el juego.
- `public/models/experiments/habitat-ia.glb`: prueba generada con Z-Image Turbo (Alibaba Tongyi-MAI) y Hunyuan3D 2.1 (Tencent) en ComfyUI local, reducida en Blender. No se usa en el juego. Licencias por revisar antes de usarla en la entrega.

Astronautas: «Little Astronaut» de Jelle Vermandere (https://sketchfab.com/3d-models/little-astronaut-12184db58b1f44c987537b5607c32098), licencia CC-BY 4.0 (http://creativecommons.org/licenses/by/4.0/). Cambios: el color de acento se sustituye por el de cada tripulante y la animación la hace el juego. Archivo: `public/models/astronaut.glb`.

Otros: Todo modelo o audio añadido se registra aquí con origen y licencia.

## IA
Efectos de sonido generados con IA (ElevenLabs), una sola vez con `npm run sfx`; el juego no llama a su API.

Música de fondo generada con IA (Suno) por el equipo Halo Sur: 8 pistas en `public/audio/music/` (main, day, night, storm, minigames, question, victory, lost), normalizadas y comprimidas con ffmpeg. Uso según los términos de Suno de la cuenta con la que se generaron.

Vídeos de la intro (`public/video/intro-es.mp4`, `intro-en.mp4`): hechos por el equipo Halo Sur con ayuda de IA (Claude, Anthropic); comprimidos con ffmpeg a 720p. Contenido propio del equipo.
Vídeo de demostración (`video/`, 30 s): montado con Remotion (remotion.dev) a partir de grabaciones del propio juego; banda sonora `public/audio/music/minigames.mp3` (Suno, equipo Halo Sur) y planos de la intro (`public/video/intro-*.mp4`).
Desarrollado con ayuda de Claude Code (Anthropic). Ver `AI_USAGE.md`.

## Aviso
Proyecto independiente creado para NASA Space Apps Challenge 2026. No afiliado ni avalado por NASA.

## Equipo
Equipo Halo Sur: Christopher Iza, Kevin Vargas, Eduardo Bazurto, Vanessa Alvear.
Retratos de la tripulación: miembros del equipo Halo Sur, usados con su consentimiento (solo si se añaden fotos en `public/crew/`).
