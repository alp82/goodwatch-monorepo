import { paths, type RealtimeAttachRequest, type RealtimeAttachment, type RealtimeViewRequest } from '@goodwatch/yepwatch-contracts'
import { attachmentSchema, sharedProjection } from './projection.js'

export class AuthorityError extends Error {
  constructor(public readonly terminal: boolean) { super('Authority unavailable') }
}
export interface Authority {
  close?(): void
  attach(request: RealtimeAttachRequest): Promise<RealtimeAttachment>
  view(request: RealtimeViewRequest): Promise<unknown>
}
export function validateAttachment(input: unknown, roomId: string, maxLeaseMs: number): RealtimeAttachment {
  const result = attachmentSchema.parse(input)
  const now = Date.now()
  if (result.roomId !== roomId || result.leaseExpiresAt <= now || result.roomExpiresAt <= now ||
      result.leaseExpiresAt > result.roomExpiresAt || result.leaseExpiresAt > now + maxLeaseMs) {
    throw new AuthorityError(true)
  }
  return result
}
export function validateView(input: unknown, previous: RealtimeAttachment, maxLeaseMs: number) {
  return validateScopedView(input, previous, maxLeaseMs, sharedProjection)
}
export function validateScopedView<S extends { expiresAt: number; phase: string; participants: { participantId: string }[] }>(
  input: unknown, previous: RealtimeAttachment, maxLeaseMs: number, projection: (input: unknown, roomId: string) => S,
) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AuthorityError(false)
  const { snapshot, ...rest } = input as Record<string, unknown>
  const attachment = validateAttachment(rest, previous.roomId, maxLeaseMs)
  if (attachment.participantId !== previous.participantId || attachment.capabilityEpoch !== previous.capabilityEpoch) {
    throw new AuthorityError(true)
  }
  const shared = projection(snapshot, previous.roomId)
  if (shared.expiresAt !== attachment.roomExpiresAt || shared.phase === 'expired' ||
      !shared.participants.some(p => p.participantId === attachment.participantId)) throw new AuthorityError(true)
  return { attachment, snapshot: shared }
}

export class HttpAuthority implements Authority {
  private shutdown = new AbortController()
  close() { this.shutdown.abort() }
  constructor(private base: string, private secret: string, private timeoutMs = 3000, private maxBytes = 2_000_000,
    private routes: { realtimeAttach: string; realtimeView: string } = paths) {
    const url = new URL(base)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid API origin')
    if (secret.length < 32) throw new Error('Service credential must contain at least 32 characters')
  }
  private async post(path: string, body: unknown): Promise<unknown> {
    try {
      const response = await fetch(new URL(path, this.base), {
        method: 'POST', redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(this.timeoutMs), this.shutdown.signal]),
        headers: { Authorization: `Bearer ${this.secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new AuthorityError([400, 401, 403, 404, 410].includes(response.status))
      }
      if (!response.headers.get('content-type')?.includes('application/json')) { await response.body?.cancel(); throw new AuthorityError(false) }
      const reader = response.body?.getReader()
      if (!reader) throw new AuthorityError(false)
      const chunks: Uint8Array[] = []
      let size = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > this.maxBytes) { await reader.cancel(); throw new AuthorityError(false) }
        chunks.push(value)
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch (error) {
      if (error instanceof AuthorityError) throw error
      // Never surface bodies, credentials, URLs, signed leases or frames through errors/logs.
      throw new AuthorityError(false)
    }
  }
  async attach(request: RealtimeAttachRequest): Promise<RealtimeAttachment> {
    return attachmentSchema.parse(await this.post(this.routes.realtimeAttach, request))
  }
  view(request: RealtimeViewRequest) { return this.post(this.routes.realtimeView, request) }
}
