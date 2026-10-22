import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { EXPOSURE_LIMITS } from '@goodwatch/yepwatch-contracts/proposal';
import { readObserved, writeObserved } from '../../core/continuous/exposure-store';
import { ActiveCardClock } from './active-time';
/** Reloaded observations with missing elapsed time stay unavailable. New cards can be measured. */
export function useActiveTime(roomId: string, key: string | null, interactive: boolean) {
  const clock = useRef(new ActiveCardClock());
  const ready = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const observed = useRef(new Set<string>());
  const knownThisMount = useRef(new Set<string>());
  const focused = useRef(AppState.currentState === 'active');
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let alive = true;
    const activeClock = clock.current;
    void readObserved(roomId)
      .then((keys) => {
        if (!alive) return;
        observed.current = new Set(keys);
        ready.current = true;
        setLoaded(true);
      })
      .catch(() => {
        ready.current = false;
      });
    return () => {
      alive = false;
      activeClock.pause();
    };
  }, [roomId]);
  useEffect(() => {
    const activeClock = clock.current;
    function observe() {
      const current = { key, interactive };
      const visible =
        focused.current &&
        current.interactive &&
        (typeof document === 'undefined' || document.visibilityState !== 'hidden');
      activeClock.observe(current.key, visible);
      if (ready.current && current.key && visible && !observed.current.has(current.key)) {
        const newKey = current.key;
        observed.current.add(newKey);
        // Persist the incomplete-observation marker BEFORE permitting a reported measurement.
        writes.current = writes.current
          .then(() => writeObserved(roomId, [...observed.current]))
          .then(() => {
            knownThisMount.current.add(newKey);
          })
          .catch(() => {
            knownThisMount.current.delete(newKey);
          });
      }
    }
    observe();
    const change = AppState.addEventListener('change', (state) => {
      focused.current = state === 'active';
      observe();
    });
    const blur =
      Platform.OS === 'android'
        ? AppState.addEventListener('blur', () => {
            focused.current = false;
            observe();
          })
        : null;
    const focus =
      Platform.OS === 'android'
        ? AppState.addEventListener('focus', () => {
            focused.current = AppState.currentState === 'active';
            observe();
          })
        : null;
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', observe);
    return () => {
      change.remove();
      blur?.remove();
      focus?.remove();
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', observe);
      activeClock.pause();
    };
  }, [key, interactive, roomId, loaded]);
  return () => {
    if (!key || !knownThisMount.current.has(key)) return null;
    clock.current.pause();
    const value = clock.current.read(key);
    return value !== null && value <= EXPOSURE_LIMITS.maxActiveMs ? value : null;
  };
}
