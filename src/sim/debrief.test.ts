import { describe, expect, it } from 'vitest';
import { reviewMission } from './debrief';
import { allRecycler, playGame, prudent } from './strategies';

describe('reviewMission', () => {
  it('en una derrota señala el día en que el recurso entró en peligro y a dónde volver', () => {
    const lost = playGame(3, 'comandante', allRecycler); // pierde por comida en la noche
    const review = reviewMission(lost);
    expect(lost.result?.causes[0]).toBe('food');
    expect(review.decisiveDay).not.toBeNull();
    const decisive = lost.history.find((h) => h.day === review.decisiveDay)!;
    expect(decisive.food).toBeLessThanOrEqual(25);
    expect(lost.history.filter((h) => h.day < review.decisiveDay!).every((h) => h.food > 25)).toBe(true);
    expect(review.rewindDay).toBe(Math.max(1, review.decisiveDay! - 2));
    expect(review.duringNight).toBe(true);
  });

  it('en una victoria no hay día decisivo y cuenta las tormentas con refugio', () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8].find((s) => playGame(s, 'cadete', prudent).result?.outcome === 'win')!;
    const review = reviewMission(playGame(seed, 'cadete', prudent));
    expect(review).toMatchObject({ decisiveDay: null, rewindDay: null, duringNight: false });
    expect(review.stormsTotal).toBe(2);
    expect(review.stormsSheltered).toBe(2);
    expect(review.lowest.food).toBeGreaterThan(0);
  });

  it('suma la energía desperdiciada y los apagones', () => {
    const lost = playGame(3, 'comandante', allRecycler);
    const review = reviewMission(lost);
    expect(review.wasted).toBe(Math.round(lost.history.reduce((s, h) => s + h.wasted, 0)));
    expect(review.blackouts).toBe(lost.history.filter((h) => h.blackout).length);
  });
});
