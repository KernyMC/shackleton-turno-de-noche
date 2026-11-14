# Estado

> Tablero corto de la memoria del proyecto. **Se reescribe (no se alarga) al cerrar cada sesión**
> con la skill `/wrap-up`. Máximo ~60 líneas. Lo profundo vive en `docs/domains/`.

**Última actualización:** 2026-11-14 (sábado, 16:30) · **Fase:** hackathon, víspera de la entrega ·
**Entrega:** domingo 15-nov a las **09:00** (auditoría 09:30, pitch 11:00; ver `docs/RUBRICA.md`) ·
**Producción:** https://shackleton-turno-de-noche.vercel.app (commit `cd70142`: v4 Paso 1, modo Tutorial y piel de juego. **No incluye** el cómic ni los retos).

## Hecho
- Juego completo y jugable: motor de 30 días, maqueta 3D, panel de energía, eventos, tripulación, final con cinemática; ES/EN; proxy de clima espacial con datos reales de NASA DONKI.
- Datos reales (DONKI, RadLab, OSDR, Blue Marble, CSA) y panel «¿De dónde salen los datos?»; README ES/EN, CREDITS, LICENSE (MIT).
- v4 Paso 1 (5 actos, candados, polvo, avance rápido), tres modos (Tutorial, Cadete, Comandante) y piel «Consola de misión Apolo».
- Memoria del proyecto: este archivo, `docs/domains/`, `.claude/rules/`, skills `/wrap-up` y `/fix`.

## En curso — TODO SIN COMMIT (tareas H-01, H-02, H-03 del tablero)
- **Intro en cómic** tras «Comenzar» (`IntroComic.tsx`, `comic.css`, paso `comic` en `Menu.tsx`): 5 viñetas SVG, historia realista 2048. Sustituye a la «historia de la IA».
- **Retos diarios**: 10 minijuegos en los días 2, 4, 6, 8, 12, 14, 16, 18, 24 y 30 (`public/data/challenges.json`, `src/sim/challenges.ts`, `src/components/challenges/`, `challenge.css`). Premio y castigo desde el JSON; el Tutorial no tiene retos.
- Verificado con el árbol estable antes de los últimos arreglos: 205 tests, `check`, `build`; simulador con la prudente al 100 % / 99,9 %. Tras los arreglos de lógica: 209 tests y `check` (informe del builder; **falta repetir `build` y `simulate`**).
- Revisiones: `verificador` sin bloqueantes; `qa` apto con reservas; **`hud` NO APTO en 375×812** (días 16, 18, 24 y 30; colores de cables del día 8).
- **A medias al cerrar:** un builder corregía `challenge.css`, `comic.css`, `IntroComic.tsx` (móvil de los días 16/18/24/30, colores del día 8, viñetas 3 y 5). No se sabe si terminó: revisar `git diff` de esos archivos.

## Siguiente
1. Con el árbol quieto: `npm test && npm run check && npm run build && npm run simulate`.
2. Volver a pasar `hud` (375×812 y 1280×720: días 8, 16, 18, 24, 30 y cómic; inglés) y `qa` rápido (día 24 con las dos elecciones, día 30 con movimiento reducido). Estilizar `chl-sector-fx*` y `chl-relay-nudge/up/down` si se ven mal.
3. Si sale APTO: commit (motor + interfaz + textos juntos), marcar H-01..H-03 `hecha`, desplegar con `npx vercel deploy --prod --yes`. **Corte duro 05:00**: el reto que no esté verde se quita de `challenges.json`.

## Bloqueos (dependen del equipo, no del código)
- **Hacer público el repositorio de GitHub** (hoy privado: −2 y −1 en la auditoría).
- **Diapositivas (máx. 7), video (máx. 30 s) y ficha bilingüe** en la plataforma.
- **ElevenLabs**: la clave no tiene el permiso *Sound Generation*; suenan efectos sintetizados.

## Problemas conocidos
- README ES/EN y `docs/RUBRICA.md` aún no mencionan el cómic ni los retos.
- Glosario de 4 conceptos (noche lunar, dosimetría, regolito, sombra permanente) no hecho.
- `hud` no revisó la mayoría de los retos en inglés ni en 1600×900 / 1024×700; nadie probó sin WebGL ni una partida Comandante completa con retos.
- `qa` vio una vez la escena en negro con calidad `low` tras muchos reinicios (sin confirmar).
- Las fugas del día 6 y los mapas de los retos son fijos: se pueden memorizar.
- La prudente gana ~100 % también en Comandante. Detalle: `docs/domains/motor.md` §11 y §13, `interfaz.md` §13.

## Notas para la próxima sesión
- **Nunca subir una parte del juego sin la otra** (motor + interfaz + textos en el mismo commit).
- `package-lock.json` está en staging por un cambio ajeno: hacer commit con rutas explícitas (`git commit --only …`) o revisarlo antes.
- El tipo de agente `qa` no cargó en la sesión: se usó un agente general que sigue `.claude/agents/qa.md`.
- Varios agentes a la vez: archivos distintos; `src/i18n/*.json` y `challenges.json` con script Node de una pasada (conservan CRLF). No editar mientras `hud`/`qa` juegan: el dev server recarga y pierden la partida.
- Dos agentes con navegador: uno en `http://localhost:4321` y otro en `http://[::1]:4321`. Redimensionar la ventana no cambia el viewport: usar un iframe del tamaño exacto.
- Consola (DEV): `__store.startGame('cadete', 7)`, `executeDay()`, `chooseEventOption(id)`, `activeChallenge.value`, `completeChallenge('perfect'|'partial'|'failed'|'skipped', opción?)`.
- `__hudCheck()` ignora el HUD de detrás cuando hay `.chl-overlay` o `.comic-page`.
- Commits sin firma de IA (regla 8); `git pull --rebase --autostash` antes de cada commit.
