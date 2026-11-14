---
name: wrap-up
description: >-
  Cierra la sesión de trabajo actualizando la memoria del proyecto: reescribe docs/STATUS.md como tablero corto, registra las decisiones nuevas en DECISIONES.md, mantiene al día los documentos de dominio (docs/domains/) y el uso de IA, para que la próxima sesión sepa dónde quedó todo sin leer el código. Úsalo con /wrap-up, "cerremos", "terminamos por hoy" o cuando el usuario pida guardar el progreso.
---

# Cerrar la sesión

Hazlo en este orden. No hagas commit ni push sin que el usuario lo pida.

1. **Qué cambió.** Revisa `git status`, `git diff --stat`, `git log --oneline -15` y la conversación.

2. **Reescribe `docs/STATUS.md`** (reemplaza, no lo alargues; máximo ~60 líneas). Mantén estas secciones:
   - Encabezado: fecha, fase, hora de entrega si aplica y qué commit está en producción.
   - **Hecho**: lo terminado, una línea por cosa. Lo que lleva más de dos sesiones se resume en una línea.
   - **En curso**: lo que quedó a medias, con el archivo y el punto exacto. Incluye lo que está sin commit y lo que falta por verificar (`hud`, `qa`).
   - **Siguiente**: los próximos 3 pasos concretos.
   - **Bloqueos**: lo que no depende del código (decisiones del equipo, claves, entregables).
   - **Problemas conocidos**: deudas y trampas; apunta al documento de dominio en lugar de copiarlas.
   - **Notas para la próxima sesión**: comandos que hubo que correr y trampas descubiertas.

3. **Decisiones.** Cada decisión no prevista de la sesión va como una línea con fecha en `DECISIONES.md` (qué · por qué). Nunca se borra una: si cambia, se añade otra que diga «reemplaza a…».

4. **Documentos de dominio** (`docs/domains/`). Si cambió el comportamiento de un dominio, actualiza SOLO la sección afectada, sus invariantes, sus deudas y su tabla «si cambias X, revisa Y»:
   - `motor.md` — reglas, actos, eventos, balance, store.
   - `interfaz.md` — pantallas, zonas del HUD, apilado de avisos, textos, piel.
   - `escena.md` — maqueta 3D, cámara, efectos, rendimiento.
   - `datos.md` — datasets, proxy, rigor y limitaciones.

5. **Uso de IA.** Una línea en `AI_USAGE.md` por bloque de trabajo de la sesión (lo exige el reto).

6. **Reglas.** Si descubriste una regla que hay que seguir siempre, **propónla al usuario** para `CLAUDE.md` o `.claude/rules/` en vez de escribirla directo. Si es una preferencia de cómo trabajar con el usuario, guárdala en la memoria del asistente.

7. **Consistencia antes de cerrar.**
   - Cada agente de `.claude/agents/` tiene su fila en la tabla de ruteo de `CLAUDE.md`.
   - `README.md` y `README.en.md` dicen lo mismo; `docs/RUBRICA.md` refleja el estado real de las penalizaciones.
   - Ningún documento contiene claves ni secretos: el repositorio será público.
   - Si tocaste archivos con tildes, comprueba que no quedaron caracteres rotos (`Ã`, `â€`).
   - No quedan marcadores de conflicto (`<<<<<<<`, `>>>>>>>`) en ningún `.md`.

8. **Resumen al usuario**: 5 líneas y el diff de los documentos. Pregunta si quiere commit y despliegue.
