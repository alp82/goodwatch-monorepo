/** Seeded randomness for cheers: every device draws the same composition for the same seed. */
export type Rng = () => number;
export function mulberry32(seed: number): Rng {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const between = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
/** A fresh episode seed within the protocol's 0..2147483647 range. */
export const newCheerSeed = () => Math.floor(Math.random() * 2147483647);
