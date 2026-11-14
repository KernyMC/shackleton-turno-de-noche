# Diseño del juego (GDD)

El documento original completo está en `docs/specs/00-documento-original.md`. **Este GDD lo
modifica en tres puntos**; en todo lo demás, el original sigue valiendo.

| Cambio | Original | Ahora |
|---|---|---|
| Cámara | Vista orbital | **Primera persona** (caminas por la base) |
| Datos | Solo simulados | **Datos NASA reales descargados a JSON** con un script; lo que no se consiga queda marcado como simulado |
| Alcance | Todo el documento | **MVP de 24–36 h** (sección 4) |

## 1. Fantasía

"Soy la comandante de la primera base humana en el polo sur de la Luna. Camino por ella, veo sus
luces, y cuatro personas dependen de cómo reparto la energía."

## 2. Bucle de un día (objetivo: 15–25 s)

1. **Amanece el día.** Estás en la base. El visor del casco muestra batería, soporte vital, comida y dosis.
2. **Planificas** en la tablet de muñeca (`Tab`): 4 sliders de energía + vista previa del resultado.
3. **Ejecutas el día** desde la tablet. El sol avanza, las luces de los módulos cambian según tu plan, los recursos se actualizan.
4. **Si hay evento**, ocurre en el mundo y te pide actuar (sección 3).
5. Tras 30 días: victoria. Recurso en 0 o dosis al límite: misión abortada. Luego, debrief.

No hace falta caminar para planificar: la tablet funciona desde cualquier lugar. **Caminar es
para los eventos y para ver tu base** (cada módulo se ilumina según la energía que le diste).

## 3. Eventos en primera persona

Cada evento conserva las reglas del original (sección 6) y gana una acción física. **Siempre existe
el botón equivalente en la tablet**, para celular, teclado y modo sin 3D.

| Evento | Acción física | Equivalente |
|---|---|---|
| Tormenta solar | Tienes 25 s para llegar al refugio y pulsar `E` → "¡Todos al refugio!". Si no llegas o eliges quedarte → "Seguir trabajando" | Dos botones en la tablet |
| Avería | Ve al módulo con luz roja y mantén `E` 3 s → "Reparar hoy" (reserva 10 de energía al taller). Ignorarlo → "Dejarlo para después" | Botones en la tablet |
| Hielo detectado | Ve al rover y pulsa `E` → "Enviar el rover" | Botones en la tablet |
| Aviso de noche, cosecha, mensaje, suministros, micro-falla | Mensaje de radio de Control de Misión | Igual |

El cronómetro de la tormenta no corre con la tablet abierta ni con movimiento reducido activado.

## 4. Alcance

**P0 — sin esto no hay juego (meta: hora 14)**
- Motor completo: `runDay`, `previewDay`, eventos garantizados, derrota/victoria.
- Caminar por la base, 4 módulos con luz según energía, sol y noche lunar.
- Tablet con planificador y "Ejecutar día". Visor de casco.
- Eventos con botones en la tablet. Debrief con causa y estrellas.
- Español. Una dificultad jugable de principio a fin (Comandante), Cadete por datos.

**P1 — lo que gana la hackathon (meta: hora 24)**
- Acciones físicas de eventos (refugio con cronómetro, reparar, rover).
- Tormentas con fechas reales de NASA y ficha "¿De dónde sale este número?".
- Terreno y regolito procedurales según `docs/ARTE.md`, postprocesado, sonido.
- Debrief con gráfica y tarjetas "Así lo resuelve una misión real". Inglés. Guardado.
- Deploy público.

**P2 — solo si sobra tiempo**
- Controles táctiles, tutorial guiado, insignias, modo debug, elevación real LOLA, modelos GLB, respaldo 2D ilustrado, `npm run simulate` con 1000 partidas.

**Fuera:** multijugador, backend, cuentas.

## 5. Controles

`WASD`/flechas caminar · mouse mirar · `Espacio` saltar · `E` usar · `Tab` tablet · `Esc` pausa.
Sin mouse: todo el juego se puede completar desde la tablet con teclado.

## 6. Qué aprende el jugador

- La energía se guarda antes de la noche (baterías tienen límite).
- Las tormentas solares se esperan en un refugio.
- El agua y el aire se reciclan; el hielo lunar es un recurso.
- Cada número del juego dice de dónde sale y si es real o inventado.
