import { useLayoutEffect, useRef } from 'react';

const EASE = 'cubic-bezier(.22,1,.36,1)';
const GLIDE_MS = 280;

/**
 * A view that other content pushes never jumps: when a render moves it within its parent (an idea
 * arrives above it, one more face before it), it glides to its new place (transform only), starting
 * from exactly where it was painted. Measured right after React's DOM update and before the browser
 * paints, so no frame shows it at the new place un-glided. Put the returned ref on a plain View.
 * Reduced motion keeps the instant move.
 */
export function useGlide({ axis = 'y', enabled = true }: { axis?: 'x' | 'y'; enabled?: boolean } = {}) {
  const ref = useRef<HTMLElement | null>(null);
  const last = useRef<{ el: HTMLElement; at: number } | null>(null);
  const glide = useRef<Animation | null>(null);
  // Every commit: the browser lays out before painting anyway, this reads that layout a moment earlier.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof el.animate !== 'function') { last.current = null; return; }
    const read = () => (axis === 'y' ? el.offsetTop : el.offsetLeft);
    if (last.current?.el !== el) {
      // Just mounted: nothing to glide from. Its first place is read after that frame's own layout, not forced
      // in the middle of the commit that mounts a whole screen (the rest of the commit changes the DOM again,
      // so the browser would lay the page out twice).
      last.current = { el, at: Number.NaN };
      const frame = requestAnimationFrame(() => { if (last.current?.el === el && Number.isNaN(last.current.at)) last.current = { el, at: read() }; });
      return () => cancelAnimationFrame(frame);
    }
    const at = read();
    const before = Number.isNaN(last.current.at) ? at : last.current.at;
    last.current = { el, at };
    const delta = at - before;
    if (!delta || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Still gliding from an earlier move: continue from where it is now.
    let from = -delta;
    if (glide.current?.playState === 'running') {
      const now = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      from += axis === 'y' ? now.m42 : now.m41;
      glide.current.cancel();
    }
    const shift = (v: number) => (axis === 'y' ? `translateY(${v}px)` : `translateX(${v}px)`);
    glide.current = el.animate([{ transform: shift(from) }, { transform: 'none' }], { duration: GLIDE_MS, easing: EASE });
  });
  return ref as unknown as React.RefObject<never>;
}
