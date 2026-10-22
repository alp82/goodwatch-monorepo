import { useEffect, useState } from 'react';
/** UI timer only. Expiry never triggers HTTP, an answer, or agreement. */
export function useRetryCountdown(retryAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      if (!active) return;
      const current = Date.now();
      setNow(current);
      if (current < retryAt) timer = setTimeout(tick, Math.min(1000, retryAt - current));
    };
    void Promise.resolve().then(tick);
    return () => { active = false; clearTimeout(timer); };
  }, [retryAt]);
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}
