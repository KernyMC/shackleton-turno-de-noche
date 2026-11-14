---
paths:
  - "src/scene/**"
  - "public/models/**"
  - "public/textures/**"
---

# Reglas de la maqueta 3D

Referencia profunda: `docs/domains/escena.md`. Arte: `docs/ARTE.md` (obligatorio antes de cualquier trabajo visual).

- **La escena solo refleja estado y avisa de toques.** Nunca calcula reglas del juego. Lo que necesita lo recibe por la API de `World` desde los `effect` de `Scene.tsx`.
- **Movimiento con matemáticas** (`damp`, senos): ningún valor salta. Con `prefers-reduced-motion`, cambios directos y sin partículas.
- **Rendimiento**: recursos compartidos a nivel de módulo (geometrías, materiales), sin asignaciones por frame (`new`, `.clone()`), sin luces dinámicas por objeto, `castShadow` solo en lo grande, y coste ~0 cuando el efecto no se ve (`visible = false`). Todo sistema nuevo respeta los niveles de calidad (`setTier`).
- **Lo nuevo va en su propio archivo** (como `energyFlow.ts`, `stormFx.ts`); en `world.ts`, `Scene.tsx` y `base.ts` solo enganches mínimos y aditivos.
- **Luz**: Sol rasante y duro, sombras negras, relleno mínimo; el único color cálido es el ámbar de la base. Tormenta = violeta.
- **Tocar la maqueta es un atajo**, nunca la única vía: todo debe poder hacerse desde el panel.
- Texturas y modelos reales de NASA: con su fuente en `public/data/sources.json` y en los README. Sin logos de NASA.
- El visor embebido del asistente va a pocos fps y recorta `dt`: las animaciones se ven lentas ahí. Verifica con capturas y con `window.__renderer.info`, no con fps.

## Antes de dar por hecho un cambio (aristas)
Rendimiento (draw calls antes/después) · Niveles de calidad · Movimiento reducido · Sin WebGL (el juego sigue jugable) · Anclas 2D de la interfaz (`projectModule`: flotantes, burbuja de cosecha) · Móvil · Arte (`ARTE.md`) · `hud` y `qa` antes del commit.
