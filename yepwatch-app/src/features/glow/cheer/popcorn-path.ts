/**
 * One popcorn kernel on a ballistic arc: it pops up from somewhere across the upper poster, tumbles
 * in front of it and keeps falling past the poster's lower edge, fading once it crosses that edge.
 * It never lands or rests. Every value comes from the episode's seeded rng.
 */
import { between, type Rng } from './random';

export interface PosterRect { x: number; y: number; width: number; height: number }
export interface KernelFrame { t: number; x: number; y: number; rotate: number; scale: number; opacity: number }
export interface Puff { x: number; y: number; size: number; light: number }
export interface KernelPath { size: number; x0: number; y0: number; duration: number; frames: KernelFrame[]; puffs: Puff[]; fleck: { x: number; y: number } }

export const KERNEL = { minSize: 15, maxSize: 26, samples: 14, gravity: 1250 } as const;

export function kernelPath(rng: Rng, poster: PosterRect, opts: { spread?: number; lift?: number } = {}): KernelPath {
  const size = between(rng, KERNEL.minSize, KERNEL.maxSize);
  const x0 = poster.x + between(rng, 0.12, 0.88) * poster.width - size / 2;
  const y0 = poster.y + between(rng, 0.05, 0.5) * poster.height - size / 2;
  // Always some sideways drift, so a kernel never hangs still at the top of its arc.
  const vx = (rng() < 0.5 ? -1 : 1) * between(rng, 40, 170) * (opts.spread ?? 1);
  const vy = -between(rng, 360, 520) * (opts.lift ?? 1);
  const g = KERNEL.gravity;
  const bottom = poster.y + poster.height;
  const floor = bottom + between(rng, 60, 140);
  const timeTo = (y: number) => (-vy + Math.sqrt(vy * vy + 2 * g * Math.max(1, y - y0))) / g;
  const tFloor = timeTo(floor);
  const tEdge = timeTo(bottom);
  const spin = between(rng, 220, 620) * (rng() < 0.5 ? -1 : 1);
  const frames: KernelFrame[] = [];
  for (let i = 0; i <= KERNEL.samples; i++) {
    const t = (i / KERNEL.samples) * tFloor;
    const grow = Math.min(1, t / 0.12);
    const fade = t <= tEdge ? 1 : Math.max(0, 1 - (t - tEdge) / Math.max(0.05, tFloor - tEdge));
    frames.push({
      t: i / KERNEL.samples,
      x: vx * t,
      y: vy * t + 0.5 * g * t * t,
      rotate: spin * t,
      scale: 0.4 + 0.6 * grow,
      opacity: i === KERNEL.samples ? 0 : Math.min(grow * 2, 1) * fade,
    });
  }
  const puffs: Puff[] = Array.from({ length: 3 + Math.round(rng()) }, () => {
    const s = size * between(rng, 0.5, 0.68);
    return { x: between(rng, 0, size - s), y: between(rng, 0, size - s), size: s, light: rng() };
  });
  return { size, x0, y0, duration: tFloor * 1000, frames, puffs, fleck: { x: size * between(rng, 0.3, 0.55), y: size * between(rng, 0.3, 0.55) } };
}
