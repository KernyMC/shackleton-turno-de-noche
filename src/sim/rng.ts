// PRNG determinista con semilla (mulberry32). Nunca usar Math.random en /src/sim.

export interface Rng {
  /** Número en [0, 1). */
  next(): number;
  /** Entero en [min, max], ambos incluidos. */
  int(min: number, max: number): number;
  /** Elemento al azar de una lista no vacía. */
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error('pick: lista vacía');
    return items[int(0, items.length - 1)] as T;
  };
  return { next, int, pick };
}
