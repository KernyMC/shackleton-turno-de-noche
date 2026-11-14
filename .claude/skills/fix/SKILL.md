---
name: fix
description: >-
  Arregla un fallo del juego de punta a punta: clasifica el dominio (motor, interfaz, escena, datos), lo reproduce, delega al builder con el documento de dominio correcto, verifica con tests/check/build, pasa las revisiones obligatorias (hud si toca interfaz, qa siempre) y deja en docs/STATUS.md lo que quede pendiente. Úsalo con /fix <síntoma> o cuando el usuario reporte un bug, error, "no funciona", "se rompió", "se ve mal" o mande una captura de algo roto.
argument-hint: <síntoma, texto exacto en pantalla, día y semilla, o pasos para reproducir>
---

# /fix — arreglar un fallo con su dominio

Síntoma recibido: $ARGUMENTS

Tu trabajo es clasificar, reproducir, delegar, verificar y revisar. Sigue los pasos en orden.

## 1. Entender
Necesitas el síntoma, dónde ocurre (pantalla, día, modo, tamaño de ventana) y el texto literal o la captura. Si falta algo sin lo cual no puedes clasificar, haz UNA pregunta corta; si no, sigue.

## 2. Clasificar el dominio
| Si el síntoma toca… | Dominio | Lee antes |
|---|---|---|
| Un número que no cuadra, un día que no avanza, un evento que no aparece o hace otra cosa, una opción sin efecto, victoria/derrota mal, balance, avance rápido que no para (`src/sim`, `src/state/store.ts`, `public/data/balance.json`) | Motor | `docs/domains/motor.md` |
| Texto con forma de clave (`algo.clave`), elementos encimados, botón tapado o que no responde, panel que no cierra, tutorial atascado, móvil roto, aviso que no sale o no se va (`src/components`, `src/styles`, `src/i18n`, `src/state/{rewards,tutorial,acts,mode}.ts`) | Interfaz | `docs/domains/interfaz.md` |
| La maqueta no se ve o va lenta, cámara rara, un efecto que no aparece, astronautas mal colocados, luz u oscuridad (`src/scene`) | Escena | `docs/domains/escena.md` |
| Fuente o dato dudoso, el proxy de clima espacial, «Sol de hoy», panel de fuentes, README (`public/data`, `scripts`, `api`, `src/server`) | Datos | `docs/domains/datos.md` |

- Un fallo que cruza dominios se parte en tareas **secuenciales** (primero el motor, después la interfaz); nunca dos agentes sobre los mismos archivos a la vez.
- Si no sabes si es un fallo o es así por diseño, búscalo en `docs/GDD.md`, `DECISIONES.md` y el documento de dominio antes de tocar nada; si sigue la duda, pregunta.

## 3. Reproducir
Antes de delegar, reprodúcelo (navegador con `window.__store`, o un test). Anota semilla, día y pasos. Si no se reproduce, dilo y pide más datos: no adivines un arreglo.

## 4. Delegar
Llama al agente `builder` con un encargo autocontenido: síntoma, pasos para reproducir, el documento de dominio que debe leer primero, los archivos que puede tocar y los que no, y que añada un **test que falle antes y pase después** cuando el fallo sea del motor, del store o de textos. Pide respuesta en 10 líneas: causa, archivos, tests.

## 5. Verificar tú mismo
No te fíes del resumen. Ejecuta `npm test`, `npm run check` y `npm run build` (y `npm run simulate` si se tocó el motor o el balance). Revisa con `git diff` que no se borró ni se desactivó ningún test.

## 6. Revisión obligatoria
- Agente `hud` si se tocó `src/components`, `src/styles` o textos (regla 10).
- Agente `qa` siempre (regla 11), diciéndole qué flujo se arregló para que lo pruebe primero.
- `verificador` si el cambio es grande o toca varias carpetas.
Si hay hallazgos, devuélvelos al mismo builder y repite 5 y 6. Máximo 3 vueltas; si sigue sin cerrar, informa al usuario con lo que queda.

## 7. Cerrar
- Si queda algo pendiente, 1 o 2 líneas en `docs/STATUS.md`.
- Si el documento de dominio estaba mal o incompleto, corrige la sección afectada y, si aplica, su tabla «si cambias X, revisa Y».
- Si el fallo se pudo colar por falta de una comprobación, propón el test o la regla que lo habría detenido.
- No hagas commit ni push sin que el usuario lo pida.

## 8. Informar al usuario (8 líneas como máximo)
Causa · qué cambió (archivos) · tests añadidos y resultados · revisiones y su resultado · pendientes · pregunta de commit.
