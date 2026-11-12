import { useEffect, useState } from 'react';

/** True once `active` has lasted `ms`: things that resolve quickly never reach the screen. */
export function useLate(active: boolean, ms: number) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setLate(true), ms);
    return () => { clearTimeout(timer); setLate(false); };
  }, [active, ms]);
  return active && late;
}

/** True once `ms` have passed since `since` (null: not counting). */
export function useLateSince(since: number | null, ms: number) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (since === null) return;
    const timer = setTimeout(() => setLate(true), Math.max(0, since + ms - Date.now()));
    return () => { clearTimeout(timer); setLate(false); };
  }, [since, ms]);
  return since !== null && late;
}
