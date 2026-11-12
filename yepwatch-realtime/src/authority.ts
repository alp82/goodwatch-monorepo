import { z } from 'zod'
import { paths, type RealtimeAttachRequest, type RealtimeAttachment, type RealtimeViewRequest } from '@goodwatch/yepwatch-contracts'
import { attachmentSchema, sharedProjection } from './projection.js'

export class AuthorityError extends Error {
  /** `status`: the API's HTTP status, when it answered with one. */
  constructor(public readonly terminal: boolean, public readonly status?: number) { super('Authority unavailable') }
}
export interface Authority {
  close?(): void
  attach(request: RealtimeAttachRequest): Promise<RealtimeAttachment>
  view(request: RealtimeViewRequest): Promise<unknown>
  /** Every lease held on one room, answered from one read of it (proposal API only; 404 from an API without it). */
  views?(request: { roomId: string; leases: string[] }): Promise<unknown>
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

const refusal = z.strictObject({ error: z.strictObject({ code: z.string().max(64), status: z.number().int().min(400).max(599) }) })
const viewsSchema = z.strictObject({ snapshot: z.unknown(), views: z.array(z.union([refusal, z.record(z.string(), z.unknown())])) })
/**
 * A batched views answer for `count` leases, per lease in order: its view (attachment and the shared snapshot, for
 * validateScopedView like a single view) or the refusal a single view would have thrown.
 */
export function viewsOf(input: unknown, count: number): ({ view: unknown } | { error: AuthorityError })[] {
  const parsed = viewsSchema.safeParse(input)
  if (!parsed.success || parsed.data.views.length !== count) throw new AuthorityError(false)
  const { snapshot, views } = parsed.data
  return views.map(view => {
    const refused = refusal.safeParse(view)
    return refused.success
      ? { error: new AuthorityError([400, 401, 403, 404, 410].includes(refused.data.error.status), refused.data.error.status) }
      : { view: { ...view, snapshot } }
  })
}
/** A projection that validates each snapshot object once (phones answered from one read share it). */
export function once<S>(projection: (input: unknown, roomId: string) => S): (input: unknown, roomId: string) => S {
  const seen = new WeakMap<object, { value: S } | { error: unknown }>()
  return (input, roomId) => {
    if (!input || typeof input !== 'object') return projection(input, roomId)
    let result = seen.get(input)
    if (!result) {
      try { result = { value: projection(input, roomId) } } catch (error) { result = { error } }
      seen.set(input, result)
    }
    if ('error' in result) throw result.error
    return result.value
  }
}

export class HttpAuthority implements Authority {
  private shutdown = new AbortController()
  close() { this.shutdown.abort() }
  constructor(private base: string, private secret: string, private timeoutMs = 3000, private maxBytes = 2_000_000,
    private routes: { realtimeAttach: string; realtimeView: string; realtimeViews?: string } = paths) {
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
        throw new AuthorityError([400, 401, 403, 404, 410].includes(response.status), response.status)
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
  get views() {
    const path = this.routes.realtimeViews
    return path ? (request: { roomId: string; leases: string[] }) => this.post(path, request) : undefined
  }
}
