# Texturas generadas por código (sin archivos externos) para los modelos de la base:
# paneles acolchados con juntas y remaches, polvo lunar acumulado abajo, metal cepillado,
# lámina dorada arrugada, tela de saco y regolito. Cada una trae color y mapa de relieve.
# Todas son repetibles sin costura. Las usa scripts/blender/build_models.py.

import os
import tempfile

import bpy
import numpy as np

SIZE = 512
CELL = 64  # tamaño de un panel en píxeles
TMP = tempfile.mkdtemp(prefix="halosur_tex_")

_Y, _X = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)


def _blur(a, times):
    """Desenfoque que respeta los bordes repetibles (usa desplazamientos circulares)."""
    for _ in range(times):
        a = (a + np.roll(a, 1, 0) + np.roll(a, -1, 0) + np.roll(a, 1, 1) + np.roll(a, -1, 1)) / 5.0
    return a


def _norm(a):
    return (a - a.min()) / max(1e-6, a.max() - a.min())


def _noise(seed, blur=0):
    return _norm(_blur(np.random.default_rng(seed).random((SIZE, SIZE), dtype=np.float32), blur))


def _blotches(seed, cells=8):
    """Manchas grandes y suaves."""
    small = np.random.default_rng(seed).random((cells, cells), dtype=np.float32)
    return _norm(_blur(np.kron(small, np.ones((SIZE // cells, SIZE // cells), dtype=np.float32)), 40))


def _normal_map(height, strength):
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    length = np.sqrt(dx * dx + dy * dy + 1.0)
    return np.dstack([-dx / length * 0.5 + 0.5, -dy / length * 0.5 + 0.5, 1.0 / length * 0.5 + 0.5])


def _tint(gray, color):
    return np.dstack([gray * color[0], gray * color[1], gray * color[2]])


def _save(name, rgb, non_color=False):
    image = bpy.data.images.new(name, SIZE, SIZE, alpha=False)
    rgba = np.dstack([np.clip(rgb, 0, 1), np.ones((SIZE, SIZE), dtype=np.float32)]).astype(np.float32)
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = os.path.join(TMP, f"{name}.png")
    image.file_format = "PNG"
    image.save()
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    return image


def _panel_layout():
    """Juntas, remaches y acolchado de un casco de paneles."""
    xm, ym = _X % CELL, _Y % CELL
    groove = ((xm < 2) | (ym < 2)).astype(np.float32)
    # Remaches a ambos lados de cada junta, cada 16 píxeles.
    d_vertical = np.hypot(np.minimum(np.abs(xm - 7), np.abs(xm - (CELL - 6))), np.abs(_Y % 16 - 8))
    d_horizontal = np.hypot(np.minimum(np.abs(ym - 7), np.abs(ym - (CELL - 6))), np.abs(_X % 16 - 8))
    rivet = np.exp(-((np.minimum(d_vertical, d_horizontal) / 1.7) ** 2))
    quilt = (np.sin(np.pi * xm / CELL) * np.sin(np.pi * ym / CELL)) ** 0.55
    return groove, rivet, quilt


def _hull(name, color, dusty):
    groove, rivet, quilt = _panel_layout()
    fine = _noise(1, 1)
    wear = _blotches(2)
    grime = _norm(_blur(groove, 6))
    # Arrugas suaves de la tela aislante.
    wrinkles = _noise(3, 5)
    shade = 0.93 + 0.08 * wear + 0.035 * (fine - 0.5) + 0.05 * (quilt - 0.5) - 0.07 * (wrinkles - 0.5)
    shade = shade * (1 - 0.5 * groove) * (1 - 0.16 * grime) * (1 - 0.18 * rivet)
    rgb = _tint(shade, color)
    if dusty:
        # Polvo lunar gris que sube desde abajo (la fila 0 de la imagen es la base del objeto).
        # En los cilindros de Blender, la pared ocupa la mitad superior de la textura (v de 0,5 a 1)
        # y las tapas la inferior: el polvo se calcula sobre esa mitad y no toca las tapas.
        v = np.where(_Y / SIZE >= 0.5, (_Y / SIZE - 0.5) * 2.0, 1.0)
        amount = np.clip((0.38 - v) / 0.38, 0, 1) ** 1.3 * (0.55 + 0.45 * _blotches(5, 16))
        dust = _tint(0.50 + 0.10 * fine, (1.0, 0.985, 0.96))
        rgb = rgb * (1 - amount[..., None]) + dust * amount[..., None]
    height = 0.55 * quilt - 1.0 * groove + 0.9 * rivet + 0.25 * (wrinkles - 0.5) + 0.06 * fine
    return _save(f"{name}_color", rgb), _save(f"{name}_normal", _normal_map(height, 2.2), non_color=True)


def build_textures():
    """Devuelve {nombre: (imagen de color, imagen de relieve)}."""
    textures = {}
    bone = (0.86, 0.84, 0.78)
    textures["hull"] = _hull("hull", bone, dusty=False)
    textures["hull_dusty"] = _hull("hull_dusty", bone, dusty=True)
    textures["panel"] = _hull("panel", (0.68, 0.67, 0.63), dusty=False)

    # Metal cepillado: vetas horizontales y algún rayón.
    rng = np.random.default_rng(11)
    streaks = np.repeat(rng.random((SIZE, 1), dtype=np.float32), SIZE, axis=1)
    brushed = _norm(_blur(streaks, 1) * 0.6 + _noise(12, 0) * 0.25 + _blotches(13) * 0.5)
    textures["metal"] = (
        _save("metal_color", _tint(0.50 + 0.22 * brushed, (0.96, 0.98, 1.0))),
        _save("metal_normal", _normal_map(brushed, 1.2), non_color=True),
    )

    # Gris oscuro mecánico: casi liso, con algo de polvo claro.
    dark = 0.20 + 0.07 * _blotches(21) + 0.03 * _noise(22, 1)
    textures["dark"] = (
        _save("dark_color", _tint(dark, (1.0, 1.0, 0.98))),
        _save("dark_normal", _normal_map(_noise(23, 2), 0.8), non_color=True),
    )

    # Lámina dorada arrugada.
    crinkle = _norm(_blur(rng.random((SIZE, SIZE), dtype=np.float32), 3) + 0.6 * _blotches(31, 32))
    textures["gold"] = (
        _save("gold_color", _tint(0.55 + 0.6 * crinkle, (0.95, 0.66, 0.20))),
        _save("gold_normal", _normal_map(crinkle, 9.0), non_color=True),
    )

    # Tela de saco: trama cruzada y manchas de polvo.
    weave = (np.sin(_X * 2 * np.pi / 8) * np.sin(_Y * 2 * np.pi / 8)) * 0.5 + 0.5
    cloth = 0.56 + 0.10 * (weave - 0.5) + 0.12 * (_blotches(41) - 0.5) + 0.05 * (_noise(42, 1) - 0.5)
    textures["sandbag"] = (
        _save("sandbag_color", _tint(cloth, (1.0, 0.98, 0.95))),
        _save("sandbag_normal", _normal_map(weave + 0.8 * _noise(43, 4), 2.5), non_color=True),
    )

    # Regolito: grano fino y pequeñas piedras.
    grain = _noise(51, 1)
    pebbles = _norm(np.clip(_noise(52, 4) - 0.62, 0, 1))
    textures["regolith"] = (
        _save("regolith_color", _tint(0.42 + 0.14 * (grain - 0.5) + 0.10 * (_blotches(53) - 0.5) - 0.08 * pebbles, (1.0, 0.99, 0.97))),
        _save("regolith_normal", _normal_map(grain * 0.5 + pebbles * 2.0, 2.0), non_color=True),
    )

    # Hojas: verdes variados.
    leaf = 0.75 + 0.5 * (_noise(61, 2) - 0.5)
    textures["leaf"] = (
        _save("leaf_color", _tint(leaf, (0.22, 0.62, 0.24))),
        _save("leaf_normal", _normal_map(_noise(62, 2), 3.0), non_color=True),
    )
    return textures
