import { useCallback, useLayoutEffect, useRef } from 'react';

/** A function whose identity never changes and that always calls the newest `fn` (for memoized children). */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn);
  useLayoutEffect(() => { latest.current = fn; });
  return useCallback((...args: A) => latest.current(...args), []);
}

/**
 * The previous value while `next` says the same thing (`same`), so memoized children that take it skip
 * their render.
 */
export function useSteady<T>(next: T, same: (a: T, b: T) => boolean): T {
  const kept = useRef(next);
  // Reading the kept value during render is the point: it only ever holds a value this hook returned.
  // eslint-disable-next-line react-hooks/refs
  const steady = same(kept.current, next) ? kept.current : next;
  useLayoutEffect(() => { kept.current = steady; });
  return steady;
}
