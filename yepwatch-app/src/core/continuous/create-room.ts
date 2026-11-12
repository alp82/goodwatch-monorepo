import * as Crypto from 'expo-crypto';
import type { GuestAdmission, RoomCommand, RoomSetupRequest, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousApi as api, RoomFailure } from './api';
import { saveAccess } from '../credentials';
import { deviceCountryHint } from '../lobby';
import { queryClient } from '../providers';
import { authEpoch } from './account-flow';
import { abortableSleep, BACKOFF_BASE_MS, BACKOFF_JITTER, serverWait, transientFailure, unanswered } from './backoff';
import { browserOffline } from './network';
import { saveInvite } from './invite-store';
import { roomRegistry } from './room-registry';
import type { AdmissionRecovery } from './recovery-state';
import { retainRequest, retryDeadline } from './retry';
import { continuousKey } from './keys';
import { PersistentCommands, mergeRoom, type CachedRoom } from './state';
import { readAdmission, readCommandRecovery, writeAdmission, writePending } from './storage';

/**
 * Joins (Entrance): offline, or a second try that also got no answer: show it now instead of backing off
 * for half a minute. The saved request stays and goes again (same id and secret) when the device is back.
 * Creates don't stop on a slow server: resendUntilAnswered below.
 */
export function stopWaiting(error: unknown, tries: number) {
  return unanswered(error) && (browserOffline() || tries >= 1);
}

/** Longest wait between automatic create resends while the New room page is in front. */
export const CREATE_RESEND_MAX_MS = 5000;
/** A server wait (Retry-After) up to this is waited out by itself; a longer one is shown as a manual gate. */
export const CREATE_SERVER_WAIT_MAX_MS = 60000;

/** A create that may go again by itself (same command id and secret, so never a second room). */
export function resendable(error: unknown) {
  if (transientFailure(error)) return true;
  // A rate limit that names its wait: wait it out, then send the same request.
  const e = error as Error & { status?: unknown; retryable?: unknown };
  return error instanceof Error && Number(e.status) === 429 && e.retryable === true;
}

/** 1 s, 2 s, 4 s, then 5 s between resends (minus up to 30 % jitter), never shorter than the server's wait. */
export function resendDelay(failures: number, error: unknown, random: () => number = Math.random) {
  const step = Math.min(CREATE_RESEND_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, Math.min(failures, 8)));
  return Math.round(Math.max(step * (1 - Math.min(1, Math.max(0, random())) * BACKOFF_JITTER), serverWait(error)));
}

/**
 * Sends the saved create until it is answered: a slow or restarting server never strands the person on
 * the Mood page. Stops (resolves false) when `signal` aborts (the page left the front, the app went to the
 * background); throws a final refusal, an offline browser (it resends on the online event) and a server
 * wait longer than CREATE_SERVER_WAIT_MAX_MS. `onTrouble` hears once when the first attempt that failed began.
 */
export async function resendUntilAnswered(attempt: () => Promise<void>, o: {
  signal: AbortSignal;
  onTrouble?: (since: number) => void;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
}): Promise<boolean> {
  const sleep = o.sleep ?? abortableSleep;
  for (let failures = 0; ; failures++) {
    if (o.signal.aborted) return false;
    const began = Date.now();
    try {
      await attempt();
      return true;
    } catch (error) {
      if (o.signal.aborted) return false;
      if (!resendable(error) || (unanswered(error) && browserOffline()) || serverWait(error) > CREATE_SERVER_WAIT_MAX_MS) throw error;
      if (failures === 0) o.onTrouble?.(began);
      await sleep(resendDelay(failures, error, o.random), o.signal);
    }
  }
}

/**
 * The setup the create request carries, so the room page is one round trip: the room country
 * (the server prefers the member's GoodWatch country) and the first idea. The steps after the
 * create still check both and send what the server didn't apply.
 */
function roomSetup(text: string): RoomSetupRequest {
  const idea = text.trim();
  return { country: deviceCountryHint() ?? 'US', ...(idea.length >= 2 && idea.length <= 200 ? { idea } : {}) };
}

/** Servers from before `setup` refuse the whole request as malformed. */
function refusedSetup(error: unknown) {
  return error instanceof RoomFailure && error.code === 'invalid_request' && error.status === 400;
}

interface SaveOptions {
  nickname: string;
  member: boolean;
  signal: AbortSignal;
  /** The create is going again by itself: when the first attempt that failed began. */
  onTrouble?: (since: number) => void;
}

/** One room per draft, including retries and reloads. Navigation belongs to the successful caller. */
export class CreateRoom {
  private request: AdmissionRecovery | null = null;
  private admitted: GuestAdmission | null = null;
  private commands: PersistentCommands | null = null;
  private inFlight: Promise<RoomSnapshot> | null = null;
  retryAt = 0;

  async draft() {
    const saved = this.request ?? await readAdmission('');
    return { text: saved?.mood ?? '', retryAt: saved?.retryAt ?? 0 };
  }

