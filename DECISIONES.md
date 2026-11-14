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
