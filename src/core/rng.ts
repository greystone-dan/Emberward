// Seeded deterministic RNG (mulberry32). State is a plain number so it round-trips through JSON.
export interface RngState {
  s: number;
}

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Separate stream per purpose (map, rewards, market, ai) so one stream never perturbs another. */
export function makeRng(seed: string, stream: string): RngState {
  return { s: hashSeed(`${seed}:${stream}`) };
}

/** Returns [value in [0,1), next state]. Pure. */
export function nextFloat(r: RngState): [number, RngState] {
  let t = (r.s + 0x6d2b79f5) >>> 0;
  let x = t;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return [((x ^ (x >>> 14)) >>> 0) / 4294967296, { s: t }];
}

export function nextInt(r: RngState, n: number): [number, RngState] {
  const [f, next] = nextFloat(r);
  return [Math.floor(f * n), next];
}
