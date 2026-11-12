import { continuousApi as api, RoomFailure } from './api';
import { loadAccess, nativeClient, saveAccess } from '../credentials';
import { inviteIntent } from '../invites';
import { queryClient } from '../providers';
import { abortableSleep } from './backoff';
import { saveInvite } from './invite-store';
import { continuousKey } from './keys';
import type { AdmissionRecovery } from './recovery-state';
import { resendUntilAnswered, troubleOnce, waitOutDeadline } from './resend';
import { roomRegistry } from './room-registry';
import { mergeRoom } from './state';
import { writeAdmission } from './storage';

/** A membership read that says this device isn't (or no longer) in the room: join instead. */
const NOT_A_MEMBER = ['unauthorized', 'not_found', 'expired', 'forbidden'];

export interface JoinOptions {
  /** The saved request's key: the invitation the page was opened with ('' for a typed code). */
  intent: string;
  signal: AbortSignal;
  /** The join is going again by itself: when the first attempt that failed began. */
  onTrouble?: (since: number) => void;
  /** The saved request as just written (before each submit, with a server wait's deadline), or null once admitted. */
  onSaved?: (saved: AdmissionRecovery | null) => void;
}

function interrupted() {
  const error = new Error('Joining was interrupted. Your request is kept.');
  error.name = 'AbortError';
  return error;
}

/** The name is remembered once admitted, for every later room on this device. */
const rememberName = (name: string) => (name && name !== 'Guest' ? roomRegistry.setNickname(name).catch(() => undefined) : Promise.resolve());
/** Coming in through an invitation (or Return) means wanting the room in Your rooms again. */
const unarchive = (roomId: string) => roomRegistry.restore(roomId).catch(() => undefined);

/** One admission submit of the saved request. Returns the room to open. */
async function admitOnce(saved: AdmissionRecovery, o: JoinOptions): Promise<string> {
  // A prior failed write may have retained this request only in memory.
  // Persist the exact bootstrap before EVERY possible admission submit.
  await writeAdmission(o.intent, saved);
  o.onSaved?.(saved);
  const { roomId, credential } = await api.resolve(saved.code, o.signal);
  const stored = await loadAccess(roomId);
  // Already in the room (a resend whose earlier answer got lost, or Return): it opens as that member.
  if (stored || (!nativeClient && credential !== false)) {
    try {
      const access = stored ?? { roomId, participantId: '', token: '', expiresAt: 0 };
      const snapshot = await api.snapshot(access, o.signal);
      await saveAccess({ roomId, participantId: snapshot.own.participantId, token: access.token, expiresAt: snapshot.shared.expiresAt });
      queryClient.setQueryData(continuousKey(roomId), mergeRoom(undefined, snapshot));
      const invite = { code: saved.code, path: inviteIntent(saved.code) };
      await saveInvite(roomId, invite);
      queryClient.setQueryData(['continuous-invite', roomId], invite);
      await writeAdmission(o.intent, null);
      o.onSaved?.(null);
      await rememberName(saved.request.nickname);
      await unarchive(roomId);
      return roomId;
    } catch (e) {
      if (!(e instanceof RoomFailure) || !NOT_A_MEMBER.includes(e.code)) throw e;
    }
  }
  // The server derives the participant from the command id and secret: a resend is the same seat, never a
  // second one, and isn't counted against the room's limit again.
  const result = await api.join(roomId, { ...saved.request, inviteCode: saved.code }, stored ?? undefined, o.signal);
  await saveAccess(result.credential);
  queryClient.setQueryData(continuousKey(result.credential.roomId), mergeRoom(undefined, result.snapshot));
  // Retain the invitation across OAuth navigation without exposing it to activity or telemetry.
  await saveInvite(result.credential.roomId, result.invite);
  queryClient.setQueryData(['continuous-invite', result.credential.roomId], result.invite);
  await writeAdmission(o.intent, null);
  o.onSaved?.(null);
  await rememberName(saved.request.nickname);
  if (saved.code) await unarchive(result.credential.roomId);
  return result.credential.roomId;
}

/**
 * Sends the saved join until it is answered (resend.ts): a slow or restarting server never leaves the
 * friend on the join page. Returns the room to open. Throws a final refusal (room full, expired, removed,
 * not found), an offline browser, a server wait past a minute, and an AbortError when `signal` aborts (the
 * page left the front or the app went to the background); the saved request stays for the next send.
 */
export async function joinUntilAnswered(saved: AdmissionRecovery, o: JoinOptions): Promise<string> {
  let request = saved;
  // The page hears once per join when the trouble began (a saved wait, then a failed resend, is one outage).
  const onTrouble = troubleOnce(o.onTrouble);
  // A server wait saved before the app left the front or was closed: wait out what is left of it.
  await waitOutDeadline(request.retryAt, o.signal, abortableSleep, onTrouble);
  let roomId: string | null = null;
  const answered = await resendUntilAnswered(async () => {
    if (o.signal.aborted) throw interrupted();
    // The server's wait is over by now (or never was): the saved request goes without one.
    if (request.retryAt) request = { ...request, retryAt: 0 };
    roomId = await admitOnce(request, o);
  }, { signal: o.signal, sleep: abortableSleep, onTrouble, onServerWait: async (until) => {
    request = { ...request, retryAt: until };
    o.onSaved?.(request);
    await writeAdmission(o.intent, request);
  } });
  if (!answered || roomId === null) throw interrupted();
  return roomId;
}
