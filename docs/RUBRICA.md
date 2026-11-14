# RÚBRICA Y ENTREGA — NASA Space Apps Sangolquí 2026 (ESPE)

> Resumen fiel de la «Guía oficial para participantes» y la «Guía de calificación y juzgamiento»
> de la sede. **Toda petición de cambio se contrasta con este documento antes de implementarla**
> (regla 12 de `CLAUDE.md`). Si un cambio no sube ninguna pregunta de la rúbrica o arriesga una
> penalización, se dice antes de hacerlo.

## Fechas que mandan

| Cuándo (domingo 15-nov-2026) | Qué |
|---|---|
| **09:00** | Entrega obligatoria en el formulario de la sede y en la plataforma global de NASA |
| 09:30 – 10:45 | Auditoría del staff: enlaces públicos, datos NASA, repositorio, formato |
| **11:00 – 13:30** | Pitch en español + preguntas, ante 4 jueces (uno por área) |
| 14:30 – 15:00 | Deliberación · 15:00 premiación |

Mentores del bloque 3 (videojuegos y gamificación) solo el sábado; el domingo temprano hay
mentores de despliegue, UX y pitch.

## Penalizaciones automáticas (las aplica el staff, se restan de la nota sobre 100)

| # | Requisito | Falla si… | Resta |
|---|---|---|---|
| 1 | Datos abiertos de NASA | la ficha no cita ni enlaza datasets oficiales de NASA o agencias aliadas | **−2** |
| 2 | Repositorio público y licencia abierta | no hay enlace al repo, o falta un archivo de licencia (MIT, Apache, GPL o CC) en la raíz | **−2** |
| 3 | Enlaces 100 % públicos | algún enlace (demo, repo, video, Drive, Figma) pide permisos o da 404 en incógnito | −1 |
| 4 | Extensión | 8 o más diapositivas (con portada y cierre), o video de más de 35 s (máximo 30 s) | −1 |
| 5 | IA y logos | falta la declaración de IA, faltan marcas de agua en imágenes generadas con IA, o se usan logos de NASA | −1 |
| 6 | Bilingüe ES / EN | la ficha o los entregables de la plataforma están en un solo idioma | −1 |

Estado en el repo (actualizar al cambiar): licencia `LICENSE` en la raíz · declaración de IA en
`AI_USAGE.md` · créditos en `CREDITS.md` · datos y fuentes en `README.md` y en el panel
«¿De dónde salen los datos?» del juego · demo en https://shackleton-turno-de-noche.vercel.app.
**Pendiente del equipo:** hacer público el repositorio de GitHub, diapositivas (máx. 7), video
(máx. 30 s) y ficha bilingüe en la plataforma.

## Las 20 preguntas (cada una de 1 a 5; el 5 es solo para lo sobresaliente)

### Área 1 · Rigor científico y datos (RCD)
- **1.1 Uso evidente de datos NASA.** 3 = nombra un dataset y muestra cómo se conecta. 5 = varios datasets, uso determinante y justificado.
- **1.2 Solidez científica.** 1 = errores graves o **premisas pseudocientíficas**. 3 = principios correctos para un hackathon. 5 = rigor ejemplar.
- **1.3 Procesamiento de datos.** 1 = solo imágenes prefabricadas. 3 = flujo básico de filtrado o cruce. 4 = pipeline o script explicado con claridad.
- **1.4 Dominio en las preguntas.** 4 = precisa variables críticas y **limitaciones de los datos**.
- **1.5 Transparencia.** 5 = distingue con exactitud lo propio del soporte externo o IA.

### Área 2 · Innovación y ejecución técnica (IET)
- **2.1 Prototipo funcionando.** 2 = maquetas estáticas. 4 = demo fluida e interactiva que resuelve el problema central. 5 = **completo, interactivo, estable y listo para usar**.
- **2.2 Arquitectura explicada.** 4 = backend, frontend, APIs y modelos bien integrados.
- **2.3 Creatividad.** 4 = combina tecnología, diseño y datos de forma fresca.
- **2.4 Defensa técnica en preguntas.**
- **2.5 Factibilidad y reproducibilidad.** 2 = «parece simulado en exceso».

### Área 3 · Impacto y relevancia (IR)
- **3.1 Alineación con el reto.** 4 = responde de forma directa y completa a **todos** los objetivos del reto. 5 = supera las expectativas.
- **3.2 Magnitud del impacto.**
- **3.3 Adopción y escalabilidad** tras el hackathon (hoja de ruta).
- **3.4 Pertinencia territorial, global o de misión** (Ecuador, mundo o espacio).
- **3.5 Accesibilidad y usabilidad.** 4 = pensado para la facilidad de uso y la inclusión. 5 = democratiza datos complejos para cualquiera.

### Área 4 · Storytelling y presentación (STP)
- **4.1 Narrativa del pitch.** 4 = Problema → Solución con datos → Impacto.
- **4.2 Calidad visual e interfaz.** 4 = atractiva e intuitiva, se entiende al instante. 5 = **acabado profesional**.
- **4.3 Gestión del tiempo.**
- **4.4 Expresión oral e inspiración.**
- **4.5 Cohesión del equipo en preguntas.**

## Cómo se calcula cada premio

Nota de la categoría = suma de (promedio del área × 20 × peso) + **3 puntos por cada juez que
nomine al equipo en esa categoría** − penalizaciones del staff.

| Categoría | RCD | IET | IR | STP |
|---|---|---|---|---|
| Best Use of Data | **50** | 20 | 15 | 15 |
| Best Use of Science | **50** | 20 | 20 | 10 |
| Best Use of Technology | 20 | **50** | 15 | 15 |
| Best Mission Concept | 25 | **35** | 25 | 15 |
| Galactic Impact | 15 | 15 | **50** | 20 |
| Best Storytelling | 15 | 15 | 20 | **50** |
| Art & Technology | 15 | **40** | 15 | 30 |
| Global Connection | 15 | 15 | **45** | 25 |
| Local Impact | 15 | 15 | **50** | 20 |
| Most Inspirational | 10 | 15 | 25 | **50** |

Los premios que busca el equipo (`docs/NORTE.md`): **Most Inspirational**, **Best Use of
Science** y **Best Storytelling**. Los dos primeros se deciden, sobre todo, por la presentación
(STP) y por el rigor de los datos (RCD).

## Cómo cuestionar un cambio (regla 12)

Antes de implementar cualquier petición, responder en dos líneas:

1. **¿Qué pregunta de la rúbrica sube?** (p. ej. 2.1 estabilidad, 1.1 datos visibles, 3.5 usabilidad, 4.2 interfaz).
2. **¿Qué pone en riesgo?** Sobre todo: la estabilidad de la demo (2.1), el rigor científico
   (1.2: nada pseudocientífico presentado como real), la alineación con el reto (3.1), el tiempo
   que queda hasta la entrega y las seis penalizaciones.

Si el cambio no sube nada o el riesgo es mayor que la ganancia, **se avisa y se propone la
alternativa más barata**; quien decide es el equipo. A menos de 12 horas de la entrega, lo que
toca el motor o puede romper la demo se desaconseja por defecto.
