import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { Redis, Cluster } from 'ioredis'
import { ACTIVITY_CHANNEL, ACTIVITY_LIMITS, type ClientActivity, type ServerActivity } from '@goodwatch/yepwatch-contracts/continuous'
import type { z } from 'zod'
import type { ActivityPointer } from '@goodwatch/yepwatch-contracts/proposal'
import type { Inspection } from './proposal-activity.js'
import { ValkeyBus, type BusConfig } from './bus.js'
import { clientActivitySchema, serverActivitySchema } from './activity-protocol.js'

export type ActivityInput = ClientActivity & { inspection?: Inspection; pointer?: ActivityPointer | null }
export type ActivityFrame = ServerActivity & { inspection?: Inspection; pointer?: ActivityPointer | null }
export interface ActivityProtocol { client: z.ZodType<ActivityInput>; server: z.ZodType<ActivityFrame> }
const continuousProtocol: ActivityProtocol = { client: clientActivitySchema, server: serverActivitySchema }

export interface ActivityBus extends EventEmitter {
  readonly ready: boolean
  start(): Promise<void>
  publish(frame: ActivityFrame): Promise<boolean>
  close(): void
}
/** Separate ephemeral channel; standard cluster Pub/Sub, never a room revision payload. */
export class ValkeyActivityBus extends EventEmitter implements ActivityBus {
  private subscriber: ValkeyBus
  private publisher: Redis | Cluster
  private stopped = false
  private started = false
  ready = false
  constructor(config: BusConfig, private channel: string = ACTIVITY_CHANNEL, private schema: z.ZodType<ActivityFrame> = serverActivitySchema) {
    super()
    this.subscriber = new ValkeyBus(config, channel)
    const options = { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 0,
      connectTimeout: 1000, commandTimeout: 1000, retryStrategy: (n: number) => Math.min(n * 100, 2000),
      password: config.password, username: config.username }
    this.publisher = config.nodes?.length ? new Cluster(config.nodes, { lazyConnect: true, enableOfflineQueue: false,
      dnsLookup: (address, cb) => cb(null, address), redisOptions: options })
      : new Redis(config.url ?? 'redis://127.0.0.1:46379', options)
    const state = () => {
      const ready = !this.stopped && this.subscriber.ready && this.publisher.status === 'ready'
      if (ready !== this.ready) { this.ready = ready; this.emit('state', ready) }
    }
    this.subscriber.on('state', state)
    this.subscriber.on('payload', (raw: string) => {
      if (!this.ready) return
      try { const frame = this.schema.safeParse(JSON.parse(raw)); if (frame.success) this.emit('activity', frame.data) } catch { /* Never log activity. */ }
    })
    for (const event of ['ready', 'close', 'end', 'reconnecting', 'error']) this.publisher.on(event, state)
  }
  async start() {
    if (this.started || this.stopped) return
    this.started = true
    await Promise.all([this.subscriber.start(), this.publisher.connect().then(() => {}, () => {})])
  }
  async publish(frame: ActivityFrame) {
    if (!this.ready) return false
    try { await this.publisher.publish(this.channel, JSON.stringify(frame)); return this.ready } catch { return false }
  }
  close() {
    this.stopped = true; this.subscriber.close(); this.publisher.disconnect()
    if (this.ready) { this.ready = false; this.emit('state', false) }
  }
}
interface Bucket { tokens: number; time: number }
function budget(bucket: Bucket, rate: number, burst: number) {
  const now = Date.now()
  bucket.tokens = Math.min(burst, bucket.tokens + (now - bucket.time) * rate / 1000); bucket.time = now
  if (bucket.tokens < 1) return false
  bucket.tokens--; return true
}
export interface ActivitySender {
  readonly sessionId: string; roomId: string; participantId: string; sequence: number
  bucket: Bucket; eligible: () => boolean; leaseExpiry: () => number
  permits: (activity: ActivityInput) => boolean
}
export class ActivityRelay {
  private pending = new Map<string, { frame: ActivityFrame; eligible: () => boolean }>()
  private seen = new Map<string, { participantId: string; sequence: number; expiresAt: number }>()
  private participants = new Map<string, { count: number; bucket: Bucket }>()
  private timer: NodeJS.Timeout
  private flushing = false
  private closed = false
  private notBefore = 0
  constructor(private bus: ActivityBus, private deliver: (frame: ActivityFrame) => void,
    private uncertain: () => void, private maxSessions = 2048, private protocol = continuousProtocol) {
    bus.on('activity', this.receive)
    bus.on('state', this.state)
    this.timer = setInterval(() => { this.expire(); void this.flush() }, 250)
  }
  private state = (ready: boolean) => {
    this.notBefore = Date.now()
    if (!ready) this.pending.clear()
  }
  private expire() { for (const [key, value] of this.seen) if (value.expiresAt <= Date.now()) this.seen.delete(key) }
  private receive = (input: unknown) => {
    if (!this.bus.ready || this.closed) return
    const parsed = this.protocol.server.safeParse(input)
    if (!parsed.success) return
    const frame = parsed.data, now = Date.now()
    if (frame.serverTime < this.notBefore || frame.serverTime > now + 2000 || frame.expiresAt <= now || frame.expiresAt <= frame.serverTime ||
        frame.expiresAt > frame.serverTime + ACTIVITY_LIMITS.viewTtlMs ||
        (frame.view === 'away' && (frame.gesture || frame.beat))) return
    const key = `${frame.roomId}/${frame.sessionId}`, previous = this.seen.get(key)
    if ((previous && (frame.participantId !== previous.participantId || frame.sequence <= previous.sequence)) ||
        (!previous && this.seen.size >= this.maxSessions)) return
    this.seen.set(key, { participantId: frame.participantId, sequence: frame.sequence, expiresAt: frame.expiresAt })
    // Pulse semantics expire sooner than the foreground view; never replay a stale beat.
    if (frame.serverTime + ACTIVITY_LIMITS.pulseTtlMs <= now) { delete frame.gesture; delete frame.beat; delete frame.inspection; delete frame.pointer }
    this.deliver(frame)
  }
  open(roomId: string, participantId: string, eligible: () => boolean, leaseExpiry: () => number,
    permits: (activity: ActivityInput) => boolean = () => true): ActivitySender {
    const key = `${roomId}/${participantId}`
    const participant = this.participants.get(key) ?? { count: 0, bucket: { tokens: 16, time: Date.now() } }
    participant.count++; this.participants.set(key, participant)
    return { roomId, participantId, sessionId: randomUUID(), sequence: -1,
      bucket: { tokens: ACTIVITY_LIMITS.burst, time: Date.now() }, eligible, leaseExpiry, permits }
  }
  accept(sender: ActivitySender, input: unknown): 'accepted' | 'stale' | 'invalid' | 'limited' | 'unavailable' {
    const parsed = this.protocol.client.safeParse(input)
    if (!parsed.success || parsed.data.sessionId !== sender.sessionId ||
        (parsed.data.view === 'away' && (parsed.data.gesture || parsed.data.beat))) return 'invalid'
    if (!this.bus.ready || !sender.eligible() || sender.leaseExpiry() <= Date.now()) return 'unavailable'
    const activity = parsed.data
    if (activity.sequence <= sender.sequence) return 'stale'
    // Advance fencing even for dropped/coalesced rate-limited input.
    sender.sequence = activity.sequence
    if (!sender.permits(activity)) return 'unavailable'
    const participant = this.participants.get(`${sender.roomId}/${sender.participantId}`)
    if (!budget(sender.bucket, ACTIVITY_LIMITS.framesPerSecond, ACTIVITY_LIMITS.burst) ||
        !participant || !budget(participant.bucket, 8, 16)) return 'limited'
    const serverTime = Date.now()
    if (!this.pending.has(sender.sessionId) && this.pending.size >= this.maxSessions) return 'limited'
    this.pending.set(sender.sessionId, { frame: { ...activity, roomId: sender.roomId, participantId: sender.participantId,
      serverTime, expiresAt: Math.min(serverTime + ACTIVITY_LIMITS.viewTtlMs, sender.leaseExpiry()) },
      eligible: () => sender.eligible() && sender.permits(activity) })
    return 'accepted'
  }
  disconnect(sender: ActivitySender, authorized = sender.eligible()) {
    this.pending.delete(sender.sessionId)
    if (!this.closed && this.bus.ready && authorized && sender.sequence < Number.MAX_SAFE_INTEGER && this.pending.size < this.maxSessions) {
      const serverTime = Date.now(), expiresAt = Math.min(serverTime + ACTIVITY_LIMITS.viewTtlMs, sender.leaseExpiry())
      if (expiresAt > serverTime) this.pending.set(sender.sessionId, { frame: { type: 'activity', roomId: sender.roomId,
        participantId: sender.participantId, sessionId: sender.sessionId, sequence: sender.sequence + 1,
        view: 'away', serverTime, expiresAt }, eligible: () => expiresAt > Date.now() })
    }
    const key = `${sender.roomId}/${sender.participantId}`, participant = this.participants.get(key)
    if (participant && --participant.count === 0) this.participants.delete(key)
  }
  private async flush() {
    if (this.flushing || this.closed || !this.bus.ready) return
    this.flushing = true
    try {
      let processed = 0
      for (const [key, pending] of this.pending) {
        if (++processed > 64) break
        this.pending.delete(key)
        const { frame } = pending
        if (frame.expiresAt <= Date.now() || !pending.eligible()) continue
        if (!await this.bus.publish(frame)) { this.pending.clear(); this.uncertain(); return }
        if (this.closed || !this.bus.ready) return
      }
    } finally { this.flushing = false }
  }
  close() {
    this.closed = true; clearInterval(this.timer)
    this.bus.off('activity', this.receive).off('state', this.state)
    this.pending.clear(); this.seen.clear(); this.participants.clear(); this.bus.close()
  }
}
