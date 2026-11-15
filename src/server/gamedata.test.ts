import { describe, expect, it } from 'vitest';
import { GAMEDATA_NAMES, getGameData } from './gamedata';
import { readdirSync } from 'node:fs';

const ok = (rows: unknown) => (async () => new Response(JSON.stringify(rows), { status: 200 })) as unknown as typeof fetch;
const base = { url: 'https://x.supabase.co', key: 'sb_publishable_test' };

describe('respaldo de datos en Supabase', () => {
  it('cubre todos los JSON de public/data', () => {
    const files = readdirSync('public/data')
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
    expect([...GAMEDATA_NAMES].sort()).toEqual(files.sort());
  });

  it('rechaza nombres fuera de la lista', async () => {
    const r = await getGameData({ ...base, name: "balance' or 1=1", fetchImpl: ok([]) });
    expect(r.status).toBe(400);
  });

  it('sin configurar responde 503 sin llamar a la red', async () => {
    const r = await getGameData({ name: 'sources', url: undefined, key: undefined });
    expect(r.status).toBe(503);
  });

  it('devuelve el JSON guardado', async () => {
    const r = await getGameData({ ...base, name: 'sources', fetchImpl: ok([{ data: { sources: {} } }]) });
    expect(r).toEqual({ status: 200, body: { sources: {} } });
  });

  it('fila inexistente → 404; Supabase caído → 503', async () => {
    expect((await getGameData({ ...base, name: 'sources', fetchImpl: ok([]) })).status).toBe(404);
    const down = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect((await getGameData({ ...base, name: 'sources', fetchImpl: down })).status).toBe(503);
  });
});