  save(text: string, options: SaveOptions): Promise<RoomSnapshot> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.run(text, options).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async run(text: string, options: SaveOptions): Promise<RoomSnapshot> {
    const epoch = authEpoch.current();
    const active = () => {
      if (options.signal.aborted || !authEpoch.isCurrent(epoch)) throw new Error('Room setup was interrupted. Your request is kept.');
    };
    active();
    if (Date.now() < this.retryAt) throw new Error('Wait before retrying this room request.');
    if (!this.admitted) {
      let saved = this.request ?? await readAdmission('');
      if (saved?.code) throw new Error('Finish your saved join request before creating another room.');
      if (!saved) {
        const bytes = await Crypto.getRandomBytesAsync(32);
        saved = { intent: '', code: '', member: options.member, retryAt: 0, request: {
          contractVersion: 3, commandId: Crypto.randomUUID(), nickname: options.nickname,
          admissionSecret: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''),
          setup: roomSetup(text),
        } } satisfies AdmissionRecovery;
      }
      let request: AdmissionRecovery = { ...saved, mood: text };
      this.request = request;
      this.retryAt = request.retryAt;
      if (Date.now() < this.retryAt) throw new Error('Wait before retrying this room request.');
      try {
        await resendUntilAnswered(async () => {
          active();
          // Persist before every possible POST, including after a previous storage failure.
          await writeAdmission('', request);
          try {
            this.admitted = await api.create(request.request, options.signal);
          } catch (error) {
            if (!request.request.setup || !refusedSetup(error)) throw error;
            // A server from before setup refused it (nothing was created): the same request without it,
            // then the configure and idea steps below set the room up as before.
            const { setup: _, ...plain } = request.request;
            request = { ...request, request: plain };
            this.request = request;
            await writeAdmission('', request);
            this.admitted = await api.create(request.request, options.signal);
          }
        }, { signal: options.signal, onTrouble: options.onTrouble });
      } catch (error) {
        // No answer at all has no server deadline: a resend (Try again, back online, back in front) may go at once.
        this.retryAt = retainRequest(error) && !unanswered(error) ? retryDeadline(error) : 0;
        this.request = retainRequest(error) ? { ...request, retryAt: this.retryAt } : null;
        await writeAdmission('', this.request);
        throw error;
      }
    }
    active();
    if (!this.admitted) throw new Error('Room setup was interrupted. Your request is kept.');
    const saved = await readAdmission('');
    if (saved) { this.request = { ...saved, mood: text }; await writeAdmission('', this.request); }
    const admission = this.admitted;
    const access = admission.credential;
    const id = access.roomId;
    await saveAccess(access);
    await saveInvite(id, admission.invite);
    await roomRegistry.remember({ roomId: id, nickname: options.nickname, expiresAt: access.expiresAt });
    const publish = (snapshot: RoomSnapshot) => {
      admission.snapshot = snapshot;
      queryClient.setQueryData<CachedRoom>(continuousKey(id), (current) => mergeRoom(current, snapshot));
      queryClient.setQueryData(['continuous-invite', id], admission.invite);
    };
    publish(admission.snapshot);
    if (!this.commands) {
      const recovery = await readCommandRecovery(id, access.sessionKey);
      this.commands = new PersistentCommands(() => Crypto.randomUUID(), {
        write: (envelope, retryAt) => writePending(id, envelope, retryAt, access.sessionKey),
      });
      this.commands.pending = recovery.envelope;
      this.commands.retryAt = recovery.retryAt;
    }
    const commands = this.commands;
    const send = async (command?: RoomCommand) => {
      active();
      try {
        publish(await commands.send(command, admission.snapshot, (body) => api.command(access, body)));
        this.retryAt = 0;
      } catch (error) {
        if (error instanceof RoomFailure && error.snapshot) publish(error.snapshot);
        this.retryAt = commands.retryAt;
        const recovery = await readAdmission('');
        if (recovery) { this.request = { ...recovery, retryAt: this.retryAt }; await writeAdmission('', this.request); }
        throw error;
      }
    };
    // Recover an uncertain configure or mood write before considering a new intent.
    if (commands.pending) await send();
    // A concurrent account link can change context while country is being set. Rebase a bounded
    // number of definitive conflicts; uncertain writes remain exact-envelope recovery above.
    for (let conflict = 0; !admission.snapshot.shared.screens[0]?.country; conflict++) {
      const snapshot = admission.snapshot;
      try {
        await send({ type: 'configure', expectedContextVersion: snapshot.shared.contextVersion,
          country: snapshot.own.member.prefill?.country ?? deviceCountryHint() ?? 'US' });
      } catch (error) {
        if (!(error instanceof RoomFailure) || error.code !== 'conflict' || !error.snapshot || conflict >= 4) throw error;
      }
    }
    const snapshot = admission.snapshot;
    const idea = snapshot.shared.ideas.find((i) => i.authorId === snapshot.own.participantId);
    const value = text.trim();
    if (value && idea?.text !== value) await send(idea ? { type: 'edit_idea', ideaId: idea.id, text: value } : { type: 'add_idea', text: value });
    if (!value && idea) await send({ type: 'remove_idea', ideaId: idea.id });
    active();
    if (options.nickname) await roomRegistry.setNickname(options.nickname);
    // Keep the original admission until the whole workflow succeeds: reload cannot allocate a second room.
    await writeAdmission('', null);
    this.request = null;
    return this.admitted.snapshot;
  }
}
