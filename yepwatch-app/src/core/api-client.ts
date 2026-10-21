import { paths, type ApiError, type CatalogMetadata, type CommandEnvelope, type CommandResult, type GuestAdmission, type GuestAdmissionRequest, type JoinRoomRequest, type MemberStartRequest, type MemberStartResponse, type RealtimeTicket, type RoomSnapshot, type ShowProgressResponse, type ShowSearchResponse } from '@goodwatch/yepwatch-contracts';
import { apiUrl } from './config';
import type { RoomAccess } from './credentials';
import { ApiFailure } from './errors';

export class YepApi {
  constructor(private readonly fetcher: typeof fetch = (input, init) => fetch(input, init), private readonly native = false) {}
  async request<T>(path: string, body?: unknown, access?: RoomAccess, signal?: AbortSignal): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.native) headers['X-YepWatch-Client'] = 'native';
    if (this.native && access) { headers.Authorization = `Bearer ${access.token}`; headers['X-YepWatch-Participant'] = access.participantId; }
    let response: Response | undefined;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      response = await this.fetcher(apiUrl(path), { method: body === undefined ? 'GET' : 'POST', headers, credentials: 'include', body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      const result: T | ApiError = await response.json();
      if (!response.ok) {
        const failure = result as ApiError;
        throw new ApiFailure(failure.error?.code ?? 'outcome_unknown', failure.error?.message ?? 'YepWatch is temporarily unavailable.', failure.snapshot, response.status);
      }
      return result as T;
    } catch (error) {
      if (error instanceof ApiFailure) throw error;
      throw new ApiFailure('outcome_unknown', body === undefined ? 'Could not load YepWatch. Check your connection and retry.' : 'No confirmation received. Your action may have arrived. Retry the same action to reconcile it.', undefined, response?.status);
    } finally {
      clearTimeout(timeout); signal?.removeEventListener('abort', abort);
    }
  }
  create = (body: GuestAdmissionRequest) => this.request<GuestAdmission>(paths.rooms, body);
  resolve = (code: string) => this.request<{ roomId: string }>(paths.resolveInvite, { code });
  join = (roomId: string, body: JoinRoomRequest) => this.request<GuestAdmission>(paths.join(roomId), body);
  snapshot = (access: RoomAccess) => this.request<RoomSnapshot>(paths.snapshot(access.roomId), undefined, access);
  command = (access: RoomAccess, envelope: CommandEnvelope) => this.request<CommandResult>(paths.commands(access.roomId), envelope, access);
  metadata = (country?: string) => this.request<CatalogMetadata>(`${paths.metadata}${country ? `?country=${encodeURIComponent(country)}` : ''}`);
  progress = (access: RoomAccess, showId: number) => this.request<ShowProgressResponse>(paths.showProgress(access.roomId, showId), undefined, access);
  shows = (access: RoomAccess, query: string) => this.request<ShowSearchResponse>(`${paths.showSearch}?roomId=${encodeURIComponent(access.roomId)}&q=${encodeURIComponent(query)}`, undefined, access);
  ticket = (access: RoomAccess) => this.request<RealtimeTicket>(paths.realtimeTicket(access.roomId), {}, access);
  memberStart = (body: MemberStartRequest, access?: RoomAccess) => this.request<MemberStartResponse>(paths.memberStart, body, access);
}

