import { createServer } from 'node:http'
import type { Socket } from 'node:net'
import { WebSocket, WebSocketServer } from 'ws'
import { paths, type RealtimeAttachment, type ServerRealtimeFrame, type SharedRoomSnapshot } from '@goodwatch/yepwatch-contracts'
import { paths as continuousPaths, type ServerRealtimeFrame as ContinuousFrame, type SharedRoomSnapshot as ContinuousSnapshot } from '@goodwatch/yepwatch-contracts/continuous'
import { paths as proposalPaths, type SharedRoomSnapshot as ProposalSnapshot } from '@goodwatch/yepwatch-contracts/proposal'
import { AuthorityError, validateAttachment, validateView, validateScopedView, type Authority } from './authority.js'
import { continuousProjection } from './continuous-projection.js'
import { proposalProjection } from './proposal-projection.js'
import { inspectionAllowed, proposalClientActivitySchema, proposalServerActivitySchema } from './proposal-activity.js'
import { ActivityRelay, type ActivityBus, type ActivitySender } from './activity.js'
import type { RevisionBus } from './bus.js'
import { authenticateSchema } from './projection.js'

export const defaults = {
  host: '127.0.0.1', port: 4311,
  origins: ['http://localhost:8081', 'http://127.0.0.1:8081'],
  authTimeoutMs: 3000, apiTimeoutMs: 3000, maxLeaseMs: 60_000,
  auditMs: 10_000, heartbeatMs: 20_000, drainMs: 500,
  maxConnections: 512, maxPerIp: 32, maxPerParticipant: 4,
  maxRooms: 128, maxRoomConnections: 128, maxConcurrentRooms: 8,
  maxPayloadBytes: 8192, maxBufferedBytes: 2_000_000,
  maxFramesPerWindow: 20, frameWindowMs: 10_000,
}
export type GatewayOptions = typeof defaults
interface Client {
  ws: WebSocket; ip: string; authenticating: boolean; attachment?: RealtimeAttachment
  lastRevision: number; initial: boolean; degraded: boolean; alive: boolean
  frames: number; unauthControlFrames: number; windowAt: number; authTimer: NodeJS.Timeout; expiryTimer?: NodeJS.Timeout; closeTimer?: NodeJS.Timeout
  room?: Room
  activity?: ActivitySender; participantIds?: Set<string>
  inspectionMatches?: { matches: { candidateId: string }[] }
}
interface Room { id: string; clients: Set<Client>; target: number; epoch: number; running: boolean }
type OutputFrame = Exclude<ServerRealtimeFrame | ContinuousFrame, { snapshot: unknown }> |
  { type: 'room.snapshot' | 'room.updated'; snapshot: SharedRoomSnapshot | ContinuousSnapshot | ProposalSnapshot }

