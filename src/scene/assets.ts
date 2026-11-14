// Recursos opcionales de NASA (terreno CGI Moon Kit, modelos GLB). Se declaran en
// public/optional-assets.json para no pedir archivos que no existen (evita errores 404 en consola).

export interface OptionalAssets {
  terrain: boolean;
  models: string[];
}

let cached: Promise<OptionalAssets> | null = null;

export function optionalAssets(): Promise<OptionalAssets> {
  cached ??= fetch('/optional-assets.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((j: Partial<OptionalAssets> | null) => ({
      terrain: j?.terrain === true,
      models: Array.isArray(j?.models) ? j.models.filter((m): m is string => typeof m === 'string') : [],
    }))
    .catch(() => ({ terrain: false, models: [] }));
  return cached;
}
