/** Shared across headers; an offline Play Store must never block the room or create a false update. */
export function createPlayStoreUpdateState(check: () => Promise<boolean>, now = Date.now, timeoutMs = 5000) {
  let available = false;
  let nextCheck = -Infinity;
  let pending: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => available,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh(): Promise<void> {
      if (pending) return pending;
      if (now() < nextCheck) return Promise.resolve();
      let timer: ReturnType<typeof setTimeout>;
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Play check timed out')), timeoutMs); });
      pending = Promise.race([Promise.resolve().then(check), timeout]).then((value) => {
        nextCheck = now() + 30 * 60 * 1000;
        if (available === value) return;
        available = value;
        for (const listener of listeners) listener();
      }).catch(() => { nextCheck = now() + 5 * 60 * 1000; }).finally(() => { clearTimeout(timer); pending = null; });
      return pending;
    },
  };
}
