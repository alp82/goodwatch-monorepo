import { EdgeBack } from './glow/EdgeBack';
import { guestOnly } from '../core/config';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { GText, Press, glow } from './glow/theme';
import { router, useFocusEffect } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { continuousApi as api, RoomFailure as ApiFailure } from '../core/continuous/api';
import { loadAccess, nativeClient, saveAccess } from '../core/credentials';
import { inviteIntent, parseInvite } from '../core/invites';
import { queryClient } from '../core/providers';
import { continuousKey as roomKey } from '../core/continuous/useRoom';
import { loadInvite, saveInvite } from '../core/continuous/invite-store';
import { roomRegistry } from '../core/continuous/room-registry';
import { mergeRoom } from '../core/continuous/state';
import { readAdmission, writeAdmission } from '../core/continuous/storage';
import type { AdmissionRecovery } from '../core/continuous/recovery-state';
import { retainRequest, retryDeadline } from '../core/continuous/retry';
import { useRetryCountdown } from '../core/continuous/useRetryCountdown';
import { Landing } from './home/Landing';
import { greeting, type HomeRoom } from './rooms/home-model';
import { Ledger } from './rooms/Ledger';
import { HistoryPanel, JoinPanel, NamePanel, ProfilePanel } from './rooms/panels';
import { useHome } from './rooms/useHome';
import { AppFrame, SubHeader, type BackTarget } from './shell/Frame';
import { Avatar, RoundButton, CoveredBody } from './shell/parts';
import { column } from './shell/tokens';

type PanelKind = 'name-create' | 'join' | 'profile' | 'history';

/**
 * The entrance: first visit lands on the approved intro; returning people land on their active rooms.
 * Create, Join, the one-time name, Profile and History are panels in the same frame. Admission keeps
 * the existing recovery: the exact request is persisted before every submit and retried as-is.
 */
