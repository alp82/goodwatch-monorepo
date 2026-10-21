import { EventEmitter } from 'node:events'
import { Redis, Cluster, type RedisOptions } from 'ioredis'
import { REVISION_CHANNEL, type RoomInvalidation } from '@goodwatch/yepwatch-contracts'
import { hintSchema } from './projection.js'

export interface RevisionBus {
  readonly ready: boolean
  start(): Promise<void>
  on(event: 'hint', listener: (hint: RoomInvalidation) => void): this
  on(event: 'state', listener: (ready: boolean) => void): this
  off(event: string, listener: (...args: any[]) => void): this
  close(): void
}
export interface BusConfig {
  url?: string; nodes?: { host: string; port: number }[]; password?: string; username?: string
}
export class ValkeyBus extends EventEmitter implements RevisionBus {
  ready = false
  private subscriber?: Redis
  private discovery?: Cluster
  private stopped = false
  private started = false
  private candidate = 0
  private retry?: NodeJS.Timeout
  private health?: NodeJS.Timeout
  private probing = false
  private options: RedisOptions
  constructor(private config: BusConfig) {
    super()
    this.options = { enableOfflineQueue: false, maxRetriesPerRequest: 0,
      connectTimeout: 1000, commandTimeout: 1500, lazyConnect: true,
      autoResubscribe: false, retryStrategy: n => Math.min(n * 100, 2000),
      password: config.password, username: config.username }
    if (config.nodes?.length) {
      this.discovery = new Cluster(config.nodes, {
        lazyConnect: true, enableOfflineQueue: false, dnsLookup: (address, cb) => cb(null, address),
        clusterRetryStrategy: n => Math.min(n * 100, 2000), redisOptions: this.options,
      })
      this.discovery.on('ready', () => this.selectSubscriber())
      for (const event of ['close', 'end', 'reconnecting', 'error']) this.discovery.on(event, () => this.state(false))
      this.discovery.on('+node', () => { if (!this.subscriber) this.selectSubscriber() })
      this.discovery.on('-node', (node: Redis) => {
        if (this.subscriber && this.subscriber.options.host === node.options.host && this.subscriber?.options.port === node.options.port) {
          this.state(false); this.subscriber.disconnect(); this.subscriber = undefined; this.selectSubscriber()
        }
      })
    }
  }
  private state(value: boolean) {
    if (this.stopped) value = false
    if (this.ready !== value) { this.ready = value; this.emit('state', value) }
  }
  private selectSubscriber() {
    if (this.stopped || this.subscriber) return
    if (this.discovery && this.discovery.status !== 'ready') return
    const candidates = this.discovery?.nodes('master')
    if (candidates && !candidates.length) return
    // Standard (non-sharded) Pub/Sub propagates cluster-wide. Use public discovery
    // plus a dedicated observable Redis connection: Cluster hides subscriber loss.
    const node = candidates?.[this.candidate++ % candidates.length]
    const subscriber = node ? new Redis({ ...this.options, host: node.options.host, port: node.options.port, retryStrategy: null })
      : new Redis(this.config.url ?? 'redis://127.0.0.1:46379', this.options)
    this.subscriber = subscriber
    subscriber.on('ready', () => { void this.subscribe(subscriber) })
    for (const event of ['close', 'reconnecting', 'error']) subscriber.on(event, () => {
      if (this.subscriber === subscriber) this.state(false)
    })
    subscriber.on('end', () => {
      if (this.subscriber !== subscriber || this.stopped) return
      this.state(false); this.subscriber = undefined
      this.retry = setTimeout(() => this.selectSubscriber(), 200)
    })
    subscriber.on('message', (channel, message) => {
      if (this.subscriber !== subscriber || !this.ready || channel !== REVISION_CHANNEL || message.length > 1024) return
      try {
        const hint = hintSchema.safeParse(JSON.parse(message))
        if (hint.success) this.emit('hint', hint.data)
      } catch { /* Invalid messages never become room data. Audit repairs missing hints. */ }
    })
    void subscriber.connect().catch(() => this.state(false))
  }
  private async subscribe(subscriber: Redis) {
    try {
      await subscriber.subscribe(REVISION_CHANNEL)
      if (this.subscriber === subscriber && subscriber.status === 'ready' && (!this.discovery || this.discovery.status === 'ready')) this.state(true)
    } catch { this.state(false) }
  }
  async start() {
    if (this.started || this.stopped) return
    this.started = true
    this.health = setInterval(() => {
      if (!this.subscriber) { this.selectSubscriber(); return }
      if (this.probing || this.subscriber.status !== 'ready') return
      this.probing = true
      // Re-ACK on the actual subscriber detects half-open/failed delivery paths.
      void this.subscribe(this.subscriber).finally(() => { this.probing = false })
    }, 2000)
    if (this.discovery) { try { await this.discovery.connect() } catch { this.state(false) } }
    else this.selectSubscriber()
  }
  close() {
    this.stopped = true; this.state(false); clearTimeout(this.retry); clearInterval(this.health)
    this.subscriber?.disconnect(); this.discovery?.disconnect()
  }
}
