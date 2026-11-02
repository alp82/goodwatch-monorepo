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
