import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { authEpoch } from '../../core/continuous/account-flow';
import { adoptAccountRoom } from '../../core/continuous/account-access';
import { useAccount } from '../../core/continuous/account';
import { leftRoom } from './home-model';
import { continuousApi, RoomFailure } from '../../core/continuous/api';
import { roomRegistry } from '../../core/continuous/room-registry';
import type { RegistrySnapshot } from '../../core/continuous/room-registry-store';
import { setArchived } from '../../core/continuous/room-registry-state';
import { mergeRoom, type CachedRoom } from '../../core/continuous/state';
import { continuousKey, homeRoomKey } from '../../core/continuous/useRoom';
import { loadAccess, nativeClient } from '../../core/credentials';
import { queryClient } from '../../core/providers';
import { classify, unreadRoom, type HomeRoom } from './home-model';
import { deletionStateSchema } from '../../core/continuous/deletion-state';

/**
 * The personal home: every room on this device, read from each room's own authoritative snapshot
 * with that room's own credential. Rooms whose access ended leave the registry; decided rooms
 * become History records; snapshots also seed the room cache so opening a room is immediate.
 */
function useGuestHome(enabled: boolean) {
  const [registry, setRegistry] = useState<(RegistrySnapshot & { at: number }) | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    // The device nickname is editable for members too; only guest room reads are disabled.
    let active = true;
    void roomRegistry.load().then((value) => { if (active) setRegistry({ ...value, at: Date.now() }); }).catch(() => { if (active) setRegistry({ rooms: [], nickname: null, decisions: [], at: Date.now() }); });
    return () => { active = false; };
  }, [version, enabled]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const results = useQueries({
    queries: (registry?.rooms ?? []).map((entry) => ({
      queryKey: homeRoomKey(entry.roomId),
      enabled,
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
  const decided = classified.flatMap((x) => (x.c?.kind === 'active' && x.c.record ? [x.c.record] : []));
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
  const shelved = (x: (typeof classified)[number]) => x.entry.archivedAt !== undefined;
  const active: HomeRoom[] = classified.flatMap((x) => (x.c?.kind === 'active' && !shelved(x) ? [x.c.room] : []));
  const archived: HomeRoom[] = classified.flatMap((x) => (!shelved(x) ? [] : x.c?.kind === 'active' ? [x.c.room] : x.c?.kind === 'unavailable' ? [unreadRoom(x.entry)] : []));
  const left: HomeRoom[] = classified.flatMap((x) => (x.c?.kind === 'left' ? [x.c.room] : []));
  const unavailable = classified.flatMap((x) => (x.c?.kind === 'unavailable' && !shelved(x) ? [x.c] : []));
  /** The list changes at once; the device store catches up (a failed write re-reads it). */
  const shelve = (roomId: string, at: number | null) => {
    setRegistry((r) => (r ? { ...r, rooms: setArchived(r.rooms, roomId, at) } : r));
    void (at === null ? roomRegistry.restore(roomId) : roomRegistry.archive(roomId)).catch(reload);
  };
  const decidedRooms = new Set(decided.map((d) => d.roomId));
  // A name a linked room gave you, for a device that hasn't remembered one. Sign-in itself is the device's
  // GoodWatch session (useAccount), never a room's.
  const memberRoom = sorted.find(({ result }) => result?.data?.own.member.state === 'linked' && !result.data.own.left && !result.error);
  const memberSnapshot = memberRoom?.result.data;
  const memberName = memberSnapshot?.shared.participants.find(p => p.participantId === memberSnapshot.own.participantId)?.nickname;

  return {
    ready: registry !== null,
    loadingRooms: classified.some((x) => x.c === null),
    nickname: registry?.nickname && registry.nickname !== 'Guest' ? registry.nickname : memberName ?? registry?.nickname ?? null,
    hasRooms: (registry?.rooms.length ?? 0) > 0,
    active,
    archived,
    archive: (roomId: string) => shelve(roomId, Date.now()),
    restore: (roomId: string) => shelve(roomId, null),
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

/** Signed-in lists come entirely from the account; guest navigation remains local. */
export function useHome() {
  const account = useAccount();
  const lifecycle = useQuery({ queryKey: ['account-deletion', account.generation], enabled: account.member, retry: false, refetchInterval: 15_000,
    queryFn: async () => { const result = await continuousApi.deletionStatus(); return { accountTag: result.accountTag, deletion: result.deletion ? deletionStateSchema.parse(result.deletion) : null }; } });
  const local = useGuestHome(account.ready && !account.member && !account.lapsed);
  const [mutationFailed, setMutationFailed] = useState(false);
  const key = ['account-home', account.generation] as const;
  const cloud = useQuery({ queryKey: key, queryFn: async () => {
    const asked = authEpoch.current();
    let replacedGuest = false;
    const guestRooms = (await roomRegistry.load()).rooms.filter(r => !r.left);
    for (const entry of guestRooms) {
      if (!authEpoch.isCurrent(asked)) throw new Error('Sign-in changed');
      const access = await loadAccess(entry.roomId);
      if (!access && nativeClient) continue;
      try {
        const admission = await continuousApi.memberLink(access ?? { roomId: entry.roomId, participantId: '', token: '', expiresAt: 0 });
        if (!authEpoch.isCurrent(asked)) throw new Error('Sign-in changed');
        replacedGuest ||= admission.replacedGuest === true;
        await adoptAccountRoom(admission, asked);
      } catch (e) {
        if (!(e instanceof RoomFailure) || !['unauthorized', 'forbidden', 'not_found', 'expired', 'conflict'].includes(e.code)) throw e;
      }
    }
    return { ...(await continuousApi.accountHome()), notice: replacedGuest ? 'Resumed your existing place. Your account’s saved answers were kept.' : '' };
  }, enabled: account.member && lifecycle.isSuccess && !lifecycle.data?.deletion,
    retry: 1, refetchInterval: 15_000 });
  if (!account.member) return account.lapsed
    ? { ...local, ready: account.ready, hasRooms: false, active: [], archived: [], left: [], decisions: [], decidedRooms: new Set<string>(), unavailable: [], notice: '', deletionPending: false }
    : { ...local, notice: '', deletionPending: false };
  // A deletion made on another device also hides already cached account data here.
  const deletionPending = Boolean(lifecycle.data?.deletion);
  const data = deletionPending || !lifecycle.isSuccess || (cloud.error instanceof RoomFailure && cloud.error.status === 403) ? undefined : cloud.data;
  const classified = (data?.rooms ?? []).map(({ snapshot, joinedAt, archivedAt, leftLabel }) => {
    const entry = { roomId: snapshot.shared.roomId, nickname: snapshot.shared.participants.find(p => p.participantId === snapshot.own.participantId)?.nickname ?? account.name ?? '',
      expiresAt: snapshot.shared.expiresAt, joinedAt, openedAt: joinedAt,
      ...(archivedAt === null ? {} : { archivedAt }),
      ...(snapshot.own.left ? { left: { at: joinedAt, label: leftLabel ?? 'A room you left' } } : {}) };
    const c = snapshot.own.left ? { kind: 'left' as const, room: leftRoom(entry) } : classify(entry, { snapshot }, cloud.dataUpdatedAt);
    return { entry, c };
  });
  const reload = () => { setMutationFailed(false); void cloud.refetch(); };
  const archive = (id: string, archived: boolean) => {
    void continuousApi.archive(id, archived).then(() => queryClient.invalidateQueries({ queryKey: ['account-home'] })).catch(() => setMutationFailed(true));
  };
  const unavailable = cloud.isError || lifecycle.isError || mutationFailed ? [{ kind: 'unavailable' as const, roomId: 'account', nickname: 'Your rooms' }] : [];
  return {
    notice: data?.notice ?? '', deletionPending,
    ready: (deletionPending || lifecycle.isError || cloud.isFetched) && local.ready, loadingRooms: lifecycle.isPending || (!deletionPending && !lifecycle.isError && cloud.isPending), nickname: local.nickname ?? account.name,
    hasRooms: classified.length > 0,
    active: classified.flatMap(x => x.c.kind === 'active' && !x.entry.archivedAt ? [x.c.room] : []),
    archived: classified.flatMap(x => x.c.kind === 'active' && x.entry.archivedAt ? [x.c.room] : []),
    left: classified.flatMap(x => x.c.kind === 'left' ? [x.c.room] : []), unavailable,
    decisions: data?.decisions ?? [],
    decidedRooms: new Set((data?.rooms ?? []).filter(r => !r.snapshot.own.left && r.snapshot.shared.phase === 'decided').map(r => r.snapshot.shared.roomId)),
    reload, retry: () => { void lifecycle.refetch(); reload(); }, archive: (id: string) => archive(id, true), restore: (id: string) => archive(id, false),
    setNickname: local.setNickname,
  };
}
