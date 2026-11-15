import {
  paths,
  type ApiError,
  type InvitePreview,
  type CommandEnvelope,
  type CommandResult,
  type GuestAdmission,
  type CreateRoomRequest,
  type JoinRoomRequest,
  type OwnRead,
  type RoomSnapshot,
  type CatalogMetadata,
  type RealtimeTicket,
  type MemberStartRequest,
  type MemberStartResponse,
  type MemberStatusResponse,
  type MemberProgressResponse,
  type MemberExchangeRequest,
  type AccountStartRequest,
  type AccountExchangeRequest,
  type AccountStatus,
  type AccountHome,
  type ProfileAnswersRequest,
  type ProfileAnswersResponse,
  type ProfileSummary,
  type TasteDeckResponse,
  MEMBER_SESSION_HEADER,
  PROFILE_HEADER,
} from '@goodwatch/yepwatch-contracts/proposal';
import { carriesProfile } from './profile-paths';
import { profileAnswersResponseSchema, profileSummarySchema, tasteDeckSchema } from './taste-wire';
import { authEpoch } from './account-flow';
import { connectionDiagnostic, type ConnectionDiagnostic, type ConnectionStage } from './connection-diagnostic';
import { apiUrl } from '../config';
import { invitePreviewSchema } from './wire';
import { earlyInviteResponse } from './early-invite';
import { parseRetryAfter } from './retry';
import { requestSent, yepwatchAnswered } from './network';
import type { RoomAccess } from '../credentials';
import { noun } from '../../features/shell/noun';

/**
 * Replies that carry a room's candidates (create, join, resume, room reads, commands) ask for each card's reason
 * (`candidateReasons=1`): the server leaves `reason` out for clients that don't, since older bundles reject unknown
 * Candidate fields. The realtime hello says the same (realtime.ts).
 */
