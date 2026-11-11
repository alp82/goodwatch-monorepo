import { ConnectionDetails } from './rooms/ConnectionDetails';
import type { ConnectionDiagnostic } from '../core/continuous/connection-diagnostic';
import { guestOnly } from '../core/config';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform } from 'react-native';
import { GText, Press, glow } from './glow/theme';
import { router, useFocusEffect } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { continuousApi as api, RoomFailure as ApiFailure } from '../core/continuous/api';
import { loadAccess, nativeClient, saveAccess } from '../core/credentials';
import { inviteIntent, parseInvite } from '../core/invites';
import { queryClient } from '../core/providers';
import { continuousKey as roomKey } from '../core/continuous/keys';
import { loadInvite, saveInvite } from '../core/continuous/invite-store';
import { authEpoch } from '../core/continuous/account-flow';
import { adoptAccountRoom } from '../core/continuous/account-access';
import { roomRegistry } from '../core/continuous/room-registry';
import { mergeRoom } from '../core/continuous/state';
import { readAdmission, writeAdmission } from '../core/continuous/storage';
import type { AdmissionRecovery } from '../core/continuous/recovery-state';
import { retainRequest, retryDeadline } from '../core/continuous/retry';
import { useRetryCountdown } from '../core/continuous/useRetryCountdown';
import { retryTransient, transientFailure } from '../core/continuous/backoff';
import { Landing } from './home/Landing';
import { BootPageReady, BootPhase } from './home/boot-phase';
import { greeting, type HomeRoom } from './rooms/home-model';
import { YourRooms } from './rooms/YourRooms';
import { HistorySheet, InviteHead, JoinScreen, ProfileSheet } from './rooms/panels';
import type { InvitePreview } from '@goodwatch/yepwatch-contracts/proposal';
import { useHome } from './rooms/useHome';
import { useAccount } from '../core/continuous/account';
import { memberTransition } from '../core/continuous/member-transition';
import { AppFrame } from './shell/Frame';

type PanelKind = 'join' | 'profile' | 'history';
/** What another screen can open on the start page (`/?open=…`). */
export type StartRequest = 'profile' | 'history' | 'join' | 'new';
/** Automatic retries of the same saved request while the server restarts (about half a minute in all). */
const AUTO_RETRIES = 5;
/** How long Your rooms offers Undo after an archive. */
const UNDO_ARCHIVE_MS = 6_000;
/** The saved request's manual retry gate is still closed. */
const waiting = (saved: AdmissionRecovery | null) => Date.now() < (saved?.retryAt ?? 0);

/**
 * The entrance: first visit lands on the approved intro; returning people land on Your rooms.
 * New room opens a local draft; Join, Profile and
 * History are panels in the same frame. Admission keeps the existing recovery: the exact request is
 * persisted before every submit and retried as-is.
 */
