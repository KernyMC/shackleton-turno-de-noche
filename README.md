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
| `npm run fetch:nasa` | Descarga datos reales de NASA a `public/data/` |

## Estado actual

- Hecho: esqueleto (Astro + Preact + Three.js + TypeScript + Vitest), base del motor con tests, prototipo caminable, menú, ES/EN mínimo, documentación y tareas.
- Falta: casi todo el juego. Ver el tablero.

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

El juego no llama a ninguna API: un script descarga los datos y los guarda en `public/data/`. Cada
número indica si es **verificado**, **simulado** o **decisión de diseño**. Detalle y fuentes en
[docs/specs/04-datos-nasa.md](docs/specs/04-datos-nasa.md).

## Deploy

Sitio estático. En Vercel o Cloudflare Pages: framework Astro, comando `npm run build`, carpeta `dist`.

## Más

[DECISIONES.md](DECISIONES.md) · [AI_USAGE.md](AI_USAGE.md) · [CREDITS.md](CREDITS.md)
