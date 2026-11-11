import { useEffect, useRef, useState } from 'react';
import { router, useRootNavigationState } from 'expo-router';
import { continuousApi as api } from '../../core/continuous/api';
import { loadAccess } from '../../core/credentials';
import { continuousKey } from '../../core/continuous/keys';
import { loadFrontRoom, saveFrontRoom } from '../../core/continuous/front-room';
import { mergeRoom } from '../../core/continuous/state';
import { resumeRoom } from '../../core/continuous/resume-room';
import { queryClient } from '../../core/providers';

/** A server that doesn't answer the check within this still gets the room (it shows its own state). */
const CHECK_MS = 1500;

function snapshotWithin(access: Parameters<typeof api.snapshot>[0]) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), CHECK_MS);
  return api.snapshot(access, abort.signal).finally(() => clearTimeout(timer));
}

/**
 * Remembers the room in front and, on a launch at the start page, goes back to it (resume-room.ts).
 * `pending` holds the startup cover until the launch has either stayed on the start page or arrived
 * at the room's address, so the start page never shows on the way to the room.
 */
export function useFrontRoom(pathname: string) {
  // Only a launch on the start page resumes; any other address (an invitation, a room) is where the person goes.
  const [deciding, setDeciding] = useState(() => pathname === '/');
  const [target, setTarget] = useState<string | null>(null);
  const navReady = Boolean(useRootNavigationState()?.key);
  useEffect(() => {
    if (!deciding) return;
    let live = true;
    void resumeRoom({
      loadFront: loadFrontRoom,
      forget: () => saveFrontRoom(null),
      loadAccess,
      snapshot: snapshotWithin,
      adopt: (snapshot) => queryClient.setQueryData(continuousKey(snapshot.shared.roomId), mergeRoom(undefined, snapshot)),
      now: Date.now,
    }).catch(() => null).then((roomId) => {
      if (!live) return;
      setTarget(roomId);
      setDeciding(false);
    });
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per launch
  // On top of the start page, as if opened from it (Back leads there), without the page transition: it's an arrival.
  useEffect(() => {
    if (target && navReady) router.push({ pathname: '/room/[id]', params: { id: target, arrival: '1' } });
  }, [target, navReady]);
  const there = !target || pathname.startsWith(`/room/${target}`);
  const [arrived, setArrived] = useState(false);
  // Latched in the render that first sees the room's address, so leaving the room later never re-covers the app.
  if (!deciding && there && !arrived) setArrived(true);
  const pending = deciding || !(arrived || there);
  const saved = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (pending) return;
    const room = /^\/room\/([^/]+)/.exec(pathname)?.[1] ?? (pathname === '/' ? null : undefined);
    if (room === undefined || room === saved.current) return;
    saved.current = room;
    void saveFrontRoom(room).catch(() => undefined);
  }, [pathname, pending]);
  return { pending };
}
