# Shackleton: Turno de Noche

**Español** · [English](README.en.md)

Juego web donde diriges la primera base humana en el polo sur de la Luna durante 30 días. Tocas
una **maqueta 3D viva** de la base y decides cada día a qué módulo le das energía: aire y agua,
comida, blindaje contra la radiación o el taller. Sobrevives a la noche lunar y a tormentas
solares **reales**, y al final el juego explica qué pasó y cómo lo resuelve una misión de verdad.

**Jugar:** https://shackleton-turno-de-noche.vercel.app (navegador, sin cuenta ni descarga; funciona en celular y sin internet una vez cargado).

Equipo **Halo Sur** · NASA Space Apps Challenge 2026 · sede Sangolquí, Ecuador (ESPE).
Reto: *Build a Junior Astronaut Mission Trainer*. Público: niñas y niños de 7 a 12 años. Español e inglés.

> Proyecto independiente. No afiliado ni avalado por NASA. La historia es ficción; los datos de la Luna y del Sol son reales.

## Qué enseña

| Decisión real de una misión | Cómo se juega |
|---|---|
| La energía es limitada y hay que repartirla | Cada día repartes la energía del Sol y de la batería entre cuatro módulos |
| La noche lunar del polo sur dura días | Seis días sin Sol: solo tienes lo que guardaste antes |
| Las tormentas solares obligan a elegir | Refugio (poca radiación, se para la producción) o seguir trabajando (más radiación) |
| Las cosas se rompen y el polvo lunar ensucia | Averías y polvo en los paneles: reparar hoy cuesta energía; esperar cuesta producción |
| Las comunicaciones importan | Con la antena encendida, el aviso de tormenta llega 2 días antes |

La partida se divide en **5 actos** que desbloquean las mecánicas de a una, y cada evento ofrece
**dos opciones válidas con costos distintos**: ninguna decisión es gratis.

## Cómo se juega

1. **Historia en cómic** (5 viñetas, se puede saltar): año 2048, el cráter Shackleton, la tripulación y la tormenta que corta la comunicación. Va rotulada «Historia de ficción · datos reales».
2. **Tres modos**: *Tutorial* (5 días guiados; la pantalla se oscurece y solo queda iluminado lo que hay que tocar), *Cadete* (con margen para aprender) y *Comandante* (el reto completo).
3. **Cada día**: repartes la energía con bloques, ves al instante cómo cambiará cada recurso y pasas el día. La tripulación reacciona con caritas: contenta, tranquila, preocupada o asustada.
4. **Diez retos** repartidos en los 30 días (tabla de abajo). Antes de cada uno hay una demostración animada de cómo se juega; el reloj no corre hasta que empiezas.
5. **Final**: si resistes hasta el día 30 llega la nave de relevo. Si no, la misión se aborta y el juego explica qué pasó y cómo lo resolvería una misión real.

Desde la portada, el botón **Minijuegos** abre los diez retos sueltos, sin partida ni premios, para practicar o para enseñarlos.

### Los diez retos

| Día | Reto | Qué se hace | Qué deja |
|---|---|---|---|
| 2 | Rover al hielo | Llevar el rover al hielo y volver, eligiendo entre casillas al Sol y en sombra | El Sol da energía pero trae radiación; la sombra protege pero gasta batería |
| 4 | Antenas de clima espacial | Ajustar las antenas hasta que la onda coincide con la señal | Con buenas antenas, el aviso de tormenta llega antes |
| 6 | Fugas en los túneles | Encontrar tres fugas con las pistas del detector | Sin fugas, el aire se queda dentro |
| 8 | Cables a las balizas | Unir tres pares de conectores sin cruzar los cables | Planear el camino antes de empezar |
| 12 | Brazo robótico | Girar hombro y codo para coger una muestra sin tocar rocas | Los brazos robóticos trabajan fuera para que nadie tenga que salir |
| 14 | Chequeo de la tripulación | Dar el cuidado correcto a quien lo necesita | En una misión se vigila la salud de cada persona |
| 16 | Muro de regolito | Recoger montones de regolito y armar el muro ladrillo a ladrillo | Una capa gruesa de regolito frena la radiación |
| 18 | Lluvia de micrometeoritos | Girar el escudo hacia donde avisa el radar | Varias capas finas frenan mejor que una gruesa |
| 24 | Gran tormenta solar | Decidir qué apagar y colocar el muro del refugio | Ahorrar energía a tiempo protege a la tripulación |
| 30 | Llega la nave de relevo | Fijar las cuatro barras para el acoplamiento | Un acoplamiento se hace despacio y en equipo |

