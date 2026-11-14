# Decisiones

Una línea por decisión que no estaba en los documentos. Formato: fecha · decisión · motivo.

- 2026-11-14 · El juego pasa de vista orbital a **primera persona**; la gestión se hace en una tablet de muñeca. · Pedido del equipo; hace el juego más memorable sin tocar las reglas del motor.
- 2026-11-14 · Toda acción física tiene un botón equivalente en la tablet. · Celular, teclado, sin WebGL y accesibilidad.
- 2026-11-14 · Datos NASA por **descarga previa a JSON**, nunca en vivo. · La demo no puede depender de la red ni de los límites de la API.
- 2026-11-14 · Alcance recortado a un MVP de 24–36 h con prioridades P0/P1/P2 (`docs/GDD.md`). · Tiempo de hackathon.
- 2026-11-14 · Los JSON de datos se importan de forma estática en `src/sim/config.ts` en vez de cargarse con `fetch`. · El motor funciona igual en navegador, tests y scripts; cambiar datos sigue siendo editar el JSON.
- 2026-11-14 · La clase de fulguración (M/X) se convierte a nivel S1–S4 del juego con una tabla propia marcada `game_balance`. · No son la misma escala; se declara en la ficha de fuente.
- 2026-11-14 · Íconos SVG propios en la interfaz; los emojis del documento original quedan solo para la bitácora. · Dirección de arte (`docs/ARTE.md` §8).
- 2026-11-14 · Exterior sin niebla y con estrellas solo en la noche lunar. · Fidelidad física: en la Luna no hay atmósfera.
- 2026-11-14 · Dos pestañas abiertas: la última que guarda gana, sin sincronizar. · Simplicidad.
- 2026-11-14 · Versiones instaladas: Astro 7, Preact 11, Three 0.187, Vitest 5. · Las últimas al crear el proyecto.
- 2026-11-14 · **Balance de Comandante cambiado respecto al documento original:** batería 100→120, batería inicial 70→80, soporte vital inicial 75→85, comida inicial 60→75, sol máximo 60→70. Cadete: comida inicial 70→80. · Con los valores originales la jugadora prudente ganaba 0 % en Comandante (la energía total no alcanzaba). Ahora: prudente 71,3 % Comandante y 100 % Cadete; todo al reciclador 0 %; aleatoria 0 %.
- 2026-11-14 · Un solo archivo `storms.json` (simulado hoy; `npm run fetch:nasa` lo reemplaza por datos reales). · Evita importar un archivo que puede no existir.
- 2026-11-14 · El taller nunca se avería; en Cadete tampoco el reciclador. · Sin taller no se puede reparar nada; el reciclador roto en Cadete llegaría a la noche lunar.
- 2026-11-14 · El aviso de noche es siempre el día 8. · El documento decía "día 8 o 9"; fijo es más simple.
- 2026-11-14 · Reparar y enviar el rover requieren que el plan del día dé ≥ 10 al taller; si no, la acción falla y queda en la bitácora. · Así la decisión tiene coste de energía real.
- 2026-11-14 · El margen para las estrellas no cuenta la batería. · Vaciar la batería en la noche lunar es jugar bien.
- 2026-11-14 · Eventos menores aleatorios e insignias quedan sin implementar (tarea A-06, P2). · Prioridad.

## Datos reales de NASA (14-11-2026)

- 2026-11-14 · **Proxy en Cloudflare Pages Functions** (`functions/api/spaceweather.ts`); la lógica vive en `src/server/spaceweather.ts` y en local la sirve `astro.config.mjs` con la clave de `.env`. · El proyecto aún no tenía plataforma de deploy; Cloudflare era la opción pedida.
- 2026-11-14 · **Mapeo DONKI → nivel de juego** (`src/data/donki.ts`, `game_balance`): fulguración C=1, M=2, X<5=3, X5+=4 (A y B se ignoran); CME por velocidad <700 km/s=1, 700–1200=2, 1200–2000=3, >2000=4 (se usa la velocidad del análisis marcado como más preciso; si no hay, la mayor); SEP=3. Nivel n → tormenta Sn del juego (dosis de `balance.json`). "Sol activo" = algún evento de nivel ≥ 2 en los últimos 7 días. · Pedido del equipo; no es una escala científica y la ficha lo dice.
- 2026-11-14 · **FLR (fulguraciones) da 404 en api.nasa.gov** con cualquier fecha (también GST); CME y SEP funcionan. El proxy usa los tipos que respondan y lista los fallidos en `failed`; solo es `fallback` si fallan todos. · El código ya soporta FLR: cuando NASA lo arregle, entra solo.
- 2026-11-14 · `storms_real.json` guarda solo eventos de **nivel ≥ 2** (492 de 1631 en 2024) y el conteo por nivel. · Las de nivel 1 no asustan y el JSON pasaba de 250 KB a 110 KB dentro del juego.
- 2026-11-14 · Caché del proxy: 1 h si hay datos, 5 min si es respaldo. · No gastar la cuota de la API y recuperarse rápido si DONKI vuelve.
- 2026-11-14 · Tiempo máximo: 5 s el proxy (las tres consultas en paralelo comparten el límite), 4 s el cliente. · Pedido del equipo.
- 2026-11-14 · Tormenta "en vivo": sustituye solo la primera tormenta de la partida; el resto de la partida es igual que sin ella (misma semilla). · Determinismo y balance.
- 2026-11-14 · Con tormentas reales el balance no cambió (prudente 71,3 % Comandante, 100 % Cadete; reciclador y aleatoria 0 %). · Comprobado con `npm run simulate`.
- 2026-11-14 · Terreno real: reproyección azimutal del casquete polar sur (6°, ~180 km de radio) a 2048 px; escala horizontal comprimida y altura exagerada; disco de la base aplanado. · El juego mide 200 m; la ficha de fuente lo explica.
- 2026-11-14 · Modelos: Apollo Lunar Module (lander) y Space Exploration Vehicle (rover) de NASA 3D Resources. · No hay un rover lunar tipo LRV en GLB en ese repo.

## Valores del BVAD por completar (tarea 6)

El juego usa una escala de 0 a 100 % para soporte vital y comida. Para que sea `verified`, hace falta el
valor real del **NASA Life Support Baseline Values and Assumptions Document (BVAD)** y su página. Pega el
valor y la página en las columnas vacías; después se actualiza `balance.json` (`status: "verified"`), se
corre `npm run simulate` y se ajustan **solo** los factores de escala del juego para mantener el balance.

| Concepto | Dónde está en `balance.json` hoy | Valor en el juego hoy | Valor BVAD (por persona y día) | Edición y página del BVAD |
|---|---|---|---|---|
| Consumo de oxígeno | `crewConsumption.lifeSupportPerPerson` (aire + agua juntos) | 2,5 % del tanque por persona y día | | |
| Consumo de agua potable | `crewConsumption.lifeSupportPerPerson` (aire + agua juntos) | (incluido arriba) | | |
| Agua de higiene (si se usa) | (no existe todavía) | — | | |
| Comida (masa o energía) | `crewConsumption.foodPerPerson` | 1,5 % de la despensa por persona y día | | |
| Eficiencia de recuperación de agua del reciclador | `effects.recyclerLifeSupport` (indirecto) | +14 por día al 100 % | | |
| Agua que consume el invernadero | `effects.greenhouseWaterCost` | 2 por día al 100 % | | |

Cuando haya valores, la idea es: tamaño del "100 %" del tanque = N días de consumo real de 4 personas
(factor de escala, `game_balance`), y el consumo diario sale del BVAD (`verified`).