export function withCandidateReasons(path: string): string {
  const [bare] = path.split('?');
  const rooms = `${paths.rooms}/`;
  const room = bare.startsWith(rooms) ? bare.slice(rooms.length).split('/') : null;
  const carries = bare === paths.rooms || (room !== null && (room.length === 1 || (room.length === 2 && ['join', 'resume', 'commands'].includes(room[1]))));
  return carries ? `${path}${path.includes('?') ? '&' : '?'}candidateReasons=1` : path;
}
/** How long a room create or join waits for an answer before it counts as unanswered (and is kept for a resend). */
export const ADMISSION_TIMEOUT_MS = 6000;
export class RoomFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly snapshot?: RoomSnapshot,
    readonly details?: ApiError['error']['details'],
    readonly retryable = false,
    readonly retryAfterSeconds?: number,
    readonly diagnostic?: ConnectionDiagnostic
  ) {
    super(message);
    this.name = 'RoomFailure';
  }
}
export class ContinuousApi {
  constructor(
    private readonly fetcher: typeof fetch = (url, init) => fetch(url, init),
    private readonly native = false,
    private readonly sessions?: { read(): Promise<string | null>; save(value: string): Promise<unknown>; /** The session if already read (no wait); undefined if not yet. */ peek?(): string | null | undefined },
    private readonly creators?: { read(): Promise<string | null> },
    /** This device's taste profile secret (profile-secret.ts): sent only where carriesProfile says. */
    private readonly profiles?: { read(): Promise<string>; peek?(): string | undefined }
  ) {}
  async request<T>(
    path: string,
    body?: unknown,
    access?: RoomAccess,
    signal?: AbortSignal,
    /** The app's sealed GoodWatch session (browsers send theirs as a cookie). */
    memberSession?: string | null,
    timeoutMs = 15000,
    method: 'GET' | 'POST' | 'DELETE' = body === undefined ? 'GET' : 'POST'
  ): Promise<T> {
    const asked = authEpoch.current();
    // Known already: the request leaves in this same task (a vote's request is never queued behind the
    // sound and animation work its tap started).
    if (this.native && memberSession === undefined) memberSession = this.sessions?.peek?.();
    if (this.native && memberSession === undefined) memberSession = await this.sessions?.read();
    const creator = this.native && path === paths.rooms && body !== undefined ? await this.creators?.read() : null;
    // A storage failure leaves the header off: the request itself still goes (a profile route then answers 400).
    const profile = this.profiles && carriesProfile(path, method) ? this.profiles.peek?.() ?? await this.profiles.read().catch(() => null) : null;
    const started = Date.now();
    let stage: ConnectionStage = 'address';
    let timedOut = false;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
    let response: Response | undefined;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.native) headers['X-YepWatch-Client'] = 'native';
    if (creator) headers['X-YepWatch-Creator'] = creator;
    if (profile) headers[PROFILE_HEADER] = profile;
    if (this.native && memberSession) headers[MEMBER_SESSION_HEADER] = memberSession;
    if (this.native && access) {
      headers.Authorization = `Bearer ${access.token}`;
      headers['X-YepWatch-Participant'] = access.participantId;
    }
    const settled = requestSent();
    try {
      const url = apiUrl(withCandidateReasons(path));
      stage = 'request';
      const init: RequestInit = {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'include',
        headers,
        signal: controller.signal,
      };
      response = await (earlyInviteResponse(url, init, this.fetcher) ?? this.fetcher(url, init));
      stage = 'response';
      // The network works: the live channel stops waiting out its backoff (ContinuousRealtime.answered).
      yepwatchAnswered(response.status, Boolean(access) && path === paths.realtimeTicket(access!.roomId));
      // While Log out runs, the server may still answer as the account: only Log out's own answer counts.
      const outdated = () => !authEpoch.isCurrent(asked) || (!authEpoch.settled() && path !== paths.accountLogout);
      const renewed = response.headers.get('x-yepwatch-session');
      if (renewed && !outdated()) await this.sessions?.save(renewed);
      // 204 (DELETE /profile) has no body.
      const result = response.status === 204 ? undefined : await response.json();
      // An answer asked under an earlier sign-in is outdated: it may carry that account's data (a room's
      // GoodWatch link, prefill, seen titles) after Log out. An account answer is refused. A room answer
      // (same room credential before and after: the server keeps the place) is dropped quietly, like one
      // that never came: the room reads again under the current sign-in, a saved command goes again under
      // its same id. A live-channel ticket carries no account data and stays.
      if (outdated()) {
        if (!access) throw new RoomFailure('unauthorized', `Sign-in changed. Open the ${noun.one} again.`, 401);
        if (path !== paths.realtimeTicket(access.roomId))
          throw new RoomFailure('outcome_unknown', `Sign-in changed while the ${noun.one} answered.`, undefined, undefined, undefined, false, 1);
      }
      if (!response.ok) {
        const e = (result ?? {}) as ApiError;
        throw new RoomFailure(
          e.error?.code ?? 'outcome_unknown',
          e.error?.message ?? `The ${noun.one} is temporarily unavailable.`,
          response.status,
          e.snapshot,
          e.error?.details,
          e.error?.retryable === true,
          parseRetryAfter(response.headers.get('Retry-After'))
        );
      }
      return result as T;
    } catch (e) {
      if (e instanceof RoomFailure) throw e;
      throw new RoomFailure(
        'outcome_unknown',
        body === undefined
          ? `Could not refresh the ${noun.one}. Check your connection.`
          : 'Your action has not been confirmed. Retry the same action to reconcile it.',
        response?.status,
        undefined,
        undefined,
        false,
        // A 2xx whose body never came asked for no wait: it goes again like an unanswered request.
        response && !response.ok ? parseRetryAfter(response.headers.get('Retry-After')) : undefined,
        connectionDiagnostic(e, stage, response?.status, Date.now() - started, timedOut, signal?.aborted === true)
      );
    } finally {
      settled();
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  /** A saved admission is safe to send again (same command id and secret): don't wait long on a dead network. */
  create = (body: CreateRoomRequest, signal?: AbortSignal) => this.request<GuestAdmission>(paths.rooms, body, undefined, signal, undefined, ADMISSION_TIMEOUT_MS);
  /** `credential`: the request carried a credential for the room (missing from older servers). */
  resolve = (code: string, signal?: AbortSignal) => this.request<{ roomId: string; credential?: boolean }>(paths.resolveInvite, { code }, undefined, signal);
  invitePreview = async (code: string): Promise<InvitePreview> =>
    invitePreviewSchema.parse(await this.request<unknown>(paths.invitePreview, { code }));
  join = (id: string, body: JoinRoomRequest, access?: RoomAccess, signal?: AbortSignal) =>
    this.request<GuestAdmission>(paths.join(id), body, access, signal, undefined, ADMISSION_TIMEOUT_MS);
  snapshot = (a: RoomAccess, signal?: AbortSignal) => this.request<RoomSnapshot>(paths.snapshot(a.roomId), undefined, a, signal);
  /** The room, or only the own part while the room is still at `known`, the shared revision held (an API before
   * this answers the whole room either way). */
  snapshotSince = (a: RoomAccess, known: number, signal?: AbortSignal) =>
    this.request<RoomSnapshot | OwnRead>(`${paths.snapshot(a.roomId)}?known=${known}`, undefined, a, signal);
  command = (a: RoomAccess, c: CommandEnvelope) =>
    this.request<CommandResult>(paths.commands(a.roomId), c, a);
  ticket = (a: RoomAccess) => this.request<RealtimeTicket>(paths.realtimeTicket(a.roomId), {}, a);
  metadata = (country?: string) =>
    this.request<CatalogMetadata>(
      `${paths.metadata}${country ? `?country=${encodeURIComponent(country)}` : ''}`
    );
  member = (a: RoomAccess) =>
    this.request<MemberStatusResponse>(paths.memberStatus(a.roomId), undefined, a);
  memberProgress = (a: RoomAccess) =>
    this.request<MemberProgressResponse>(paths.memberProgress(a.roomId), undefined, a);
  /** This device's GoodWatch sign-in (no room). */
  account = (session?: string | null) =>
    this.request<AccountStatus>(paths.account, undefined, undefined, undefined, session);
  accountStart = (body: AccountStartRequest) => this.request<MemberStartResponse>(paths.accountStart, body);
  accountExchange = (body: AccountExchangeRequest) => this.request<AccountStatus>(paths.accountExchange, body);
  accountLogout = (session?: string | null) => this.request<AccountStatus>(paths.accountLogout, {}, undefined, undefined, session);
  accountHome = () => this.request<AccountHome>(paths.accountHome);
  deletionStatus = () => this.request<{ deletion: import('./deletion-state').DeletionState | null; accountTag: string }>(`${paths.account}/deletion`);
  deleteAccount = () => this.request<{ deletion: import('./deletion-state').DeletionState }>(`${paths.account}/deletion`, { confirm: 'DELETE' });
  restoreAccount = () => this.request<{ restored: boolean }>(`${paths.account}/restore`, { confirm: 'RESTORE' });
  deleteGuest = (a: RoomAccess) => this.request<{ deletion: import('./deletion-state').DeletionState }>(`${paths.rooms}/${a.roomId}/deletion`, { confirm: 'DELETE' }, a);
  restoreGuest = (a: RoomAccess) => this.request<{ restored: boolean }>(`${paths.rooms}/${a.roomId}/restore`, { confirm: 'RESTORE' }, a);
  resume = (id: string, returnAfterLeave = false) => this.request<GuestAdmission>(paths.resume(id), { returnAfterLeave });
  archive = (id: string, archived: boolean) => this.request<{ ok: true }>(paths.archive(id), { archived });
  /** Links your participant in this room to this device's sign-in. */
  memberLink = (a: RoomAccess, session?: string | null) =>
    this.request<GuestAdmission & MemberStatusResponse & { session?: string }>(paths.memberLink(a.roomId), {}, a, undefined, session);
  memberStart = (a: RoomAccess, body: MemberStartRequest) =>
    this.request<MemberStartResponse>(paths.memberStart, body, a);
  memberExchange = (a: RoomAccess, body: MemberExchangeRequest) =>
    this.request<MemberStatusResponse>(paths.memberExchange, body, a);
  /** This device's taste profile: counts, revision and pending next-day questions. */
  profile = async (signal?: AbortSignal): Promise<ProfileSummary> =>
    profileSummarySchema.parse(await this.request<unknown>(paths.profile, undefined, undefined, signal));
  tasteDeck = async (count = 10, signal?: AbortSignal): Promise<TasteDeckResponse> =>
    tasteDeckSchema.parse(await this.request<unknown>(`${paths.profileTasteDeck}?count=${count}`, undefined, undefined, signal));
  profileAnswers = async (body: ProfileAnswersRequest, signal?: AbortSignal): Promise<ProfileAnswersResponse> =>
    profileAnswersResponseSchema.parse(await this.request<unknown>(paths.profileAnswers, body, undefined, signal));
  deleteProfile = () => this.request<void>(paths.profile, undefined, undefined, undefined, undefined, 15000, 'DELETE');
}
