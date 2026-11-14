# Área E — Entrega

## E-01 · Repositorio y deploy (P0)

Repo: https://github.com/KernyMC/shackleton-turno-de-noche (privado; hecho).
Falta:
1. Invitar al equipo: GitHub → Settings → Collaborators.
2. Deploy: importar el repo en Vercel o Cloudflare Pages. Framework Astro, comando `npm run build`, carpeta de salida `dist`, Node 22+. Cada push a `main` publica.
3. Probar la URL pública en un celular y en un portátil.
4. **Antes de entregar:** confirmar en las reglas de Space Apps si el repositorio debe ser público y, si es así, cambiar la visibilidad (decisión de una persona del equipo, no de un agente).

## E-02 · Prueba de juego (P1) — tras el hito de la hora 14

Dos personas que no programaron juegan sin ayuda; anotar dónde dudan en los primeros 30 s.
Checklist (marcar en este archivo):
- [ ] Partida ganada y perdida en Cadete y en Comandante
- [ ] Aparecen tormenta, avería, hielo y aviso de noche, con sus consecuencias
- [ ] La noche lunar se nota en el visor, en la escena y en la batería
- [ ] Partida completa solo con teclado
- [ ] 320 px de ancho sin scroll horizontal
- [ ] Inglés sin textos cortados
- [ ] Consola del navegador sin errores
- [ ] Chrome y Firefox (Safari si hay un Mac)
- [ ] Doble clic en "Ejecutar día" avanza un solo día
- [ ] Recargar en mitad de un evento y "Continuar": el evento sigue pendiente

## E-03 · Video y página del proyecto (P0) — tras el hito de la hora 24

- Revisar en las reglas del reto la duración máxima del video y los campos obligatorios.
- Guion: 0–5 s la base de noche con su luz ámbar; 5–20 s un día (tablet, luces que responden); 20–40 s una tormenta y la carrera al refugio; 40–55 s debrief con la gráfica y un dato NASA; cierre con el nombre del equipo.
- Página del proyecto: qué es, cómo responde al reto, datos NASA usados (copiar de `sources.json`), uso de IA (copiar de `AI_USAGE.md`), enlaces a demo y repo.

## E-04 · Documentos finales (P0)

- `README.md`: actualizar "Estado actual" y añadir la URL de la demo.
- `CREDITS.md`: nombres del equipo, cada fuente de datos con su estado real, cada asset externo con licencia.
- `AI_USAGE.md`: una línea por sesión de trabajo con IA.
- Revisión final: ningún logo ni insignia de NASA; aviso de no afiliación visible en el menú; ningún `verified` sin URL; `npm test`, `npm run check` y `npm run build` limpios.
