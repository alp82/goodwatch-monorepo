import { useEffect, useRef, useState } from 'react';
import type { useContinuousRoom } from '../../core/continuous/useRoom';
import { continuousKey } from '../../core/continuous/useRoom';
import { queryClient } from '../../core/providers';
import type { CachedRoom } from '../../core/continuous/state';
import { lobbyEntryPlan } from '../../core/continuous/lobby-entry';

/** Protocol entry only, never a private Yep or proposal Agree. No polling or retry loops. */
export function useLobbyEntry(state: ReturnType<typeof useContinuousRoom>) {
  const attempted = useRef(new Set<string>());
  const task = useRef(false);
  const mounted = useRef(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [retryVersion, setRetryVersion] = useState(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const snapshot = state.room.data;
  const blocked =
    state.busy ||
    Boolean(state.pending) ||
    state.privateError ||
    Boolean(state.terminal) ||
    !state.access;
  const plan = snapshot ? lobbyEntryPlan(snapshot) : null;
  const send = state.send;
  const refresh = state.refetch;
  useEffect(() => {
    if (blocked || task.current || !snapshot || !plan || attempted.current.has(plan.key)) return;
    const roomId = snapshot.shared.roomId;
    const initialKey = plan.key;
    attempted.current.add(initialKey);
    task.current = true;
    void Promise.resolve().then(async () => {
      if (!mounted.current) return;
      setWorking(true);
      setError('');
      try {
        const fresh = await refresh();
        if (!mounted.current || !fresh) return;
        // The latest accepted cache can contain a newer WS revision than this HTTP read.
        const latest = queryClient.getQueryData<CachedRoom>(continuousKey(roomId)) ?? fresh;
        const next = lobbyEntryPlan(latest);
        if (!next || (next.key !== initialKey && attempted.current.has(next.key))) return;
        attempted.current.add(next.key);
        if (!(await send(next.command)) && mounted.current) {
          setError('Couldn’t connect you to the room. Retry the connection.');
        }
      } catch {
        if (mounted.current) setError('Couldn’t refresh the room. Retry the connection.');
      } finally {
        task.current = false;
        if (mounted.current) setWorking(false);
      }
    });
  }, [snapshot, plan, blocked, working, retryVersion, send, refresh]);
  async function retry() {
    try {
      await refresh();
      if (!mounted.current) return;
      attempted.current.clear();
      setError('');
      setRetryVersion((v) => v + 1);
    } catch {
      if (mounted.current) setError('Couldn’t refresh the room. Retry the connection.');
    }
  }
  return { working, error: plan ? error : '', retry, required: Boolean(plan) };
}
