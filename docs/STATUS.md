# Estado

> Tablero corto de la memoria del proyecto. **Se reescribe (no se alarga) al cerrar cada sesión**
> con la skill `/wrap-up`. Máximo ~60 líneas. Lo profundo vive en `docs/domains/`.

**Última actualización:** 2026-11-14 (sábado, tarde) · **Fase:** hackathon, víspera de la entrega ·
**Entrega:** domingo 15-nov a las **09:00** (auditoría 09:30, pitch 11:00; ver `docs/RUBRICA.md`) ·
**Producción:** https://shackleton-turno-de-noche.vercel.app (publica el v4 Paso 1 con modo Tutorial y piel de juego).

## Hecho
- Juego completo y jugable: motor de 30 días, maqueta 3D, panel de energía, eventos, tripulación, final con cinemática; español e inglés; proxy de clima espacial con datos reales de NASA DONKI.
- Datos reales: DONKI, RadLab, OSDR, Blue Marble, CSA; panel «¿De dónde salen los datos?».
- Mejoras v2 (bloques A, C y D1–D3).
- **v4 Paso 1 completo** (motor, interfaz y escena): 5 actos, tarjeta y meta de acto, candados, eventos por acto, polvo en los paneles, avance rápido, módulos en obras, globos de tripulación.
- **Tres modos**: Tutorial (guiado, semilla fija), Cadete y Comandante.
- **Piel de juego** «Consola de misión Apolo» (`src/styles/skin.css`, B612 + Barlow Condensed auto-alojadas) y HUD sin solapes en 1280×720, 1024×700 y 375×812 (`__hudCheck()` en verde).
- README ES/EN, CREDITS, LICENSE (MIT), fuentes con estado honesto; reglas 10–13; agentes `hud`, `qa`, `psicologia-infantil`; test guardián de textos (184 tests).
- Memoria del proyecto: este archivo, `docs/domains/`, `.claude/rules/`, skills `/wrap-up` y `/fix`.

## En curso
- Nada a medias. El equipo prueba el Paso 1 antes de seguir.

## Siguiente
1. v4 Paso 2 (historia de la Flota e intro ≤ 20 s): decidir antes con la rúbrica (ver Bloqueos).
2. v4 Pasos 3–6 solo si queda tiempo: menos texto, eventos con ✅/❌, badges que no interrumpen.

## Bloqueos (dependen del equipo, no del código)
- **Hacer público el repositorio de GitHub** (hoy privado: −2 y −1 en la auditoría).
- **Diapositivas (máx. 7), video (máx. 30 s) y ficha bilingüe** en la plataforma.
- **ElevenLabs**: la clave no tiene el permiso *Sound Generation*; hasta entonces suenan efectos sintetizados (`npm run sfx` está listo).
- **Historia de la IA (v4 Paso 2)**: la rúbrica 1.2 castiga las «premisas pseudocientíficas»; debe quedar marcada como ficción y fuera del núcleo del pitch.

## Problemas conocidos
- La estrategia prudente gana el 100 % en Comandante: puede quedar fácil (ajustar niveles de tormenta en `balance.json`).
- Sin medir fps en un equipo lento real; sin probar reduced motion ni el modo sin WebGL de punta a punta.
- El visor embebido del asistente va a pocos fps: las animaciones se ven a cámara lenta ahí, no en un navegador normal.
- Detalle por dominio: `docs/domains/motor.md`, `interfaz.md`, `escena.md`, `datos.md`.

## Notas para la próxima sesión
- **Nunca subir una parte del juego sin la otra**: el 14-nov se subió el evento de polvo sin sus textos y en pantalla salió `event.dust.title`.
- Varios agentes a la vez: cada uno con archivos distintos; los textos de `src/i18n/*.json` se añaden con un script Node de una pasada (leer → `Object.assign` → escribir).
- Con agentes editando, el dev server recarga y el build puede fallar a medias: verificar al final, con el árbol estable.
- Desplegar: `npx vercel deploy --prod --yes` desde un árbol limpio (proyecto `shackleton-turno-de-noche`, scope `kernymcs-projects`).
- Dos agentes con navegador a la vez: uno en `http://localhost:4321` y otro en `http://[::1]:4321` (Astro no deja abrir un segundo servidor).
- `__hudCheck()` da falsos «tapado por» mientras está el cargador o durante la transición del panel: esperar a que terminen.
- Commits sin firma de IA (regla 8). Christopher también sube commits: `git pull --rebase --autostash` antes de cada commit.
