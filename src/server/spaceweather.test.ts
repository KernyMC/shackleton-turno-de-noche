import { describe, expect, it } from 'vitest';
import { getSpaceWeather, responseHeaders } from './spaceweather';

const now = new Date('2026-11-14T12:00:00Z');
const json = (data: unknown, status = 200): Response =>
  new Response(typeof data === 'string' ? data : JSON.stringify(data), { status });

/** fetch falso: responde según el tipo de DONKI que aparece en la URL. */
function fakeFetch(byType: Record<string, () => Promise<Response>>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const type = /DONKI\/(\w+)\?/.exec(url)?.[1] ?? '';
    const handler = byType[type];
    if (!handler) throw new Error('sin red');
    return handler();
  }) as typeof fetch;
}

const CME = [{ activityID: 'c1', startTime: '2026-11-10T05:00Z', cmeAnalyses: [{ speed: 1330, isMostAccurate: true }], link: 'L' }];

describe('getSpaceWeather', () => {
  it('combina los tipos que responden y marca los que fallan', async () => {
    const body = await getSpaceWeather({
      apiKey: 'k',
      now,
      fetchImpl: fakeFetch({
        FLR: async () => json({ status: 404 }, 404),
        CME: async () => json(CME),
        SEP: async () => json(''),
      }),
    });
    expect(body.fallback).toBeUndefined();
    expect(body.failed).toEqual(['FLR']);
    expect(body.active).toBe(true);
    expect(body.events).toEqual([
      { id: 'c1', type: 'CME', date: '2026-11-10', classOrSpeed: '1330 km/s', level: 3, link: 'L' },
    ]);
  });

  it('si todo falla responde con respaldo, sin lanzar error', async () => {
    const body = await getSpaceWeather({ apiKey: 'k', now, fetchImpl: fakeFetch({}) });
    expect(body).toEqual({ fetchedAt: now.toISOString(), active: false, events: [], fallback: true });
  });

  it('sin clave responde con respaldo sin llamar a la red', async () => {
    let called = false;
    const body = await getSpaceWeather({ apiKey: undefined, now, fetchImpl: (async () => { called = true; return json([]); }) as typeof fetch });
    expect(body.fallback).toBe(true);
    expect(called).toBe(false);
  });

  it('respeta el tiempo máximo', async () => {
    const hang: typeof fetch = ((_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('abort'))))) as typeof fetch;
    const started = Date.now();
    const body = await getSpaceWeather({ apiKey: 'k', now, fetchImpl: hang, timeoutMs: 50 });
    expect(body.fallback).toBe(true);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('JSON inválido cuenta como fallo de ese tipo', async () => {
    const body = await getSpaceWeather({
      apiKey: 'k', now,
      fetchImpl: fakeFetch({ FLR: async () => json('<html>'), CME: async () => json([]), SEP: async () => json([]) }),
    });
    expect(body).toMatchObject({ active: false, events: [], failed: ['FLR'] });
  });

  it('nunca incluye la clave en la respuesta', async () => {
    const body = await getSpaceWeather({ apiKey: 'SECRETA', now, fetchImpl: fakeFetch({ CME: async () => json(CME) }) });
    expect(JSON.stringify(body)).not.toContain('SECRETA');
  });

  it('caché de 1 hora; el respaldo solo 5 minutos', () => {
    expect(responseHeaders({ fetchedAt: '', active: false, events: [] })['cache-control']).toBe('public, max-age=3600');
    expect(responseHeaders({ fetchedAt: '', active: false, events: [], fallback: true })['cache-control']).toBe('public, max-age=300');
  });
});
