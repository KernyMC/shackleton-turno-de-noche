---
paths:
  - "src/components/**"
  - "src/styles/**"
  - "src/i18n/**"
  - "src/app/**"
  - "src/pages/**"
  - "src/audio/**"
  - "src/state/rewards.ts"
  - "src/state/tutorial.ts"
  - "src/state/acts.ts"
  - "src/state/mode.ts"
  - "src/dev/hudCheck.ts"
---

# Reglas de la interfaz

Referencia profunda: `docs/domains/interfaz.md` (mapa de zonas del HUD, apilado de avisos, z-index, hojas de estilo).

- **La UI solo lee estado y llama acciones** de `src/state/store.ts`. Las reglas del juego viven en el motor.
- **Ningún texto visible en componentes.** Todo en `src/i18n/es.json` y `en.json`, las dos a la vez. Para niños de 7–12 años: frases de 12 palabras o menos, una idea por frase, sin jerga.
- **Diseño de juego, no de aplicación** (regla 13, `docs/ARTE.md` §8b): piel «Consola de misión Apolo» en `src/styles/skin.css`. Paneles opacos con borde de 2 px y sombra dura; botones que se hunden; Barlow Condensed (rótulos) y B612 (texto y números). Prohibido: `backdrop-filter`, pastillas blandas, sombras difusas, emojis como ilustración, logos de NASA.
- **Nada se pisa.** Un bloque flotante nuevo: (1) elige su zona en el mapa de `docs/domains/interfaz.md`, (2) entra en el apilado de avisos de `src/styles/acts.css` si va arriba al centro, (3) añade su selector a `BLOCKS` en `src/dev/hudCheck.ts`, (4) pruébalo en 1600×900, 1280×720, 1024×700 y 375×812.
- **Todo se puede hacer desde el panel**, con teclado y en móvil; el estado nunca se dice solo con color (ícono + palabra); botones de 40 px o más en móvil; respeta `prefers-reduced-motion`.
- **Los avisos no interrumpen**: nada encima de un evento pendiente; una voz de tripulación por día como mucho; durante el avance rápido no hay flotantes ni hitos.
- CSS de un componente nuevo en su propio archivo con prefijo propio; `global.css` solo para lo compartido.
- **Antes del commit: agente `hud` (regla 10) y agente `qa` (regla 11).**

## Antes de dar por hecho un cambio (aristas)
Zonas y solapes (`__hudCheck()`) · Móvil 375 px · Teclado y Esc · ES y EN (y largo del texto) · Piel de juego · Tutorial y onboarding (¿siguen señalando algo que existe?) · Sin 3D · Rúbrica 4.2 y 3.5.
