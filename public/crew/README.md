# Fotos de la tripulación (opcional)

Si no hay fotos, el juego usa el retrato dibujado (casco). Para poner caras reales del equipo:

1. Una foto por tripulante: `valeria.png`, `mateo.png`, `amaru.png`, `lucia.png`.
2. Formato: PNG cuadrado de 512×512 px, con la cara centrada. Solo con el permiso de la persona.
3. Agrega los ids que ya tienen foto a la lista `crew` de `public/optional-assets.json`, por ejemplo:
   `"crew": ["valeria", "mateo"]`. Así el juego no pide archivos que no existen.
4. Otra ruta o nombre de archivo: ponla en el campo `photo` de ese tripulante en `src/data/crew.json`.

Para cambiar los nombres, edita SOLO `src/data/crew.json` (`name` es el nombre corto y `fullName` el completo).
Los roles y las frases siguen en `src/i18n/es.json` y `en.json`.