Los retos son **ficción de juego**: sus premios y castigos son decisiones de diseño
(`public/data/challenges.json`, estado `game_balance`). El dato científico que acompaña a cada uno
enlaza con su fuente en el panel «¿De dónde salen los datos?».

## Datos de NASA y de agencias aliadas

El juego muestra sus fuentes dentro, en el panel **«¿De dónde salen los datos?»** (portada y barra
superior), que lee `public/data/sources.json`. Cada dato lleva su estado: **dato real**,
**simulado** o **decisión del juego**.

| Dataset | Para qué se usa en el juego | Estado | Enlace |
|---|---|---|---|
| **NASA DONKI** (Space Weather Database Of Notifications, Knowledge, Information) | Las tormentas del juego son eventos reales (eyecciones de masa coronal y partículas solares). Si hoy el Sol está activo, la primera tormenta es el evento real de esta semana (proxy `/api/spaceweather`) | Dato real | [ccmc.gsfc.nasa.gov/tools/DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) |
| **RadLab** (OSDR Radiation Dosimetry Database) | Dosis reales medidas en la Estación Espacial (instrumento Lidal, abril de 2022) para comparar con la radiación del juego | Dato real | [visualization.osdr.nasa.gov/radlab](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) |
| **NASA OSDR** (Open Science Data Repository) | Tarjeta «Ciencia real» del final: estudios sobre radiación, músculo y hueso, y cultivos en la Estación Espacial | Dato real | [osdr.nasa.gov/bio/repo](https://osdr.nasa.gov/bio/repo/) |
| **Blue Marble: Next Generation** (NASA Earth Observatory) | La Tierra que se ve en el cielo de la Luna | Dato real | [science.nasa.gov/…/blue-marble-next-generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry) |
| **CGI Moon Kit** (LOLA y LROC WAC, NASA SVS) | Relieve y color del terreno del polo sur, **solo si se instalan los mapas** (`scripts/README-textures.md`). En la demo publicada el terreno es generado por código | Opcional, no incluido en la demo | [svs.gsfc.nasa.gov/4720](https://svs.gsfc.nasa.gov/4720) |
| **NASA 3D Resources** | Referencia visual para los modelos del módulo de aterrizaje y el vehículo, modelados por el equipo | Referencia | [github.com/nasa/NASA-3D-Resources](https://github.com/nasa/NASA-3D-Resources) |
| **CSA — Food production** (Agencia Espacial Canadiense) | Datos sobre producir comida en la Luna | Dato real (agencia aliada) | [asc-csa.gc.ca](https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/) |
| Nivel de tormenta (1–4), dosis, consumos y balance | Convertir los eventos reales en reglas jugables | Decisión del juego (`DECISIONES.md`) | — |

**Cómo se procesan:** `npm run data:donki` descarga un año de eventos de DONKI, los normaliza
(tipo, fecha, velocidad o clase) y les asigna un nivel de 1 a 4 según su fuerza;
`npm run data:radlab` descarga y resume las dosis de RadLab. Los resultados quedan como JSON en
`public/data/` para que el juego funcione sin red. El motor (`src/sim`) elige por semilla una
tormenta real del nivel que corresponde a cada acto, sin modificar sus datos.

## Cómo está hecho

- **Astro + Preact + TypeScript**, con **Three.js** para la maqueta 3D.
- **Motor del juego puro y determinista** (`src/sim`): misma semilla y mismas decisiones dan el mismo resultado. Cubierto con tests (Vitest) y una simulación de 1000 partidas para medir el balance (`npm run simulate`).
- **Proxy propio** `/api/spaceweather` (función de Vercel) para el clima espacial en vivo: la clave de NASA nunca llega al navegador y, si falla, el juego usa los datos guardados.
- **Calidad adaptativa**: baja la resolución y los efectos si el equipo va lento.
- **Accesible**: todo se puede hacer con teclado y desde el panel (sin 3D), el estado nunca se dice solo con color, y respeta «reducir movimiento».
- **Pensado para leer poco**: demostración animada antes de cada reto, dibujos en vez de letreros, frases cortas en español e inglés.

```
src/sim/         motor del juego: reglas, actos, eventos, avance rápido (con tests)
src/state/       store (signals): puente entre motor, interfaz y escena
src/scene/       maqueta 3D de la base (Three.js)
src/components/  interfaz (visor, panel de energía, eventos, tripulación, cómic, retos, final)
src/i18n/        textos en español e inglés
public/data/     balance y datos de NASA en JSON
api/             proxy de clima espacial (Vercel)
scripts/         descarga de datos y simulación de balance
docs/            diseño (GDD), arte, rúbrica y tareas
```

## Ejecutarlo

Necesitas [Node.js](https://nodejs.org) 22 o superior.

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:4321.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests del motor y de la interfaz |
| `npm run check` | Tipos TypeScript |
| `npm run build` | Build estático en `dist/` |
| `npm run simulate` | Juega 1000 partidas automáticas y muestra el balance |
| `npm run data:donki` / `data:radlab` | Descarga datos reales de NASA a `public/data/` |
| `npm run check:nasa` | Prueba el proxy de clima espacial: API bien, caída y sin internet |

Variables de entorno: copia `.env.example` a `.env` (no se sube a git). `NASA_API_KEY` es opcional
(clave gratuita de https://api.nasa.gov); sin ella el juego usa los datos guardados.

## Qué sigue

Borrador de hoja de ruta del equipo, sin fechas comprometidas:

- Probarlo con más niñas y niños de 7 a 12 años y ajustar la dificultad con lo que se observe.
- Una guía corta para docentes: qué decisión real de misión trabaja cada día y cada reto.
- Terreno real del polo sur (CGI Moon Kit) incluido en la demo, no solo como opción.
- Más idiomas y una versión instalable que funcione sin conexión desde el primer momento.

## Transparencia

- **Uso de IA:** declarado en [AI_USAGE.md](AI_USAGE.md). El código se desarrolló con asistencia de IA, dirigida y revisada por el equipo.
- **Créditos y fuentes:** [CREDITS.md](CREDITS.md). Sin logos de NASA. El modelo 3D de los astronautas es «Little Astronaut» de Jelle Vermandere (CC-BY 4.0), con los colores cambiados.
- **Qué es dato y qué no:** las tormentas, las dosis de referencia y la foto de la Tierra son reales. El terreno, el cráter dibujado, las nubes de la Tierra, la historia y los números de balance son del juego.
- **Decisiones de diseño:** [DECISIONES.md](DECISIONES.md).
- **Licencia:** [MIT](LICENSE). Los datos e imágenes de NASA y agencias aliadas conservan sus propios términos.

## Para el equipo

[CLAUDE.md](CLAUDE.md) (reglas y flujo de trabajo) · [docs/NORTE.md](docs/NORTE.md) (prioridades) ·
[docs/RUBRICA.md](docs/RUBRICA.md) (cómo califican y qué penalizan) · [docs/GDD.md](docs/GDD.md) ·
[docs/ARTE.md](docs/ARTE.md) · [docs/tasks/TABLERO.md](docs/tasks/TABLERO.md) ·
[docs/COLABORAR-IA.md](docs/COLABORAR-IA.md)

Despliegue: proyecto de Vercel `shackleton-turno-de-noche` (preset Astro). La clave `NASA_API_KEY`
vive en las variables de entorno del proyecto. `npx vercel deploy --prod` desde un árbol limpio.
