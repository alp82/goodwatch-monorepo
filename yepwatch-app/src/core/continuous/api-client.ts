import {
  paths,
  type ApiError,
  type InvitePreview,
  type CommandEnvelope,
  type CommandResult,
  type GuestAdmission,
  type CreateRoomRequest,
  type JoinRoomRequest,
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
  MEMBER_SESSION_HEADER,
} from '@goodwatch/yepwatch-contracts/proposal';
import { authEpoch } from './account-flow';
import { connectionDiagnostic, type ConnectionDiagnostic, type ConnectionStage } from './connection-diagnostic';
import { apiUrl } from '../config';
import { invitePreviewSchema } from './wire';
import { parseRetryAfter } from './retry';
import type { RoomAccess } from '../credentials';
/** How long a room create waits for an answer before it counts as unanswered (and is kept for a resend). */
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
    private readonly sessions?: { read(): Promise<string | null>; save(value: string): Promise<unknown> }
  ) {}
  async request<T>(
    path: string,
    body?: unknown,
    access?: RoomAccess,
    signal?: AbortSignal,
    /** The app's sealed GoodWatch session (browsers send theirs as a cookie). */
    memberSession?: string | null,
    timeoutMs = 15000
  ): Promise<T> {
    const asked = authEpoch.current();
    if (this.native && memberSession === undefined) memberSession = await this.sessions?.read();
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
    if (this.native && memberSession) headers[MEMBER_SESSION_HEADER] = memberSession;
    if (this.native && access) {
      headers.Authorization = `Bearer ${access.token}`;
      headers['X-YepWatch-Participant'] = access.participantId;
    }
    try {
      const url = apiUrl(path);
      stage = 'request';
      response = await this.fetcher(url, {
        method: body === undefined ? 'GET' : 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'include',
        headers,
        signal: controller.signal,
      });
      stage = 'response';
      const renewed = response.headers.get('x-yepwatch-session');
      if (renewed && authEpoch.isCurrent(asked)) await this.sessions?.save(renewed);
      const result = await response.json();
      // An answer asked under an earlier sign-in is outdated: it may carry that account's data (a room's
      // GoodWatch link, prefill, seen titles) after Log out. An account answer is refused. A room answer
      // (same room credential before and after: the server keeps the place) is dropped quietly, like one
      // that never came: the room reads again under the current sign-in, a saved command goes again under
      // its same id. A live-channel ticket carries no account data and stays.
      if (!authEpoch.isCurrent(asked)) {
        if (!access) throw new RoomFailure('unauthorized', 'Sign-in changed. Open the room again.', 401);
        if (path !== paths.realtimeTicket(access.roomId))
          throw new RoomFailure('outcome_unknown', 'Sign-in changed while the room answered.', undefined, undefined, undefined, false, 1);
      }
      if (!response.ok) {
        const e = result as ApiError;
        throw new RoomFailure(
          e.error?.code ?? 'outcome_unknown',
          e.error?.message ?? 'The room is temporarily unavailable.',
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
          ? 'Could not refresh the room. Check your connection.'
          : 'Your action has not been confirmed. Retry the same action to reconcile it.',
        response?.status,
        undefined,
        undefined,
        false,
        response ? parseRetryAfter(response.headers.get('Retry-After')) : undefined,
        connectionDiagnostic(e, stage, response?.status, Date.now() - started, timedOut, signal?.aborted === true)
      );
    } finally {
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
    this.request<GuestAdmission>(paths.join(id), body, access, signal);
  snapshot = (a: RoomAccess, signal?: AbortSignal) => this.request<RoomSnapshot>(paths.snapshot(a.roomId), undefined, a, signal);
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
}
