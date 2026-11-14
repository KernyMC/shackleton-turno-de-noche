# NORTE DEL PROYECTO — leer antes de cada tarea

> Escrito por el equipo. Manda sobre cualquier otro documento si hay conflicto.
> (Este texto menciona `DISEÑO.md`: en el repo, el diseño está en `docs/GDD.md` y `docs/ARTE.md`.)

## El punto principal
"Shackleton: Turno de Noche" es un juego donde un estudiante de 10–15 años dirige
una base en el polo sur de la Luna durante 30 días y APRENDE, jugando, por qué una
misión real vive o muere por sus decisiones de energía, soporte vital, comida y
radiación. Reto: "Build a Junior Astronaut Mission Trainer" (NASA Space Apps 2026).

## Lo que nos hace ganar (en este orden)
1. DECISIONES CON CONSECUENCIAS CLARAS. Repartir energía, prepararse para la noche
   lunar, decidir en una tormenta solar. Cada decisión tiene un resultado visible
   y explicable. Esto ES el reto: no lo diluyas.
2. DATOS REALES DE NASA CON PROCEDENCIA VISIBLE. Tormentas reales de DONKI, terreno
   real del CGI Moon Kit, consumos del BVAD. El botón "¿De dónde sale este número?"
   es nuestra función estrella: tiene que funcionar perfecto y ser honesto
   (real / simulado / decisión de diseño). Nunca inventar un dato y presentarlo
   como real.
3. APRENDIZAJE AL FINAL. El debrief explica en lenguaje simple por qué ganaste o
   perdiste y "así lo resuelve una misión real".
4. EMOCIÓN Y PULIDO. La noche lunar tiene que sentirse. La tormenta tiene que
   asustar un poco. Que enganche en los primeros 30 segundos (los jueces juegan 2–3 min).
5. TOQUE ECUATORIANO Y BILINGÜE. Español/inglés y detalles locales (Chimborazo).

## Premios que buscamos
Most Inspirational · Best Use of Science · Best Use of Storytelling.

## Criterios de los jueces
Impact · Creativity · Validity (¿es científicamente válido y funciona?) ·
Relevance (¿responde al reto?) · Presentation.

## Reglas para no desenfocarse
- Antes de agregar algo, pregúntate: ¿ayuda a que el estudiante entienda una
  decisión de misión real? Si no, NO va.
- Un juego pequeño, completo y pulido le gana a uno grande a medias.
- El juego tiene que funcionar SIEMPRE: sin internet, sin API y sin WebGL.
- Primero que se pueda jugar de principio a fin; después lo bonito.
- Prohibido: multijugador, personaje caminando con físicas, más planetas,
  sistemas nuevos que no estén en el diseño, logos de NASA.
- Si algo técnico se complica más de 30 minutos, propón una versión más simple.
- Domingo al mediodía se congela el código. Después solo bugs críticos.

## Entregables que no se pueden olvidar
Deploy público · repo público · video de 30 s con subtítulos en inglés ·
AI_USAGE.md · CREDITS.md · aviso "No afiliado ni avalado por NASA".

## Conflicto abierto (pendiente de decisión del equipo)
"Prohibido: personaje caminando con físicas" choca con la decisión de primera persona
(`docs/GDD.md`) y con la tarea B-02 (caminar, salto lunar, colisiones). Hasta que el
equipo decida, **no empezar B-02 ni B-05**.
