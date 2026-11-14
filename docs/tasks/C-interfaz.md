# Área C — Interfaz (`src/components`, `src/state`, `src/i18n`, `src/styles`, `src/app`)

Spec: `docs/specs/03-interfaz-y-estado.md`. Estilo: `docs/ARTE.md` §3 y §8. Pantallas en detalle:
`docs/specs/00-documento-original.md` §7–12. Ningún texto fuera de `i18n`.

## C-01 · Store y bucle del día (P0)
- **Depende de:** A-01 (mientras llega, usa un `runDay` falso dentro del store).
- **Hacer:** signals y acciones de la spec. `executeDay` → `resolving` 1,5 s → resumen → evento o siguiente día → debrief al terminar. Una sola ejecución aunque se pulse dos veces.
- **Hecho cuando:** se pueden pasar 30 días desde la consola del navegador llamando a las acciones.

## C-02 · Visor de casco (P0)
- 4 indicadores (energía, soporte vital, comida, dosis) + día. Ícono SVG + valor + barra + estado en texto + tendencia. `role="progressbar"`.

## C-03 · Tablet: planificador (P0)
- Energía disponible con desglose, 4 sliders (se detienen en el máximo posible), barra de presupuesto con aviso de desperdicio, vista previa en vivo, presets (repetir, ahorro, cero), "Ejecutar día" (también con Enter). Módulo roto: bloqueado y rotulado.
- **Hecho cuando:** se usa entero con teclado y se ve bien a 320 px de ancho.

## C-04 · Panel de evento (P0)
- **Depende de:** C-03, A-03. Dentro de la tablet: texto, opciones con consecuencia ("Dosis estimada: +X mSv"), razón si está deshabilitada, teclas `1`/`2`, botón bloqueado tras elegir.

## C-05 · Resumen del día y debrief básico (P0)
- Resumen: "Día N completado" + 3 cambios. Debrief: título, causa en una frase amable, estrellas, "Jugar de nuevo" y "Menú".

## C-06 · Menú y dificultad (P0)
- Título, subtítulo, dos tarjetas de dificultad con 3 diferencias cada una, idioma, aviso de no afiliación. La escena de fondo llega después.

## C-07 · Pronóstico (P1) · C-08 · Ficha de fuente (P1) · C-09 · Debrief completo (P1)
- Franja de 5 días con la noche marcada y aviso narrativo. Ficha con estado verificado/simulado/diseño y enlace. Gráfica SVG a mano (líneas con patrón distinto, noche sombreada, tormentas marcadas, tabla alternativa), línea de tiempo de decisiones, tarjetas "Así lo resuelve una misión real", copiar resultado.

## C-10 · Guardado, ajustes, pausa, inglés (P1)
- `localStorage` con validación y try/catch; "Continuar" solo si hay partida válida. Ajustes: idioma, sonido, calidad, movimiento reducido. Revisar que el inglés no desborde botones.

## C-11 · Tutorial, bitácora, créditos, debug (P2)
