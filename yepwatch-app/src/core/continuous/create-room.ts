import * as Crypto from 'expo-crypto';
import type { GuestAdmission, RoomCommand, RoomSetupRequest, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousApi as api, RoomFailure } from './api';
import { saveAccess } from '../credentials';
import { deviceCountryHint } from '../lobby';
import { queryClient } from '../providers';
import { authEpoch } from './account-flow';
import { abortableSleep } from './backoff';
import { resendUntilAnswered, troubleOnce, waitOutDeadline } from './resend';
import { saveInvite } from './invite-store';
import { roomRegistry } from './room-registry';
import type { AdmissionRecovery } from './recovery-state';
import { keptRequest } from './retry';
import { continuousKey } from './keys';
import { PersistentCommands, mergeRoom, type CachedRoom } from './state';
import { readAdmission, readCommandRecovery, writeAdmission, writePending } from './storage';

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
    // The page hears once per save when the trouble began (a saved wait, then a failed resend, is one outage).
    const onTrouble = troubleOnce(options.onTrouble);
    // Created already: a command's server wait (the create's own wait is kept with its saved request below).
    if (this.admitted) { await waitOutDeadline(this.retryAt, options.signal, abortableSleep, onTrouble); active(); }
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
      // A server wait saved before the app left the front or was closed: wait out what is left of it.
      await waitOutDeadline(this.retryAt, options.signal, abortableSleep, onTrouble);
      try {
        await resendUntilAnswered(async () => {
          active();
          // The server's wait is over by now (or never was): the saved request goes without one.
          if (request.retryAt) { request = { ...request, retryAt: 0 }; this.request = request; }
          this.retryAt = 0;
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
        }, { signal: options.signal, sleep: abortableSleep, onTrouble, onServerWait: async (until) => {
          request = { ...request, retryAt: until };
          this.request = request;
          this.retryAt = until;
          await writeAdmission('', request);
        } });
      } catch (error) {
        this.request = keptRequest(request, error);
        this.retryAt = this.request?.retryAt ?? 0;
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
    // One setup command, sent until it is answered like the create (resend.ts): a slow or restarting server
    // never leaves the page on Try again while it is in front and online. A resend is the pending envelope
    // (same command id and sequence), so the server applies it once; the loop has already waited out the
    // server's Retry-After, so the command queue's own manual gate doesn't hold it back again.
    const send = async (command?: RoomCommand) => {
      active();
      await waitOutDeadline(commands.retryAt, options.signal, abortableSleep, onTrouble);
      let resend = false;
      const answered = await resendUntilAnswered(async () => {
        active();
        // Its server wait is over by now (waited out above, or by the loop): the command goes without one.
        commands.retryAt = 0;
        const next = resend && commands.pending ? undefined : command;
        resend = true;
        try {
          publish(await commands.send(next, admission.snapshot, (body) => api.command(access, body)));
          this.retryAt = 0;
        } catch (error) {
          if (error instanceof RoomFailure && error.snapshot) publish(error.snapshot);
          this.retryAt = commands.retryAt;
          const recovery = await readAdmission('');
          if (recovery) { this.request = { ...recovery, retryAt: this.retryAt }; await writeAdmission('', this.request); }
          throw error;
        }
      }, { signal: options.signal, sleep: abortableSleep, onTrouble, onServerWait: async (until) => {
        // An interrupted wait (background, relaunch) still holds when the command goes again.
        commands.retryAt = Math.max(commands.retryAt, until);
        this.retryAt = commands.retryAt;
        if (commands.pending) await writePending(id, commands.pending, commands.retryAt, access.sessionKey);
      } });
      if (!answered) active();
      if (!answered) throw new Error('Room setup was interrupted. Your request is kept.');
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
