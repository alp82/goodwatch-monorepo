import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousApi, RoomFailure } from '../../core/continuous/api';
import { roomRegistry } from '../../core/continuous/room-registry';
import type { RegistrySnapshot } from '../../core/continuous/room-registry-store';
import { mergeRoom, type CachedRoom } from '../../core/continuous/state';
import { continuousKey, homeRoomKey } from '../../core/continuous/useRoom';
import { loadAccess, nativeClient } from '../../core/credentials';
import { queryClient } from '../../core/providers';
import { classify, type HomeRoom } from './home-model';

/**
 * The personal home: every room on this device, read from each room's own authoritative snapshot
 * with that room's own credential. Rooms whose access ended leave the registry; decided rooms
 * become History records; snapshots also seed the room cache so opening a room is immediate.
 */
export function useHome() {
  const [registry, setRegistry] = useState<(RegistrySnapshot & { at: number }) | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    void roomRegistry.load().then((value) => { if (active) setRegistry({ ...value, at: Date.now() }); }).catch(() => { if (active) setRegistry({ rooms: [], nickname: null, decisions: [], at: Date.now() }); });
    return () => { active = false; };
  }, [version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const results = useQueries({
    queries: (registry?.rooms ?? []).map((entry) => ({
      queryKey: homeRoomKey(entry.roomId),
      retry: false,
      staleTime: 5_000,
      queryFn: async (): Promise<RoomSnapshot> => {
        const access = await loadAccess(entry.roomId);
        if (!access && nativeClient) throw new RoomFailure('unauthorized', 'No saved access for this room.');
        const snapshot = await continuousApi.snapshot(access ?? { roomId: entry.roomId, participantId: '', token: '', expiresAt: 0 });
        queryClient.setQueryData<CachedRoom>(continuousKey(entry.roomId), (old) => mergeRoom(old, snapshot));
        return snapshot;
      },
    })),
  });
  // Classification time is the registry load time; reload() refreshes both.
  const now = registry?.at ?? 0;
  const sorted = useMemo(() => (registry?.rooms ?? []).map((entry, i) => ({ entry, result: results[i] })), [registry, results]);
  const classified = sorted.map(({ entry, result }) =>
    result?.isPending ? { entry, c: null } : { entry, c: classify(entry, { snapshot: result?.data, error: result?.error ? (result.error as RoomFailure) : null }, now) }
  );
  // Side effects of classification: forget ended rooms, keep decisions for History.
  const gone = classified.filter((x) => x.c?.kind === 'gone').map((x) => x.entry.roomId).join(',');
  const decided = classified.flatMap((x) => (x.c?.kind === 'decided' ? [x.c.record] : []));
  const decidedKey = decided.map((d) => d.id).join(',');
  useEffect(() => {
    if (!gone) return;
    void Promise.all(gone.split(',').map((id) => roomRegistry.forget(id))).then(reload).catch(() => undefined);
  }, [gone, reload]);
  useEffect(() => {
    if (!decidedKey) return;
    void Promise.all(decided.map((d) => roomRegistry.recordDecision(d))).then(() =>
      setRegistry((r) => (r ? { ...r, decisions: [...decided.filter((d) => !r.decisions.some((x) => x.id === d.id)), ...r.decisions].sort((a, b) => b.decidedAt - a.decidedAt) } : r))
    ).catch(() => undefined);
  }, [decidedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const active: HomeRoom[] = classified.flatMap((x) => (x.c?.kind === 'active' ? [x.c.room] : []));
  const left: HomeRoom[] = classified.flatMap((x) => (x.c?.kind === 'left' ? [x.c.room] : []));
  const unavailable = classified.flatMap((x) => (x.c?.kind === 'unavailable' ? [x.c] : []));
  const decidedRooms = new Set(decided.map((d) => d.roomId));
  // A remembered nickname is not proof of sign-in. Only fresh room reads establish it.
  const memberRoom = sorted.find(({ result }) => result?.data?.own.member.state === 'linked' && !result.data.own.left && !result.error);
  const memberSnapshot = memberRoom?.result.data;
  const memberName = memberSnapshot?.shared.participants.find(p => p.participantId === memberSnapshot.own.participantId)?.nickname;
  const signInRoomId = sorted.find(({ result }) => result?.data && !result.data.own.left && !result.error)?.entry.roomId;

  return {
    ready: registry !== null,
    loadingRooms: classified.some((x) => x.c === null),
    nickname: registry?.nickname && registry.nickname !== 'Guest' ? registry.nickname : memberName ?? registry?.nickname ?? null,
    member: memberRoom ? { roomId: memberRoom.entry.roomId } : null,
    signInRoomId,
    hasRooms: (registry?.rooms.length ?? 0) > 0,
    active,
    left,
    unavailable,
    decisions: registry?.decisions ?? [],
    /** Decided rooms that are still on this device (History can open them). */
    decidedRooms,
    reload,
    retry: () => results.forEach((r) => { if (r.isError) void r.refetch(); }),
    setNickname: async (name: string) => { await roomRegistry.setNickname(name); reload(); },
  };
}