export function Entrance({ invite }: { invite?: string }) {
  const home = useHome();
  useFocusEffect(useCallback(() => { home.reload(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  const [panel, setPanel] = useState<PanelKind | null>(invite ? 'join' : null);
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState(invite ?? '');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  const [checkingInvite, setCheckingInvite] = useState(Boolean(invite));
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [checkVersion, setCheckVersion] = useState(0);
  const intent = invite ?? '';
  const [admission, setAdmission] = useState<AdmissionRecovery | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const retrySeconds = useRetryCountdown(admission?.retryAt ?? 0);
  // A pending admission request reopens the panel it came from, with its exact name and code.
  const setJoining = (on: boolean) => { if (on) setPanel('join'); };
  useEffect(() => {
    let active = true;
    void readAdmission(intent).then((saved) => {
      if (!active) return;
      setAdmission(saved);
      if (saved) {
        setNickname(saved.request.nickname);
        setCode(saved.code);
        setJoining(Boolean(saved.code));
      }
      setRestoreFailed(false);
    }).catch(() => {
      if (active) {
        setRestoreFailed(true);
        setError('Could not restore your saved room request. Retry before creating another.');
      }
    }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [intent, restoreVersion]);
  useEffect(() => {
    if (!invite) return;
    let active = true;
    void (async () => {
      try {
        const { roomId } = await api.resolve(invite);
        const stored = await loadAccess(roomId);
        if (nativeClient && !stored) return;
        const access = stored ?? { roomId, participantId: '', token: '', expiresAt: 0 };
        const snapshot = await api.snapshot(access);
        if (!active) return;
        await saveAccess({
          roomId,
          participantId: snapshot.own.participantId,
          token: access.token,
          expiresAt: snapshot.shared.expiresAt,
        });
        if (!active) return;
        queryClient.setQueryData(roomKey(roomId), mergeRoom(undefined, snapshot));
        await saveInvite(roomId, { code: invite, path: inviteIntent(invite) });
        queryClient.setQueryData(['continuous-invite', roomId], {
          code: invite,
          path: inviteIntent(invite),
        });
        await writeAdmission(intent, null);
        router.replace({ pathname: '/room/[id]', params: { id: roomId } });
      } catch (e) {
        if (!active) return;
        if (
          e instanceof ApiFailure &&
          ['unauthorized', 'not_found', 'expired', 'forbidden'].includes(e.code)
        )
          return;
        setError(
          'Could not check your existing room membership. Retry before joining so your place is preserved.'
        );
        setRecoveryBlocked(true);
      } finally {
        if (active) setCheckingInvite(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [invite, checkVersion, intent]);
  /** The name is remembered once admitted, for every later room on this device. */
  const rememberName = (name: string) => (name && name !== 'Guest' ? roomRegistry.setNickname(name).catch(() => undefined) : Promise.resolve());
  async function enter(join: boolean, member = false, returning?: { code: string; nickname: string }, name?: string, joinCode?: string) {
    if (inFlight.current || restoring || restoreFailed || (admission && admission.intent !== intent) || Date.now() < (admission?.retryAt ?? 0)) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    let saved = admission;
    // Recovery continues the original action, including sign-in after admission.
    member = saved ? saved.member === true : member;
    try {
      const cleanCode = join ? parseInvite(returning?.code ?? joinCode ?? code) : '';
      if (join && !cleanCode)
        throw new Error('Enter the complete room code or YepWatch invitation link.');
      if (!saved) {
        const bytes = await Crypto.getRandomBytesAsync(32);
        saved = {
          request: {
            contractVersion: 3,
            commandId: Crypto.randomUUID(),
            admissionSecret: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''),
            nickname: (returning?.nickname ?? name ?? nickname).trim() || (member ? 'Guest' : ''),
          },
          code: cleanCode,
          intent,
          member,
          retryAt: 0,
        };
      }
      // A prior failed write may have retained this request only in memory.
      // Persist the exact bootstrap before EVERY possible admission submit.
      await writeAdmission(intent, saved);
      setAdmission(saved);
      let result;
      if (saved.code) {
        const { roomId } = await api.resolve(saved.code);
        const stored = await loadAccess(roomId);
        // Manual code entry has the same recovery guard as a direct invitation.
        if (!nativeClient || stored) {
          try {
            const access = stored ?? { roomId, participantId: '', token: '', expiresAt: 0 };
            const snapshot = await api.snapshot(access);
            await saveAccess({
              roomId,
              participantId: snapshot.own.participantId,
              token: access.token,
              expiresAt: snapshot.shared.expiresAt,
            });
            queryClient.setQueryData(roomKey(roomId), mergeRoom(undefined, snapshot));
            await saveInvite(roomId, { code: saved.code, path: inviteIntent(saved.code) });
            queryClient.setQueryData(['continuous-invite', roomId], {
              code: saved.code,
              path: inviteIntent(saved.code),
            });
            await writeAdmission(intent, null);
            await rememberName(saved.request.nickname);
            router.replace({
              pathname: '/room/[id]',
              params: { id: roomId, ...(member ? { signin: '1' } : {}) },
            });
            return;
          } catch (e) {
            if (
              !(e instanceof ApiFailure) ||
              !['unauthorized', 'not_found', 'expired', 'forbidden'].includes(e.code)
            )
              throw e;
          }
        }
        result = await api.join(roomId, { ...saved.request, inviteCode: saved.code }, stored ?? undefined);
      } else result = await api.create(saved.request);
      await saveAccess(result.credential);
      queryClient.setQueryData(
        roomKey(result.credential.roomId),
        mergeRoom(undefined, result.snapshot)
      );
      // Retain the invitation across OAuth navigation without exposing it to activity or telemetry.
      await saveInvite(result.credential.roomId, result.invite);
      queryClient.setQueryData(['continuous-invite', result.credential.roomId], result.invite);
      await writeAdmission(intent, null);
      setAdmission(null);
      await rememberName(saved.request.nickname);
      router.replace({
        pathname: '/room/[id]',
        params: { id: result.credential.roomId, ...(member ? { signin: '1' } : {}) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join this room.');
      if (saved) {
        const next = retainRequest(e) ? { ...saved, retryAt: retryDeadline(e) } : null;
        setAdmission(next);
        try { await writeAdmission(intent, next); }
        catch { setError('Your request is still awaiting confirmation, but storage is unavailable. Keep this screen open to retry.'); }
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const known = home.nickname;
  const locked = busy || checkingInvite || recoveryBlocked || restoring || restoreFailed || retrySeconds > 0;
  const closePanel = useCallback(() => { setError(''); if (invite) router.replace('/'); else setPanel(null); }, [invite]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android' || !panel) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { closePanel(); return true; });
    return () => sub.remove();
  }, [panel, closePanel]));
  const open = (roomId: string) => router.push({ pathname: '/room/[id]', params: { id: roomId } });
  /** Return to a room you left: the saved invitation re-admits the same identity. */
  function returnTo(room: HomeRoom) {
    const self = room.people.find((p) => p.self)?.nickname ?? known ?? '';
    void loadInvite(room.roomId).then((saved) => {
      if (saved) void enter(true, false, { code: saved.code, nickname: self });
      else open(room.roomId);
    }).catch(() => setError('Could not restore your invitation. Try again.'));
  }
  const create = () => { setError(''); if (known && !admission) void enter(false, Boolean(home.member), undefined, known); else setPanel('name-create'); };
  // GoodWatch supplies the name, so Continue with GoodWatch never asks for one first.
  const signIn = guestOnly ? undefined : () => {
    setError('');
    if (home.signInRoomId) router.push({ pathname: '/room/[id]', params: { id: home.signInRoomId, signin: '1' } });
    else void enter(false, true, undefined, known ?? '');
  };
  const returning = home.hasRooms || Boolean(known);
  const pending = admission ? (admission.code ? 'join' : 'name-create') : null;
  const shown: PanelKind | null = panel ?? pending ?? (restoreFailed || recoveryBlocked ? 'join' : null);
  const titles: Record<PanelKind, string> = { 'name-create': 'New room', join: invite ? 'Join the room' : 'Join a room', profile: 'Profile', history: 'History' };
  const backTo: BackTarget | null = shown ? { label: returning ? 'Your rooms' : 'Start', short: returning ? 'Rooms' : 'Start', onPress: closePanel } : null;
  const active = home.active.length;
  const actionLabel = (first: string, again: string) => (busy ? 'Connecting…' : retrySeconds > 0 ? `Retry in ${retrySeconds}s` : admission ? again : first);
  const notices = (
    <>
      {checkingInvite && <GText size={14} color={glow.muted}>Restoring your place in the room…</GText>}
      {retrySeconds > 0 && <GText size={13} color={glow.muted}>Try again in {retrySeconds}s. Your room request is saved.</GText>}
      {admission && <GText size={12} color={glow.muted}>Retry preserves your identity and room request.</GText>}
      {restoreFailed && <Press label="Retry saved request" onPress={() => { setRestoring(true); setError(''); setRestoreVersion((v) => v + 1); }} style={{ alignSelf: 'flex-start', minHeight: 44 }}><GText bold color={glow.amber}>Retry saved request</GText></Press>}
      {recoveryBlocked && <Press label="Retry membership check" onPress={() => { setRecoveryBlocked(false); setCheckingInvite(true); setError(''); setCheckVersion((v) => v + 1); }} style={{ alignSelf: 'flex-start', minHeight: 44 }}><GText bold color={glow.amber}>Retry membership check</GText></Press>}
    </>
  );
  if (!home.ready) return <AppFrame>{null}</AppFrame>;
  return (
    <AppFrame
      onLogo={shown ? closePanel : undefined}
      people={<Press label="Profile" disabled={home.loadingRooms} onPress={() => { setError(''); setPanel('profile'); }} style={{ alignItems: 'flex-end' }}><Avatar name={known} /></Press>}
      subheader={shown ? <SubHeader back={backTo} title={titles[shown]} /> : returning ? (
        <SubHeader large title={known ? `${greeting(new Date().getHours())}, ${known}` : greeting(new Date().getHours())}
          subtitle={<GText size={13} color={glow.muted}>{active ? `${active} ${active === 1 ? 'room' : 'rooms'} going` : 'No rooms going'}</GText>}
          right={<RoundButton label="History" icon="clock" onPress={() => setPanel('history')} />} />
      ) : null}
    >
      <CoveredBody covered={Boolean(shown)}>
      {returning ? (
        <Ledger rooms={home.active} unavailable={home.unavailable} loading={home.loadingRooms} open={open} newRoom={create} join={() => { setError(''); setPanel('join'); }} retry={home.retry} disabled={locked} />
      ) : (
        <Landing create={create} join={() => { setError(''); setPanel('join'); }} signIn={signIn} disabled={locked} />
      )}
      </CoveredBody>
      {!shown && error ? <View style={{ ...column, paddingBottom: 8 }}><GText size={14} color="#fca5a5">{error}</GText></View> : null}
      {shown === 'name-create' && (
        <NamePanel initial={admission?.request.nickname ?? known ?? nickname} busy={locked} error={error} action={actionLabel('Create room', 'Retry room request')}
          submit={(name) => void enter(false, false, undefined, name)} extra={notices} />
      )}
      {shown === 'join' && (
        <JoinPanel nickname={admission ? admission.request.nickname : known} initialCode={admission?.code || code} action={actionLabel('Join', 'Retry joining')} busy={locked} error={error}
          editName={() => setPanel('profile')}
          submit={(c, name) => void enter(true, false, undefined, name, c)} extra={notices} />
      )}
      {shown === 'profile' && <ProfilePanel nickname={known} member={Boolean(home.member)} signIn={signIn} busy={locked || home.loadingRooms} error={error} save={(name) => { void home.setNickname(name).then(() => setPanel(invite ? 'join' : null)); }} />}
      {shown === 'history' && <HistoryPanel decisions={home.decisions} left={home.left} canOpen={(id) => home.decidedRooms.has(id)} openRoom={open} returnTo={returnTo} busy={locked} />}
      {shown && <EdgeBack back={closePanel} />}
    </AppFrame>
  );
}
