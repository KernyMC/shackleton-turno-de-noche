// Carga de los JSON de datos en el navegador con respaldo:
//   1. /data/<nombre>.json  → fuente principal (archivo estático del repo en la CDN de Vercel).
//   2. /api/gamedata?name=<nombre> → respaldo (Vercel Function que lee la copia en Supabase).
//   3. null → quien llama decide (ocultar la tarjeta, texto por defecto). Nunca lanza.
// El motor (balance, retos, luz, tormentas) no pasa por aquí: va empaquetado en el código
// (src/sim/config.ts) y no necesita red.

export type DataOrigin = 'json' | 'supabase';

/** De dónde salió cada archivo en esta sesión (para depurar: `__dataOrigin` en DEV). */
export const dataOrigin: Record<string, DataOrigin> = {};

async function tryJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    // Un 404 de algunos servidores devuelve la página HTML con 200: no es un JSON válido.
    if ((res.headers.get('content-type') ?? '').includes('text/html')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const pending = new Map<string, Promise<unknown>>();

export function loadData<T>(name: string): Promise<T | null> {
  let p = pending.get(name) as Promise<T | null> | undefined;
  if (!p) {
    p = (async () => {
      const primary = await tryJson<T>(`/data/${name}.json`);
      if (primary !== null) {
        dataOrigin[name] = 'json';
        return primary;
      }
      const backup = await tryJson<T>(`/api/gamedata?name=${encodeURIComponent(name)}`);
      if (backup !== null) dataOrigin[name] = 'supabase';
      return backup;
    })();
    pending.set(name, p);
    // Si todo falló, no se guarda: el próximo intento vuelve a probar.
    void p.then((v) => v === null && pending.delete(name));
  }
  return p;
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  (window as unknown as { __dataOrigin: typeof dataOrigin }).__dataOrigin = dataOrigin;
}
