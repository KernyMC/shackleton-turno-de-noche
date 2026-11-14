---
paths:
  - "public/data/**"
  - "scripts/**"
  - "api/**"
  - "functions/**"
  - "src/server/**"
  - "src/data/**"
  - "README.md"
  - "README.en.md"
  - "CREDITS.md"
  - "AI_USAGE.md"
---

# Reglas de datos y rigor científico

Referencia profunda: `docs/domains/datos.md`. Rúbrica: `docs/RUBRICA.md` (área RCD y las penalizaciones 1, 5 y 6).

- **Nunca inventes cifras, citas ni URLs** de NASA ni de ninguna agencia. Lo que no se pudo comprobar descargándolo queda `simulated`. Cada dato lleva su `status`: `verified`, `simulated` o `game_balance`.
- **La clave `NASA_API_KEY` (y cualquier otra) nunca va al navegador, al repo, a los logs ni al chat.** Vive en `.env` (local) y en las variables de Vercel. No se lee ni se imprime.
- **El juego funciona sin red.** Los datos se descargan una vez con un script y se guardan como JSON en `public/data/`. La única llamada en vivo es el proxy `/api/spaceweather`, opcional y con respaldo. No presentes datos guardados como si fueran en vivo.
- **Un dataset nuevo no está integrado hasta que**: tiene su script reproducible, su JSON con `status` y URL, su ficha en `public/data/sources.json`, su fila en `README.md` **y** `README.en.md`, y su crédito en `CREDITS.md`.
- **La historia es ficción; los datos son reales.** Nada de la ficción se presenta como ciencia (rúbrica 1.2).
- Agencias aliadas (p. ej. CSA) se atribuyen con su nombre, no como NASA.
- Sin logos de NASA. El uso de IA se declara en `AI_USAGE.md` (una línea por bloque de trabajo).
- La documentación de cara al jurado va en español e inglés.

## Antes de dar por hecho un cambio (aristas)
Fuente comprobada y enlazada · `status` honesto · Sin red · Clave a salvo · Panel de fuentes del juego · README ES y EN · CREDITS · Limitaciones que habrá que explicar en las preguntas del jurado (rúbrica 1.4).
