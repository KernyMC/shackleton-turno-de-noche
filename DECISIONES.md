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
