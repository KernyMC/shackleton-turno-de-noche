# Guía para asistentes de IA del equipo: trabajar y hacer push

Para el asistente de IA de cada compañero (Claude Code, Codex, Cursor, Gemini CLI…). Léela entera antes
de tocar nada. Las reglas del proyecto mandan sobre esta guía: `CLAUDE.md`, `docs/NORTE.md`, `docs/ARTE.md`.

Repositorio: https://github.com/KernyMC/shackleton-turno-de-noche (privado). Rama de trabajo: `main`.

## 1. Primera vez: dejar el equipo listo

Requisitos: Git y Node.js 22 o superior.

1. **Acceso al repo.** La persona debe estar invitada como colaboradora (GitHub → Settings → Collaborators; la invitación la manda Kevin). Si no puedes clonar, pide a la persona que acepte la invitación en su correo.
2. **Iniciar sesión en GitHub desde la terminal** (una sola vez; la persona completa el navegador, tú nunca escribes ni guardas contraseñas ni tokens):

```bash
gh auth login
```

   Sin `gh`, sirve el Administrador de credenciales de Git: el primer `git push` abre el navegador.
3. **Clonar e instalar:**

```bash
git clone https://github.com/KernyMC/shackleton-turno-de-noche.git
```

```bash
cd shackleton-turno-de-noche
```

```bash
npm install
```

4. **Identidad de git (solo del repo, con el nombre y correo reales de la persona):**

```bash
git config user.name "Nombre Apellido"
```

```bash
git config user.email "correo-de-su-github@example.com"
```

   Con GitHub conviene el correo `ID+usuario@users.noreply.github.com` (GitHub → Settings → Emails).
5. **Variables de entorno:** copia `.env.example` a `.env` y rellena lo que necesites.

```bash
cp .env.example .env
```

   - `NASA_API_KEY`: clave gratis en https://api.nasa.gov. Sin ella el juego usa tormentas históricas.
   - `BLENDER` y `COMFYUI_URL`: solo si vas a hacer modelos 3D (opcional).
   - **`.env` nunca se sube** (está en `.gitignore`). No copies claves a ningún otro archivo, mensaje de commit ni documento.
6. **Comprobar que todo funciona:**

```bash
npm test && npm run check && npm run build
```

## 2. Cada tarea (ciclo de trabajo)

1. `git pull --rebase` antes de empezar.
2. Elige una tarea `libre` de `docs/tasks/TABLERO.md` con dependencias `hecha`. Pon el nombre de la persona y `en curso`; haz commit y push **solo de ese archivo** antes de empezar.
3. Trabaja solo en las carpetas de tu área (tabla del tablero). Contratos compartidos (`src/sim/types.ts`, `src/state/store.ts`): avisa a la persona antes de cambiarlos.
4. Antes de cada commit: `npm test && npm run check && npm run build`. Si algo falla, no hagas commit: arréglalo o dilo.
5. Marca `hecha` en el tablero. Decisión no prevista: una línea en `DECISIONES.md`. Uso de IA: una línea en `AI_USAGE.md`. Asset externo: `CREDITS.md`.

## 3. Hacer push sin romper nada

```bash
git status
```

```bash
git add src/components/Visor.tsx docs/tasks/TABLERO.md
```

```bash
git commit -m "C-02: visor de casco con barras de aire y agua"
```

```bash
git pull --rebase
```

```bash
git push
```

Reglas de push:

- **Añade archivos por nombre**, no con `git add .` ni `git add -A`: así no se cuelan `.env`, capturas ni archivos de otra persona.
- **Commits pequeños, mensaje en español**, con el ID de tarea: `A-01: runDay con producción y consumo`.
- **Sin autoría de IA en commits ni PRs** (regla 8 de `CLAUDE.md`): nada de `Co-Authored-By: …`, "Generated with …" ni firmas de un modelo, y la persona sigue como autora y committer. Si tu herramienta añade esas líneas por defecto, quítalas antes de confirmar. El uso de IA se declara solo en `AI_USAGE.md`.
- **Si `git push` es rechazado:** `git pull --rebase`, resuelve conflictos conservando el trabajo de las dos partes, vuelve a correr los tests y empuja de nuevo.
- **Nunca** uses `git push --force`, `git reset --hard` ni borres ramas sin que la persona lo pida con esas palabras.
- **Nunca** subas `.env`, claves, tokens, `node_modules/` ni `dist/`. Si subiste una clave por error, avisa de inmediato: hay que **revocarla** en el servicio; borrarla del historial no basta.
- Archivos grandes (modelos, imágenes): GLB de menos de 2 MB y texturas de 1024 px como máximo.

## 4. Si te falta algo

- Sin contexto de sesiones anteriores: empieza por `docs/tasks/TABLERO.md`, sección "Siguiente paso recomendado".
- Datos: no inventes cifras, citas ni URLs de NASA. Lo que no puedas comprobar queda `simulated`.
- Duda no resuelta por los documentos: elige lo más simple que respete `docs/GDD.md` y `docs/ARTE.md`, y anótalo en `DECISIONES.md`.
- Modelos 3D con IA local (opcional): `scripts/README-ia3d.md`.