export function Entrance({ invite, open: request, from }: {
  invite?: string;
  /** A start page action another screen asked for. */
  open?: StartRequest;
  /** The screen that asked (a room), where signing in from its Profile returns to. */
  from?: string;
}) {
  const home = useHome();
  const account = useAccount();
  const boot = useContext(BootPhase);
  // A redirect during the home boot can unmount the navigator before it is retained.
  useEffect(() => { if (boot === 'ready' && home.deletionPending) router.replace('/delete-account'); }, [boot, home.deletionPending]);
  useEffect(() => { if (boot === 'ready') void roomRegistry.recovery().then(value => { if (value?.confirmed) router.replace('/delete-account'); }); }, [boot]);
  useFocusEffect(useCallback(() => { home.reload(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  const [panel, setPanel] = useState<PanelKind | null>(invite ? 'join' : request && request !== 'new' ? request : null);
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState(invite ?? '');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // The running admission (with its automatic retries). Leaving the screen, closing its panel or sending
  // the app to the background cancels it: pending waits end, no new attempt starts, nothing navigates
  // afterwards, and the saved request stays for a manual retry.
  const attempt = useRef<AbortController | null>(null);
  const cancelAttempt = useCallback(() => { attempt.current?.abort(); attempt.current = null; }, []);
  useEffect(() => cancelAttempt, [cancelAttempt]);
  useFocusEffect(useCallback(() => cancelAttempt, [cancelAttempt]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state !== 'active') cancelAttempt(); });
    return () => sub.remove();
  }, [cancelAttempt]);
  const [error, setError] = useState('');
  const [diagnostic, setDiagnostic] = useState<ConnectionDiagnostic | undefined>();
  const [checkingInvite, setCheckingInvite] = useState(Boolean(invite));
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [checkVersion, setCheckVersion] = useState(0);
  const intent = invite ?? '';
  // The invited room's head: undefined while loading, null when the preview failed (the panel stays "Join the room").
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);
  useEffect(() => {
    if (!invite) return;
    let active = true;
    api.invitePreview(invite).then((p) => { if (active) setPreview(p); }, () => { if (active) setPreview(null); });
    return () => { active = false; };
  }, [invite]);
  const [admission, setAdmission] = useState<AdmissionRecovery | null>(null);
  // Keeping an uncertain request must not trap navigation inside its form.
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const retrySeconds = useRetryCountdown(admission?.retryAt ?? 0);
  // The startup dissolves into this page once its first content is known (rooms or the intro).
  const markPageReady = useContext(BootPageReady);
  /** Coming in through an invitation (or Return) means wanting the room in Your rooms again. */
  const unarchive = (roomId: string) => roomRegistry.restore(roomId).catch(() => undefined);
  const [justArchived, setJustArchived] = useState<string | null>(null);
  useEffect(() => {
    if (!justArchived) return;
    const timer = setTimeout(() => setJustArchived(null), UNDO_ARCHIVE_MS);
    return () => clearTimeout(timer);
  }, [justArchived]);
  // An invitation's page is ready once its room preview is in and the membership check is done, so the join
  // page appears whole (never with a placeholder head) as the startup word dissolves.
  const pageReady = home.ready && !restoring && (invite ? preview !== undefined && !checkingInvite : !home.loadingRooms);
  useEffect(() => { if (pageReady) markPageReady(); }, [pageReady, markPageReady]);
  // Already in the invited room: it opens once the startup word is leaving, never behind it (the room's
  // reads and card clocks don't start while the word still covers the page).
  const [memberOf, setMemberOf] = useState<string | null>(null);
  useEffect(() => { if (memberOf && boot !== 'boot') router.replace({ pathname: '/room/[id]', params: { id: memberOf } }); }, [memberOf, boot]);
  // Back from GoodWatch: the cover lifts once the page is whole, with the account already in it.
  useEffect(() => { if (home.ready && !restoring && account.ready) memberTransition.arrived(); }, [home.ready, restoring, account.ready]);
  useFocusEffect(useCallback(() => {
    let active = true;
    void readAdmission(intent).then((saved) => {
      if (!active) return;
      setAdmission(saved);
      if (saved) {
        setNickname(saved.request.nickname);
        setCode(saved.code);
      }
      setRestoreFailed(false);
    }).catch(() => {
      if (active) {
        setRestoreFailed(true);
        setError('Could not restore your saved room request. Retry before creating another.');
      }
    }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [intent, restoreVersion])); // eslint-disable-line react-hooks/exhaustive-deps -- explicit retry re-reads the same saved request
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
        await unarchive(roomId);
        setMemberOf(roomId);
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
  async function joinRoom(member = false, returning?: { code: string; nickname: string }, name?: string, joinCode?: string) {
    if (inFlight.current || restoring || restoreFailed || (admission && admission.intent !== intent) || waiting(admission)) return;
    inFlight.current = true;
    attempt.current?.abort();
    const controller = new AbortController();
    attempt.current = controller;
    const { signal } = controller;
    setRecoveryDismissed(false);
    setBusy(true);
    setError('');
    setDiagnostic(undefined);
    let saved = admission;
    // Recovery continues the original action, including sign-in after admission.
    member = saved ? saved.member === true : member;
    try {
      const cleanCode = parseInvite(returning?.code ?? joinCode ?? code);
      if (!cleanCode)
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
      const request = saved;
      // A restart answers busy or not at all for a while: send the same saved request again by itself
      // (same command id and secret, so it can never make a second room), and only then show an error.
      await retryTransient(() => admit(request, signal), { retries: AUTO_RETRIES, retryAt: retryDeadline, signal });
    } catch (e) {
      // Cancelled (the screen went away): the request saved before the submit stays for a manual retry.
      if (signal.aborted) return;
      setError(transientFailure(e) ? 'Couldn’t reach YepWatch. Your request is saved. Try again.' : e instanceof Error ? e.message : 'Could not join this room.');
      setDiagnostic(e instanceof ApiFailure ? e.diagnostic : undefined);
      if (saved) {
        const next = retainRequest(e) ? { ...saved, retryAt: retryDeadline(e) } : null;
        setAdmission(next);
        try { await writeAdmission(intent, next); }
        catch { setError('Your request is still awaiting confirmation, but storage is unavailable. Keep this screen open to retry.'); }
      }
    } finally {
      if (attempt.current === controller) attempt.current = null;
      inFlight.current = false;
      setBusy(false);
    }
  }
  /** One admission submit of the saved request; on success it opens the room. */
  async function admit(saved: AdmissionRecovery, signal: AbortSignal) {
    /** Nothing opens once the person has left: the room (if made) waits in Your rooms. */
    const go = (target: Parameters<typeof router.push>[0], replace: boolean) => {
      if (signal.aborted) return;
      if (replace) router.replace(target);
      else router.push(target);
    };
    // A prior failed write may have retained this request only in memory.
    // Persist the exact bootstrap before EVERY possible admission submit.
    await writeAdmission(intent, saved);
    setAdmission(saved);
    const { roomId } = await api.resolve(saved.code, signal);
    const stored = await loadAccess(roomId);
    // Manual code entry has the same recovery guard as a direct invitation.
    if (!nativeClient || stored) {
      try {
        const access = stored ?? { roomId, participantId: '', token: '', expiresAt: 0 };
        const snapshot = await api.snapshot(access, signal);
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
        await unarchive(roomId);
        setAdmission(null);
        go({ pathname: '/room/[id]', params: { id: roomId } }, true);
        return;
      } catch (e) {
        if (
          !(e instanceof ApiFailure) ||
          !['unauthorized', 'not_found', 'expired', 'forbidden'].includes(e.code)
        )
          throw e;
      }
    }
    const result = await api.join(roomId, { ...saved.request, inviteCode: saved.code }, stored ?? undefined, signal);
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
    if (saved.code) await unarchive(result.credential.roomId);
    go({ pathname: '/room/[id]', params: { id: result.credential.roomId } }, true);
  }
  // A lapsed sign-in keeps its name: the page doesn't turn back into a guest's mid-session.
  const known = home.nickname ?? (account.member || account.lapsed ? account.name : null);
  const locked = busy || account.busy || checkingInvite || recoveryBlocked || restoring || restoreFailed || retrySeconds > 0;
  // A panel asked for from another screen (a room's header) closes back to that screen.
  const requestedFrom = useRef(Boolean(request && request !== 'new'));
  const closePanel = useCallback(() => {
    cancelAttempt(); setError(''); setRecoveryDismissed(true); setPanel(null);
    if (requestedFrom.current && router.canGoBack()) { requestedFrom.current = false; router.back(); return; }
    requestedFrom.current = false;
    if (invite) router.replace('/');
  }, [invite, cancelAttempt]);
  const recoveryPanel = !recoveryDismissed && (admission || restoreFailed || recoveryBlocked);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android' || (!panel && !recoveryPanel)) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { closePanel(); return true; });
    return () => sub.remove();
  }, [panel, recoveryPanel, closePanel]));
  const open = (roomId: string) => router.push({ pathname: '/room/[id]', params: { id: roomId } });
  /** Return to a room you left: the saved invitation re-admits the same identity. */
  function returnTo(room: HomeRoom) {
    if (account.member) {
      setBusy(true);
      const asked = authEpoch.current();
      void api.resume(room.roomId, true).then(result => adoptAccountRoom(result, asked)).then(() => { home.reload(); open(room.roomId); })
        .catch(() => setError('Could not return to your room. Try again.')).finally(() => setBusy(false));
      return;
    }
    const self = room.people.find((p) => p.self)?.nickname ?? known ?? '';
    void loadInvite(room.roomId).then((saved) => {
      if (saved) void joinRoom(false, { code: saved.code, nickname: self });
      else open(room.roomId);
    }).catch(() => setError('Could not restore your invitation. Try again.'));
  }
  const resumeAdmission = () => {
    if (!admission && !restoreFailed && !recoveryBlocked) return false;
    if (admission && !admission.code) { router.push('/new'); return true; }
    setRecoveryDismissed(false); setPanel('join');
    return true;
  };
  // Creation opens a local draft; only its explicit submit allocates a room.
  const create = () => { setError(''); if (!resumeAdmission()) router.push('/new'); };
  // Continue with GoodWatch signs this device in and comes back to this screen: it never creates a room.
  const signInFrom = (path: string) => { setError(''); void account.signIn(path); };
  const fromRoom = from?.match(/^\/room\/([A-Za-z0-9_-]{1,64})(?:\/|$)/)?.[1];
  const roomFrom = fromRoom ? `/room/${fromRoom}` : null;
  // The start page's big button is for guests; a lapsed sign-in gets the small Reconnect GoodWatch.
  const signIn = guestOnly || account.member ? undefined : () => signInFrom('/');
  const signInFromProfile = guestOnly || account.member ? undefined : () => signInFrom(roomFrom ?? '/?open=profile');
  const openJoin = () => { setError(''); if (!resumeAdmission()) setPanel('join'); };
  // Another screen's header asked for New room: it starts once the saved request is known.
  const handled = useRef(false);
  useEffect(() => {
    if (!request || handled.current || !home.ready || restoring) return;
    handled.current = true;
    router.setParams({ open: undefined });
    // Starting the admission is the point of this request (it runs once, like a press of New room).
    if (request === 'new') create(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [request, home.ready, restoring]); // eslint-disable-line react-hooks/exhaustive-deps
  const returning = home.hasRooms || home.decisions.length > 0 || home.unavailable.length > 0 || Boolean(known);
  const pending = admission?.code ? 'join' : null;
  const shown: PanelKind | null = panel ?? (recoveryDismissed ? null : pending ?? (restoreFailed || recoveryBlocked ? 'join' : null));
  const actionLabel = (first: string, again: string) => (busy ? 'Connecting…' : retrySeconds > 0 ? `Retry in ${retrySeconds}s` : admission ? again : first);
  const notices = (
    <>
      {error && diagnostic && <ConnectionDetails diagnostic={diagnostic} />}
      {retrySeconds > 0 && <GText size={13} color={glow.muted}>Try again in {retrySeconds}s. Your room request is saved.</GText>}
      {admission && <GText size={12} color={glow.muted}>Retry preserves your identity and room request.</GText>}
      {restoreFailed && <Press label="Retry saved request" onPress={() => { setRestoring(true); setError(''); setRestoreVersion((v) => v + 1); }} style={{ alignSelf: 'flex-start', minHeight: 44 }}><GText bold color={glow.amber}>Retry saved request</GText></Press>}
      {recoveryBlocked && <Press label="Retry membership check" onPress={() => { setRecoveryBlocked(false); setCheckingInvite(true); setError(''); setCheckVersion((v) => v + 1); }} style={{ alignSelf: 'flex-start', minHeight: 44 }}><GText bold color={glow.amber}>Retry membership check</GText></Press>}
    </>
  );
  // The saved-request check takes a moment on every visit: the page appears once, already usable.
  const me = { name: known, member: account.member };
  const openProfile = () => { setError(''); setPanel('profile'); };
  if (!home.ready || restoring || memberOf) return <AppFrame header={{ me, onProfile: openProfile, profileQuiet: true }}>{null}</AppFrame>;
  // Joining is its own screen, like the room's pages: the start page doesn't render underneath.
  if (shown === 'join') return (
    <JoinScreen invite={Boolean(invite)} head={invite && preview !== null ? <InviteHead preview={preview} /> : null} checking={checkingInvite}
      nickname={admission ? admission.request.nickname || null : known} nameLocked={Boolean(admission?.request.nickname)} member={account.member} lapsed={account.lapsed} me={me}
      initialCode={admission?.code || code} action={actionLabel('Join', 'Retry joining')} busy={locked} error={error || account.error}
      back={closePanel} editName={openProfile}
      /* Back on this invitation (or the code you typed) as yourself, ready to join. */
      signIn={guestOnly || account.member ? undefined : (c) => { const typed = parseInvite(c); signInFrom(invite ? `/r/${invite}` : typed ? `/r/${typed}` : '/?open=join'); }}
      submit={(c, name) => void joinRoom(account.member, undefined, name, c)} extra={notices} />
  );
  const openCount = home.active.filter((r) => r.live).length;
  const history = home.decisions.length || home.left.length || home.archived.length ? () => setPanel('history') : undefined;
  const sheet = shown === 'profile' ? (
    <ProfileSheet nickname={known} member={account.member} lapsed={account.lapsed} signIn={signInFromProfile} logOut={account.member || account.lapsed ? () => void account.logOut() : undefined}
      busy={locked || home.loadingRooms} error={error || account.error} onClose={closePanel}
      save={(name) => { void home.setNickname(name).then(() => { if (invite) setPanel('join'); else closePanel(); }); }} />
  ) : shown === 'history' ? (
    <HistorySheet decisions={home.decisions} left={home.left} archived={home.archived} restore={home.restore} canOpen={(id) => home.decidedRooms.has(id)} openRoom={open} returnTo={returnTo} busy={locked} onClose={closePanel} />
  ) : null;
  return (
    <AppFrame
      header={{ me, onProfile: openProfile, profileQuiet: home.loadingRooms, onLogo: shown ? closePanel : undefined, pill: returning && openCount ? { label: `${openCount} open`, state: 'rooms' } : null }}
      rooms={{ rooms: home.active, loading: home.loadingRooms, actions: { open, newRoom: create, join: openJoin } }}
      sheet={sheet}
    >
      {returning ? (
        <YourRooms title={known ? `${greeting(new Date().getHours())}, ${known}` : greeting(new Date().getHours())}
          rooms={home.active} decisions={home.decisions} unavailable={home.unavailable} loading={home.loadingRooms} open={open} newRoom={create}
          join={openJoin} retry={home.retry} history={history} signIn={signIn} signingIn={account.busy} lapsed={account.lapsed}
          archive={(roomId) => { home.archive(roomId); setJustArchived(roomId); }}
          archivedRoom={Boolean(justArchived)} undoArchive={() => { if (justArchived) home.restore(justArchived); setJustArchived(null); }}
          disabled={checkingInvite} quiet={busy} />
      ) : (
        <Landing newRoom={create} join={openJoin} signIn={signIn} signingIn={account.busy} lapsed={account.lapsed} disabled={checkingInvite} quiet={busy} />
      )}
      {!shown && home.notice ? <GText size={14} color={glow.soft}>{home.notice}</GText> : null}
      {!shown && (error || account.error) ? <GText size={14} color="#fca5a5">{error || account.error}</GText> : null}
    </AppFrame>
  );
}