export function createGateway(authority: Authority, bus: RevisionBus, overrides: Partial<GatewayOptions> = {}, continuous?: { activityBus: ActivityBus; proposal?: boolean }) {
  const options = { ...defaults, ...(continuous ? { maxFramesPerWindow: 64 } : {}), ...overrides }
  const routes = continuous?.proposal ? proposalPaths : continuous ? continuousPaths : paths
  const deliveryReady = () => bus.ready && (!continuous || continuous.activityBus.ready)
  let draining = false
  const clients = new Set<Client>()
  const rooms = new Map<string, Room>()
  const pending = new Set<Room>()
  let running = 0
  let backpressureClosures = 0
  const cancellations = new Set<() => void>()
  const server = createServer((request, response) => {
    const health = request.method === 'GET' && request.url === `${routes.realtime}/health`
    response.writeHead(health && !draining && deliveryReady() ? 200 : health ? 503 : 404, {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    })
    response.end(health ? JSON.stringify({ ready: !draining && deliveryReady() }) : '{}')
  })
  server.maxConnections = options.maxConnections * 2
  server.headersTimeout = 5000
  server.requestTimeout = 5000
  server.keepAliveTimeout = 1000
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false,
    maxPayload: options.maxPayloadBytes, maxFragments: 32, maxBufferedChunks: 64, autoPong: false, clientTracking: false })

  function send(client: Client, frame: OutputFrame): boolean {
    if (client.ws.readyState !== WebSocket.OPEN) return false
    const data = JSON.stringify(frame)
    if (client.ws.bufferedAmount + Buffer.byteLength(data) > options.maxBufferedBytes) {
      backpressureClosures++
      close(client, 1013, 'Resync required')
      return false
    }
    client.ws.send(data, error => { if (error) client.ws.terminate() })
    return true
  }
  function close(client: Client, code: number, reason: string) {
    client.ws.close(code, reason)
    client.closeTimer ??= setTimeout(() => client.ws.terminate(), options.drainMs)
  }
  function fail(client: Client, code: 'unauthorized' | 'invalid_request' | 'expired' | 'limit_reached') {
    client.degraded = true
    send(client, { type: 'error', code })
    close(client, 1008, code)
  }
  function degrade(client: Client) {
    if (!client.degraded) send(client, { type: 'degraded', retryAfterMs: options.auditMs })
    client.degraded = true
  }
  function frameBudget(client: Client, control = false) {
    if (client.ws.readyState !== WebSocket.OPEN) return false
    if (Date.now() - client.windowAt >= options.frameWindowMs) { client.frames = 0; client.windowAt = Date.now() }
    if (++client.frames > options.maxFramesPerWindow || (control && !client.attachment && ++client.unauthControlFrames > 2)) {
      fail(client, 'limit_reached'); return false
    }
    return true
  }
  function expiry(client: Client) {
    clearTimeout(client.expiryTimer)
    const a = client.attachment!
    client.expiryTimer = setTimeout(() => fail(client, 'expired'),
      Math.max(1, Math.min(a.leaseExpiresAt, a.roomExpiresAt) - Date.now()))
  }
  async function bounded<T>(action: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined
    let cancel: (() => void) | undefined
    try {
      return await Promise.race([action, new Promise<never>((_, reject) => {
        cancel = () => reject(new AuthorityError(false))
        cancellations.add(cancel)
        timer = setTimeout(cancel, options.apiTimeoutMs)
      })])
    } finally { clearTimeout(timer); if (cancel) cancellations.delete(cancel) }
  }
  function enqueue(room: Room) {
    if (draining || !rooms.has(room.id)) return
    pending.add(room)
    queueMicrotask(pump)
  }
  function pump() {
    if (draining || !deliveryReady()) return
    for (const room of pending) {
      if (running >= options.maxConcurrentRooms) break
      if (room.running) continue
      pending.delete(room); room.running = true; running++
      void refresh(room).finally(() => { room.running = false; running--; pump() })
    }
  }
  async function refresh(room: Room) {
    // Bounded retries close attach races without spinning on a hint ahead of durable state.
    for (let attempt = 0; attempt < 3 && !draining && deliveryReady(); attempt++) {
      const epoch = room.epoch
      const target = room.target
      for (const client of room.clients) {
        if (client.ws.readyState !== WebSocket.OPEN || !client.attachment) continue
        if (client.attachment.leaseExpiresAt <= Date.now() || client.attachment.roomExpiresAt <= Date.now()) {
          fail(client, 'expired'); continue
        }
        try {
          const previous = client.attachment
          const raw = await bounded(authority.view({ roomId: room.id, lease: previous.lease }))
          if (client.ws.readyState !== WebSocket.OPEN || draining) continue
          const result = continuous ? validateScopedView<ContinuousSnapshot | ProposalSnapshot>(raw, previous, options.maxLeaseMs,
            continuous.proposal ? proposalProjection : continuousProjection) : validateView(raw, previous, options.maxLeaseMs)
          if (previous.leaseExpiresAt <= Date.now()) { fail(client, 'expired'); continue }
          client.attachment = result.attachment
          expiry(client)
          // Never forward reads made across a bus outage or a concurrently newer hint.
          if (!deliveryReady() || room.epoch !== epoch || result.snapshot.revision < room.target ||
              result.snapshot.revision < client.lastRevision) { degrade(client); continue }
          if (client.initial || client.degraded || result.snapshot.revision > client.lastRevision) {
            if (send(client, { type: client.initial || client.degraded ? 'room.snapshot' : 'room.updated', snapshot: result.snapshot })) {
              client.lastRevision = result.snapshot.revision; client.initial = false; client.degraded = false
              client.participantIds = new Set(result.snapshot.participants.map(p => p.participantId))
              if ('matches' in result.snapshot) client.inspectionMatches = { matches: result.snapshot.matches.map(m => ({ candidateId: m.candidateId })) }
              if (relay && !client.activity) {
                client.activity = relay.open(room.id, result.attachment.participantId,
                  () => !draining && !client.degraded && !client.initial && client.lastRevision >= room.target && deliveryReady() && client.ws.readyState === WebSocket.OPEN,
                  () => Math.min(client.attachment!.leaseExpiresAt, client.attachment!.roomExpiresAt),
                  activity => !continuous?.proposal || inspectionAllowed(activity, client.inspectionMatches))
                send(client, { type: 'activity.session', roomId: room.id, sessionId: client.activity.sessionId, serverTime: Date.now() })
              }
            }
          }
        } catch (error) {
          if (error instanceof AuthorityError && error.terminal) fail(client, 'unauthorized')
          else degrade(client)
        }
      }
      if (room.epoch === epoch && room.target === target) {
        // A future revision hint can precede a readable commit; do not present stale state as live.
        if ([...room.clients].some(c => c.lastRevision < room.target)) continue
        return
      }
    }
  }
  function onHint(hint: { roomId: string; revision: number }) {
    const room = rooms.get(hint.roomId)
    if (!room || hint.revision <= room.target) return
    room.target = hint.revision
    enqueue(room)
  }
  function onState(ready: boolean) {
    for (const room of rooms.values()) {
      room.epoch++
      for (const client of room.clients) degrade(client)
      if (ready && deliveryReady()) enqueue(room)
    }
  }
  const relay = continuous ? new ActivityRelay(continuous.activityBus, frame => {
    const room = rooms.get(frame.roomId)
    if (!room || !deliveryReady() || draining) return
    for (const client of room.clients) {
      const a = client.attachment
      if (!a || client.initial || client.degraded || client.lastRevision < room.target || a.participantId === frame.participantId ||
          a.leaseExpiresAt <= Date.now() || a.roomExpiresAt <= Date.now() || !client.participantIds?.has(frame.participantId)) continue
      if (continuous?.proposal && !inspectionAllowed(frame, client.inspectionMatches)) continue
      send(client, frame)
    }
  }, () => onState(false), 2048, continuous.proposal ? { client: proposalClientActivitySchema, server: proposalServerActivitySchema } : undefined) : undefined
  continuous?.activityBus.on('state', onState)
  bus.on('hint', onHint).on('state', onState)
  server.on('upgrade', (request, socket, head) => {
    const ip = (socket as Socket).remoteAddress ?? 'unknown'
    // Exact URL rejects query secrets; subprotocols are deliberately unsupported.
    const valid = request.method === 'GET' && request.url === routes.realtime &&
      !request.headers['sec-websocket-protocol'] &&
      (!request.headers.origin || options.origins.includes(request.headers.origin))
    const full = clients.size >= options.maxConnections || [...clients].filter(c => c.ip === ip).length >= options.maxPerIp
    if (draining || !valid || full) {
      socket.end(`HTTP/1.1 ${draining || full ? '503 Service Unavailable' : '403 Forbidden'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
      return
    }
    wss.handleUpgrade(request, socket, head, ws => {
      const client: Client = { ws, ip, authenticating: false, lastRevision: -1, initial: true,
        degraded: false, alive: true, frames: 0, unauthControlFrames: 0, windowAt: Date.now(),
        authTimer: setTimeout(() => fail(client, 'unauthorized'), options.authTimeoutMs) }
      clients.add(client)
      ws.on('error', () => { /* ws lifecycle handles transport errors; no frame logging. */ })
      ws.on('close', () => {
        if (client.activity) relay?.disconnect(client.activity, !draining && !client.degraded && !client.initial && deliveryReady() &&
          client.lastRevision >= (client.room?.target ?? 0) && Math.min(client.attachment!.leaseExpiresAt, client.attachment!.roomExpiresAt) > Date.now())
        clearTimeout(client.authTimer); clearTimeout(client.expiryTimer); clearTimeout(client.closeTimer); clients.delete(client)
        const room = client.room
        if (room) {
          room.clients.delete(client)
          if (!room.clients.size) { rooms.delete(room.id); pending.delete(room) }
        }
      })
      ws.on('pong', () => { if (frameBudget(client, true)) client.alive = true })
      ws.on('ping', data => { if (frameBudget(client, true)) ws.pong(data) })
      ws.on('message', (data, binary) => {
        if (binary) { fail(client, 'invalid_request'); return }
        if (!frameBudget(client)) return
        let input: unknown
        try { input = JSON.parse(data.toString()) } catch { fail(client, 'invalid_request'); return }
        if (client.attachment) {
          if (input && typeof input === 'object' && Object.keys(input).length === 1 && (input as { type?: unknown }).type === 'ping') send(client, { type: 'pong' })
          else if (relay && client.activity) {
            const result = relay.accept(client.activity, input)
            if (result === 'invalid') fail(client, 'invalid_request')
          }
          else fail(client, 'invalid_request')
          return
        }
        // Exactly one application frame is allowed before authentication completes.
        if (client.authenticating) { fail(client, 'unauthorized'); return }
        client.authenticating = true
        const parsed = authenticateSchema.safeParse(input)
        if (!parsed.success) { fail(client, 'invalid_request'); return }
        void (async () => {
          try {
            const request = { roomId: parsed.data.roomId, ticket: parsed.data.ticket }
            const attachment = validateAttachment(await bounded(authority.attach(request)), request.roomId, options.maxLeaseMs)
            if (ws.readyState !== WebSocket.OPEN || draining) return
            let room = rooms.get(request.roomId)
            if ((!room && rooms.size >= options.maxRooms) || (room && room.clients.size >= options.maxRoomConnections) ||
              (room && [...room.clients].filter(c => c.attachment?.participantId === attachment.participantId).length >= options.maxPerParticipant)) {
              fail(client, 'limit_reached'); return
            }
            clearTimeout(client.authTimer)
            client.attachment = attachment; expiry(client)
            if (!room) {
              room = { id: request.roomId, clients: new Set(), target: 0, epoch: 0, running: false }
              rooms.set(room.id, room)
            }
            client.room = room; room.clients.add(client)
            if (!deliveryReady()) degrade(client)
            // Global subscription ACK is required before ANY final authorized read.
            enqueue(room)
          } catch (error) {
            if (error instanceof AuthorityError && error.terminal) fail(client, 'unauthorized')
            else { degrade(client); close(client, 1013, 'Authority unavailable') }
          }
        })()
      })
    })
  })
  const audit = setInterval(() => {
    for (const room of rooms.values()) {
      if (room.running) continue
      enqueue(room)
    }
  }, options.auditMs)
  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (client.ws.readyState !== WebSocket.OPEN) { client.ws.terminate(); continue }
      if (!client.alive) { client.ws.terminate(); continue }
      if (client.ws.bufferedAmount > options.maxBufferedBytes) { close(client, 1013, 'Resync required'); continue }
      client.alive = false; client.ws.ping()
    }
  }, options.heartbeatMs)
  return {
    server,
    stats: () => ({ connections: clients.size, activeRooms: rooms.size, backpressureClosures }),
    async listen() {
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(options.port, options.host, () => { server.off('error', reject); resolve() }) })
      void bus.start()
      if (continuous) void continuous.activityBus.start()
      return server.address()
    },
    async close() {
      draining = true; clearInterval(audit); clearInterval(heartbeat)
      bus.off('hint', onHint).off('state', onState); bus.close()
      continuous?.activityBus.off('state', onState); relay?.close()
      pending.clear()
      for (const cancel of cancellations) cancel()
      cancellations.clear(); authority.close?.()
      const closed = new Promise<void>(resolve => server.close(() => resolve()))
      for (const client of clients) { send(client, { type: 'restarting', retryAfterMs: 500 }); client.ws.close(1012, 'Service restart') }
      const timer = setTimeout(() => { for (const client of clients) client.ws.terminate(); server.closeAllConnections() }, options.drainMs)
      await closed; clearTimeout(timer); wss.close()
    },
  }
}
