import { beforeEach, describe, expect, it } from 'vitest';
import { liveStorm, loadSpaceWeather, resetSpaceWeather, spaceWeather } from './spaceWeather';
import { game, startGame } from './store';

const respond = (body: unknown, status = 200): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

const strong = { id: 'c9', type: 'CME', date: '2026-11-12', classOrSpeed: '2100 km/s', level: 4, link: 'L' };
const weak = { id: 'c1', type: 'CME', date: '2026-11-13', classOrSpeed: '400 km/s', level: 1, link: null };

beforeEach(() => resetSpaceWeather());

describe('clima espacial en el cliente', () => {
  it('Sol activo: guarda el evento más fuerte y la primera tormenta lo usa', async () => {
    await loadSpaceWeather(respond({ fetchedAt: 'x', active: true, events: [weak, strong] }));
    expect(spaceWeather.value).toMatchObject({ status: 'done', origin: 'live', event: { id: 'c9' } });
    expect(liveStorm()).toMatchObject({ id: 'c9', level: 'S4', origin: 'live' });

    startGame('comandante', 3);
    const first = game.value!.scheduledEvents.find((e) => e.kind === 'storm');
    expect(first?.payload).toMatchObject({ id: 'c9', origin: 'live', date: '2026-11-12' });
  });

  it('Sol tranquilo: sin evento y la partida usa tormentas históricas', async () => {
    await loadSpaceWeather(respond({ fetchedAt: 'x', active: false, events: [weak] }));
    expect(spaceWeather.value.event).toBeNull();
    startGame('comandante', 3);
    const first = game.value!.scheduledEvents.find((e) => e.kind === 'storm');
    expect(first?.payload?.origin).not.toBe('live');
  });

  it('respaldo del servidor y caché se distinguen', async () => {
    await loadSpaceWeather(respond({ fetchedAt: 'x', active: false, events: [], fallback: true }));
    expect(spaceWeather.value.origin).toBe('fallback');
    resetSpaceWeather();
    await loadSpaceWeather(respond({ fetchedAt: 'x', active: true, events: [strong], cached: true }));
    expect(spaceWeather.value.origin).toBe('cache');
  });

  it('sin red o respuesta rara: offline, sin lanzar error', async () => {
    await loadSpaceWeather((async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch);
    expect(spaceWeather.value).toMatchObject({ status: 'done', origin: 'offline', event: null });
    resetSpaceWeather();
    await loadSpaceWeather(respond('<html>', 404));
    expect(spaceWeather.value.origin).toBe('offline');
  });
});
