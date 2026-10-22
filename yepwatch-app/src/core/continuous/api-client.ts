import {
  paths,
  type ApiError,
  type CommandEnvelope,
  type CommandResult,
  type GuestAdmission,
  type GuestAdmissionRequest,
  type JoinRoomRequest,
  type RoomSnapshot,
  type CatalogMetadata,
  type RealtimeTicket,
  type MemberStartRequest,
  type MemberStartResponse,
  type MemberStatusResponse,
  type MemberProgressResponse,
  type MemberExchangeRequest,
} from '@goodwatch/yepwatch-contracts/continuous';
import { apiUrl } from '../config';
import type { RoomAccess } from '../credentials';
export class RoomFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly snapshot?: RoomSnapshot,
    readonly details?: ApiError['error']['details']
  ) {
    super(message);
    this.name = 'RoomFailure';
  }
}
export class ContinuousApi {
  constructor(
    private readonly fetcher: typeof fetch = (url, init) => fetch(url, init),
    private readonly native = false
  ) {}
  async request<T>(
    path: string,
    body?: unknown,
    access?: RoomAccess,
    signal?: AbortSignal
  ): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 15000);
    let response: Response | undefined;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.native) headers['X-YepWatch-Client'] = 'native';
    if (this.native && access) {
      headers.Authorization = `Bearer ${access.token}`;
      headers['X-YepWatch-Participant'] = access.participantId;
    }
    try {
      response = await this.fetcher(apiUrl(path), {
        method: body === undefined ? 'GET' : 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'include',
        headers,
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) {
        const e = result as ApiError;
        throw new RoomFailure(
          e.error?.code ?? 'outcome_unknown',
          e.error?.message ?? 'The room is temporarily unavailable.',
          response.status,
          e.snapshot,
          e.error?.details
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
        response?.status
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  create = (body: GuestAdmissionRequest) => this.request<GuestAdmission>(paths.rooms, body);
  resolve = (code: string) => this.request<{ roomId: string }>(paths.resolveInvite, { code });
  join = (id: string, body: JoinRoomRequest) => this.request<GuestAdmission>(paths.join(id), body);
  snapshot = (a: RoomAccess) => this.request<RoomSnapshot>(paths.snapshot(a.roomId), undefined, a);
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
  memberStart = (a: RoomAccess, body: MemberStartRequest) =>
    this.request<MemberStartResponse>(paths.memberStart, body, a);
  memberExchange = (a: RoomAccess, body: MemberExchangeRequest) =>
    this.request<MemberStatusResponse>(paths.memberExchange, body, a);
}
