# Shackleton: Turno de Noche

Juego web en primera persona: diriges la primera base humana en el polo sur de la Luna durante 30
días. Repartes energía entre soporte vital, comida y blindaje, sobrevives a la noche lunar y a las
tormentas solares, y al final ves cómo lo resuelve una misión real.

Equipo **Halo Sur** · NASA Space Apps Challenge 2026 · Sangolquí, Ecuador.
Reto: *Build a Junior Astronaut Mission Trainer*.

> Proyecto independiente. No afiliado ni avalado por NASA.

## Empezar en 2 minutos

Necesitas [Node.js](https://nodejs.org) 22 o superior y Git.

```bash
git clone <URL-del-repo>
```

```bash
cd shackleton-turno-de-noche
```

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:4321 **en una pestaña normal de Chrome o Firefox** (en vistas previas
embebidas el navegador no deja capturar el mouse). Clic para entrar, `WASD` para caminar, `Tab` para la tablet.

## Si llegas nuevo al equipo

> **Asistentes de IA (Claude Code, Codex, Cursor…):** lee primero [docs/COLABORAR-IA.md](docs/COLABORAR-IA.md). Explica cómo clonar, configurar `.env` (parte de `.env.example`), hacer commit y **push** sin romper nada.

1. Lee [docs/GDD.md](docs/GDD.md) (5 min): qué juego es y qué entra.
2. Lee [docs/ARTE.md](docs/ARTE.md) si vas a tocar algo visual o de sonido.
3. Abre [docs/tasks/TABLERO.md](docs/tasks/TABLERO.md), elige una tarea libre y pon tu nombre.
4. Sigue el flujo de [CLAUDE.md](CLAUDE.md) (sirve para personas y para Claude Code).

**Con Claude Code:** abre la carpeta del repo y escribe, por ejemplo:
`Toma la tarea A-01 del tablero y complétala siguiendo CLAUDE.md`. El archivo `CLAUDE.md` se carga
solo y le da las reglas, la dirección de arte y el flujo de trabajo.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests del motor |
| `npm run check` | Tipos TypeScript |
| `npm run build` | Build estático en `dist/` |
| `npm run simulate` | Juega 1000 partidas automáticas y muestra el balance |
| `npm run data:donki` | Descarga tormentas reales de un año (NASA DONKI) a `public/data/storms_real.json` |
| `npm run check:nasa` | Prueba el proxy de clima espacial: API ok, caída y sin internet |
| `npm run models:build` / `models:preview` | Modelos 3D por script con Blender (necesita `BLENDER` en `.env`) |
| `npm run models:ai3d` / `models:reduce` | Experimental: malla 3D con IA local (ComfyUI + Hunyuan3D) y reducción en Blender. Ver [scripts/README-ia3d.md](scripts/README-ia3d.md) |

## Estado actual

- Hecho: esqueleto (Astro + Preact + Three.js + TypeScript + Vitest), **motor del juego completo** (30 días, eventos, derrota y victoria, 50 tests, balance medido con 1000 partidas), prototipo caminable, documentación y tareas detalladas.
- Falta: la interfaz (tablet, visor, eventos, debrief), el mundo 3D definitivo y los datos reales de NASA. Ver el tablero.

## Estructura

```
src/sim/         motor del juego: puro, determinista, con tests
src/state/       store (signals): puente entre motor, interfaz y escena
src/scene/       mundo 3D en primera persona
src/components/  interfaz (visor, tablet, eventos, debrief)
src/i18n/        textos ES/EN
public/data/     balance, luz y datos NASA en JSON
scripts/         descarga de datos y simulación de balance
docs/            GDD, arte, specs y tareas
```

## Datos de NASA

Tormentas reales de NASA DONKI (2024) en `public/data/storms_real.json` y, si hoy el Sol está activo, el evento real de esta semana vía el proxy `/api/spaceweather`. Terreno (CGI Moon Kit) y modelos 3D (NASA 3D Resources) opcionales: ver `scripts/README-textures.md` y `scripts/README-models.md`. Cada
número indica si es **verificado**, **simulado** o **decisión de diseño**. Detalle y fuentes en
[docs/specs/04-datos-nasa.md](docs/specs/04-datos-nasa.md).

### Qué datos usamos y por qué

El juego también los muestra dentro, en el panel «¿De dónde salen los datos?» (ícono de datos en la barra superior y enlace en la portada), que lee `public/data/sources.json`.

| Dataset | Para qué se usa en el juego | Estado | Enlace |
|---|---|---|---|
| NASA DONKI (tormentas solares) | Las tormentas del juego son eventos reales de 2024 (y el de esta semana si el Sol está activo) | Real de NASA | [ccmc.gsfc.nasa.gov/tools/DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) |
| CGI Moon Kit (LOLA y LROC WAC) | Relieve y color del terreno del polo sur lunar, si los mapas están instalados | Real de NASA (opcional; sin ellos, terreno procedural) | [svs.gsfc.nasa.gov/4720](https://svs.gsfc.nasa.gov/4720) |
| NASA 3D Resources | Modelos 3D del módulo de aterrizaje y el vehículo, si están instalados | Real de NASA (opcional) | [github.com/nasa/NASA-3D-Resources](https://github.com/nasa/NASA-3D-Resources) |
| Consumo de aire, agua y comida (BVAD) | Cuánto necesita cada astronauta al día | Simulado (valor provisional; falta citar el documento de NASA) | sin enlace todavía |
| Tormentas de ejemplo | Respaldo si no hay datos reales | Simulado | sin enlace |
| Nivel de tormenta (1–4) y dosis | Convertir cada evento real en nivel y radiación de juego | Decisión del juego | sin enlace |
| Balance general | Valores para que el juego sea jugable | Decisión del juego | sin enlace |
| RadLab (OSDR Radiation Dosimetry) | Comparar la radiación del juego con dosis reales medidas en la ISS (instrumento Lidal, abril de 2022; `public/data/radiation_iss.json`, `npm run data:radlab`) | Real de NASA | [visualization.osdr.nasa.gov/radlab](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) |
| NASA OSDR (Open Science Data Repository) | Tarjeta «Ciencia real» del final: estudios reales sobre radiación, músculo y hueso, lechuga y chiles en la ISS (`public/data/osdr_facts.json`) | Real de NASA | [osdr.nasa.gov/bio/repo](https://osdr.nasa.gov/bio/repo/) |
| CSA — Food production on the Moon | Datos de producción de comida en la Luna para la tarjeta del final (`public/data/food_facts.json`) | Real (Agencia Espacial Canadiense, socia del reto) | [asc-csa.gc.ca](https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/) |
| Retraso de la señal Tierra–Luna | La antena: la Tierra avisa de las tormentas 2 días antes; la ayuda explica que la señal tarda ~1,3 s a la Luna y 4–24 min a Marte | Física conocida; los 2 días de aviso son decisión del juego | sin enlace |

## Deploy (Cloudflare Pages)

1. Cloudflare → Workers & Pages → Create → Pages → conectar este repo de GitHub.
2. Framework preset **Astro** · Build command `npm run build` · Output directory `dist` · variable `NODE_VERSION` = `24`.
3. Settings → **Variables and Secrets** → añadir `NASA_API_KEY` (tipo *Secret*) en **Production** y **Preview**, con tu clave de https://api.nasa.gov.
4. La carpeta `functions/` se publica sola como `/api/spaceweather`. Si la variable falta o NASA falla, el juego usa las tormentas históricas sin mostrar errores.

En local, `npm run dev` sirve la misma ruta leyendo la clave de `.env` (copia `.env.example`).

## Variables de entorno

Copia `.env.example` a `.env` (no se sube a git). `NASA_API_KEY` es opcional; `BLENDER` y `COMFYUI_URL` solo para modelos 3D.

## Más

[Guía para asistentes de IA y push](docs/COLABORAR-IA.md) · [DECISIONES.md](DECISIONES.md) · [AI_USAGE.md](AI_USAGE.md) · [CREDITS.md](CREDITS.md)
