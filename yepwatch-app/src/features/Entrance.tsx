import { ConnectionDetails } from './rooms/ConnectionDetails';
import type { ConnectionDiagnostic } from '../core/continuous/connection-diagnostic';
import { guestOnly } from '../core/config';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform } from 'react-native';
import { GText, Press, glow, grow } from './glow/theme';
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
import { keptRequest } from '../core/continuous/retry';
import { useRetryCountdown } from '../core/continuous/useRetryCountdown';
import { transientFailure, unanswered } from '../core/continuous/backoff';
import { joinUntilAnswered } from '../core/continuous/join-room';
import { ResendResume, resendOutcome, sendFailure, type ResendOutcome } from '../core/continuous/resend-resume';
import { browserOffline, onBackOnline } from '../core/continuous/network';
import { OFFLINE_WORDS, QUIET_OUTAGE_MS, RECONNECTING_WORDS } from '../core/continuous/connection-words';
import { useLate, useLateSince } from '../core/useLate';
import { BusyNote } from './shell/floating-note';
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
import { openNewRoom, preloadStartPages } from './room/nav';

type PanelKind = 'join' | 'profile' | 'history';
/** What another screen can open on the start page (`/?open=…`). */
export type StartRequest = 'profile' | 'history' | 'join' | 'new';
/** How long Your rooms offers Undo after an archive. */
const UNDO_ARCHIVE_MS = 6_000;
/** The saved request's manual retry gate is still closed. */
const waiting = (saved: AdmissionRecovery | null) => Date.now() < (saved?.retryAt ?? 0);
/** What a join was asked with (Join, Retry joining, Return to a room). */
interface JoinAsk { member: boolean; returning?: { code: string; nickname: string }; name?: string; code?: string }

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
  // Once the start page is up, the pages its actions open load in the background.
  useEffect(() => { if (boot === 'ready') preloadStartPages(); }, [boot]);
  const [panel, setPanel] = useState<PanelKind | null>(invite ? 'join' : request && request !== 'new' ? request : null);
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState(invite ?? '');
  const [busy, setBusy] = useState(false);
  /** The name the running join was sent with: its form keeps it while the device's rooms are read anew. */
  const [sentName, setSentName] = useState<string | null>(null);
  // The running admission. A slow or restarting server: it keeps sending the same saved request by itself
  // (join-room.ts). Offline: it goes again once the browser is back online. Both only while this page is in
  // front: leaving the screen or closing its panel stops them (nothing navigates afterwards; the saved
  // request stays for a manual retry); the app out of the front pauses them until it is back (resend-resume.ts).
  const attempt = useRef<AbortController | null>(null);
  const [resume] = useState(() => new ResendResume<JoinAsk>());
  const cancelAttempt = useCallback(() => resume.leave(), [resume]);
  useFocusEffect(useCallback(() => { resume.focus(); return () => resume.leave(); }, [resume]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => resume.appState(state));
    return () => { sub.remove(); resume.leave(); };
  }, [resume]);
  // When the first failed attempt of this join began (null: none failed): drives the one connection line.
  const [troubleSince, setTroubleSince] = useState<number | null>(null);
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
  const [admission, setAdmissionState] = useState<AdmissionRecovery | null>(null);
  // The latest saved request, also for a resend that starts before the page renders it.
  const latestAdmission = useRef<AdmissionRecovery | null>(null);
  const setAdmission = useCallback((next: AdmissionRecovery | null) => { latestAdmission.current = next; setAdmissionState(next); }, []);
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
  // Already in the invited room: it opens straight away. At startup that happens under the cover, so the
  // join page never shows on the way; the room's own page ends the startup.
  const [memberOf, setMemberOf] = useState<string | null>(null);
  useEffect(() => { if (memberOf) router.replace({ pathname: '/room/[id]', params: { id: memberOf } }); }, [memberOf]);
  // An invitation's page is ready once its room preview is in and the membership check is done, so the join
  // page appears whole (never with a placeholder head) as the startup cover dissolves.
  const pageReady = home.ready && home.settled && !restoring && (invite ? preview !== undefined && !checkingInvite && !memberOf : !home.loadingRooms);
  useEffect(() => { if (pageReady) markPageReady(invite ? `invite:${invite}` : 'home'); }, [pageReady, markPageReady, invite]);
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
        const { roomId, credential } = await api.resolve(invite);
        const stored = await loadAccess(roomId);
        // Nothing to check without a credential for this room: no membership read (it could only be a 401).
        if (!stored && (nativeClient || credential === false)) return;
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
  /** Starts a join the person asked for; the page's resend state machine runs it (runJoin). */
  function joinRoom(member = false, returning?: { code: string; nickname: string }, name?: string, joinCode?: string) {
    if (restoring || restoreFailed || (admission && admission.intent !== intent) || waiting(admission)) return;
    resume.focus();
    resume.pick({ member, returning, name, code: joinCode });
  }
  /** One send of the saved join (it resends by itself until answered); a new request is saved first. */
  async function runJoin(ask: JoinAsk) {
    attempt.current?.abort();
    const controller = new AbortController();
    attempt.current = controller;
    const { signal } = controller;
    setRecoveryDismissed(false);
    setBusy(true);
    setError('');
    setDiagnostic(undefined);
    setTroubleSince(null);
    let saved = latestAdmission.current;
    // Recovery continues the original action, including sign-in after admission.
    const member = saved ? saved.member === true : ask.member;
    let outcome: ResendOutcome = 'failed';
    let roomId: string | null = null;
    try {
      const cleanCode = parseInvite(ask.returning?.code ?? ask.code ?? code);
      if (!cleanCode)
        throw new Error('Enter the complete room code or YepWatch invitation link.');
      if (!saved) {
        const bytes = await Crypto.getRandomBytesAsync(32);
        saved = {
          request: {
            contractVersion: 3,
            commandId: Crypto.randomUUID(),
            admissionSecret: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''),
            nickname: (ask.returning?.nickname ?? ask.name ?? nickname).trim() || (member ? 'Guest' : ''),
          },
          code: cleanCode,
          intent,
          member,
          retryAt: 0,
        };
      }
      setSentName(saved.request.nickname || null);
      // A slow or restarting server answers busy or not at all for a while: the same saved request goes again
      // by itself (same command id and secret, so it is always the same seat) until it is answered.
      roomId = await joinUntilAnswered(saved, { intent, signal, onTrouble: setTroubleSince, onSaved: setAdmission });
      outcome = 'answered';
    } catch (e) {
      // Cancelled (the screen went away, the app left the front): the request saved before the submit stays.
      // Classified now (a refusal the server already gave stays one although the page cancelled meanwhile).
      outcome = resendOutcome(sendFailure(e, signal.aborted, 'Joining was interrupted.'));
      if (outcome === 'cancelled') return;
      setError(unanswered(e) && browserOffline() ? OFFLINE_WORDS
        : transientFailure(e) ? 'Couldn’t reach YepWatch. Your request is saved. Try again.' : e instanceof Error ? e.message : 'Could not join this room.');
      setDiagnostic(e instanceof ApiFailure ? e.diagnostic : undefined);
      const current = latestAdmission.current ?? saved;
      if (current) {
        // No answer at all may go again at once; a saved server wait that stopped the join keeps its deadline.
        const next = keptRequest(current, e);
        setAdmission(next);
        try { await writeAdmission(intent, next); }
        catch { setError('Your request is kept on this screen only: storage is unavailable. Keep it open to retry.'); }
      }
    } finally {
      if (attempt.current === controller) attempt.current = null;
      setTroubleSince(null);
      // Answered: the page stays joining until the room replaces it. Otherwise it is free again before settled(),
      // which can start the saved join again at once (back in front after a cancelled send) and mark it busy.
      const answered = outcome === 'answered' && roomId !== null;
      if (!answered) setBusy(false);
      // Nothing opens once the person has left: the room waits in Your rooms.
      if (resume.settled(outcome) && roomId) {
        // The room's whole page mounts here (a guest's services sheet with it). As a transition React renders it
        // in slices between frames instead of one long task, and this page stays as it is (joining) until the
        // room replaces it in one commit.
        router.replace({ pathname: '/room/[id]', params: { id: roomId } }, { inTransition: true });
      } else if (answered) {
        setBusy(false);
      }
    }
  }
  const joinRef = useRef<typeof runJoin | null>(null);
  useEffect(() => { joinRef.current = runJoin; });
  useEffect(() => resume.connect({ send: (ask) => void joinRef.current?.(ask), abort: () => attempt.current?.abort() }), [resume]);
  useEffect(() => onBackOnline(() => resume.online()), [resume]);
  // A lapsed sign-in keeps its name: the page doesn't turn back into a guest's mid-session.
  const known = home.nickname ?? (account.member || account.lapsed ? account.name : null);
  // Offline says so only after the quiet period (connection-words.ts); the request goes by itself when back.
  const offlineLate = useLate(error === OFFLINE_WORDS, QUIET_OUTAGE_MS);
  const shownError = error === OFFLINE_WORDS && !offlineLate ? '' : error;
  // Owner rule Q24a: nothing for an outage under QUIET_OUTAGE_MS, then one small line floating over the page
  // (no layout shift, no countdown); the room still opens by itself when the answer comes.
  const reconnecting = useLateSince(busy ? troubleSince : null, QUIET_OUTAGE_MS);
  const reconnectLine = reconnecting ? <BusyNote text={RECONNECTING_WORDS} /> : null;
  // Paused (the app left the front mid-join, e.g. iOS inactive under Control Center): it goes again by itself
  // when back, so no frame of Join or Retry joining meanwhile.
  const joining = busy || (resume.phase === 'paused' && !error);
  const locked = joining || account.busy || checkingInvite || recoveryBlocked || restoring || restoreFailed || retrySeconds > 0;
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
  // One press opens one screen: routes render at once now, so a double tap's second press would push a
  // second copy of the page it just opened. Pressing works again once this page is back in front.
  const leaving = useRef(false);
  useFocusEffect(useCallback(() => { leaving.current = false; }, []));
  const push = (target: Parameters<typeof router.push>[0]) => { if (leaving.current) return; leaving.current = true; router.push(target); };
  const open = (roomId: string) => push({ pathname: '/room/[id]', params: { id: roomId } });
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
    if (admission && !admission.code) { openNewRoom(); return true; }
    setRecoveryDismissed(false); setPanel('join');
    return true;
  };
  // Creation opens a local draft; only its explicit submit allocates a room.
  const create = () => { setError(''); if (!resumeAdmission()) openNewRoom(); };
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
  // No countdowns (connection-words.ts): the saved request waits out the server's pause behind a disabled button.
  const actionLabel = (first: string, again: string) => (joining ? 'Joining…' : admission ? again : first);
  const notices = (
    <>
      {reconnectLine}
      {shownError && diagnostic && <ConnectionDetails diagnostic={diagnostic} />}
      {admission && <GText size={12} color={glow.muted}>Retry preserves your identity and room request.</GText>}
      {restoreFailed && <Press label="Retry saved request" onPress={() => { setRestoring(true); setError(''); setRestoreVersion((v) => v + 1); }} style={{ alignSelf: 'flex-start', ...grow(44) }}><GText bold color={glow.amber}>Retry saved request</GText></Press>}
      {recoveryBlocked && <Press label="Retry membership check" onPress={() => { setRecoveryBlocked(false); setCheckingInvite(true); setError(''); setCheckVersion((v) => v + 1); }} style={{ alignSelf: 'flex-start', ...grow(44) }}><GText bold color={glow.amber}>Retry membership check</GText></Press>}
    </>
  );
  // The saved-request check takes a moment on every visit: the page appears once, already usable.
  const me = { name: known, member: account.member };
  const openProfile = () => { setError(''); setPanel('profile'); };
  // Back on the start page: a guest start page from before isn't shown again until the device's rooms
  // are read anew (a room made meanwhile turns it into Your rooms).
  // A join on its way keeps its screen: the device's rooms are read anew as it lands (its name, the room), and
  // the room replaces this page a moment later in one commit.
  const joinLanding = busy && shown === 'join';
  if (!joinLanding && (!home.ready || restoring || memberOf || (!returning && !home.settled))) return <AppFrame header={{ me, onProfile: openProfile, profileQuiet: true }}>{null}</AppFrame>;
  // Joining is its own screen, like the room's pages: the start page doesn't render underneath.
  // While a join is on its way the form keeps its layout (the saved name locks only once it's back), so a
  // second press lands on Join again, not on whatever the locked form would put there.
  if (shown === 'join') return (
    <JoinScreen invite={Boolean(invite)} head={invite && preview !== null ? <InviteHead preview={preview} /> : null} checking={checkingInvite}
      nickname={admission ? admission.request.nickname || null : joinLanding && sentName ? sentName : known} nameLocked={Boolean(admission?.request.nickname) && !joining} member={account.member} lapsed={account.lapsed} me={me}
      initialCode={admission?.code || code} action={actionLabel('Join', 'Retry joining')} busy={locked} error={shownError || account.error}
      back={closePanel} editName={openProfile}
      /* Back on this invitation (or the code you typed) as yourself, ready to join. */
      signIn={guestOnly || account.member ? undefined : (c) => { const typed = parseInvite(c); signInFrom(invite ? `/r/${invite}` : typed ? `/r/${typed}` : '/?open=join'); }}
      submit={(c, name) => void joinRoom(account.member, undefined, name, c)} extra={notices} />
  );
  const openCount = home.active.filter((r) => r.live).length;
  const history = home.decisions.length || home.left.length || home.archived.length ? () => setPanel('history') : undefined;
  const sheet = shown === 'profile' ? (
    <ProfileSheet nickname={known} member={account.member} lapsed={account.lapsed} signIn={signInFromProfile} logOut={account.member || account.lapsed ? () => void account.logOut() : undefined}
      busy={locked || home.loadingRooms} error={shownError || account.error} onClose={closePanel}
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
      {!shown ? reconnectLine : null}
      {!shown && home.notice ? <GText size={14} color={glow.soft}>{home.notice}</GText> : null}
      {!shown && (shownError || account.error) ? <GText size={14} color="#fca5a5">{shownError || account.error}</GText> : null}
    </AppFrame>
  );
}
