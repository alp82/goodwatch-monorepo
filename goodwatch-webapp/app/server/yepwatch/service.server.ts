import type { Candidate, CommandEnvelope, CommandResult, GuestAdmission, GuestAdmissionRequest, JoinRoomRequest, RealtimeAttachment, RealtimeTicket, RealtimeViewResponse, ShowProgressResponse } from '../../../packages/yepwatch-contracts/index.ts'
import { equal, hash, keyed, random, sign, verify } from './crypto.server.ts'
import { IndeterminateWrite, requireRoom, RoomError } from './errors.ts'
import { live, participant, progressConflicts, shared, snapshot, transition } from './machine.ts'
import { continuationProposal } from './progress.ts'
import { LIMITS, type CatalogPort, type Participant, type RevisionPublisher, type Room, type RoomRepository, type StoredRoom } from './types.ts'
export interface ActorCredential { participantId: string; token: string }
interface Lease { roomId: string; participantId: string; epoch: number; expiresAt: number; scope: 'shared:read' }
export class YepWatchService {
  readonly repository: RoomRepository; readonly catalog: CatalogPort
  private secret: string; private publish: RevisionPublisher; private now: () => number
  constructor(repository: RoomRepository, catalog: CatalogPort, secret: string, publish: RevisionPublisher = async () => {}, now: () => number = Date.now) {
    this.repository = repository; this.catalog = catalog; this.secret = secret; this.publish = publish; this.now = now
    if (secret.length < 32) throw new Error('YepWatch server secret must contain at least 32 characters')
  }
  private admission(roomId: string, request: GuestAdmissionRequest) {
    const seed = JSON.stringify([roomId, request.commandId, request.admissionSecret])
    return { id: keyed(this.secret, 'participant', seed).slice(0, 32), token: keyed(this.secret, 'guest', seed), digest: hash(JSON.stringify(request)) }
  }
  private member(id: string, nickname: string, token: string, digest: string, commandId: string): Participant {
    return { id, nickname, tokenHash: hash(token), admissionHash: digest, admissionCommand: commandId, screenId: null, ready: false, epoch: 1, nextSequence: 1, votes: {}, progress: [], complete: false, preference: null, consent: null, receipts: [] }
  }
  private invite(roomId: string) { return `${roomId}.${keyed(this.secret, 'invite', roomId)}` }
  private async get(id: string): Promise<StoredRoom> { const stored = await this.repository.read(id); requireRoom(stored, 'not_found', 'Room unavailable', 404); live(stored.room, this.now()); return stored }
  private auth(room: Room, credential: ActorCredential) { const p = participant(room, credential.participantId); requireRoom(equal(p.tokenHash, hash(credential.token)), 'unauthorized', 'Invalid participant credential', 401); return p }
  async read(id: string, credential: ActorCredential) { const stored = await this.get(id); const p = this.auth(stored.room, credential); return snapshot(stored.room, p.id) }
  async recoverAdmission(id: string, credential: ActorCredential): Promise<GuestAdmission> {
    const { room } = await this.get(id); const p = this.auth(room, credential); const code = this.invite(id)
    return { recovered: true, credential: { roomId: id, participantId: p.id, token: credential.token, expiresAt: room.expiresAt }, invite: { code, path: `/r/${code}` }, snapshot: snapshot(room, p.id) }
  }
  private admitted(room: Room, request: GuestAdmissionRequest): GuestAdmission {
    const { id, token, digest } = this.admission(room.id, request); const p = participant(room, id)
    requireRoom(equal(p.admissionHash, digest), 'conflict', 'Admission retry changed')
    const code = this.invite(room.id)
    return { credential: { roomId: room.id, participantId: id, token, expiresAt: room.expiresAt }, invite: { code, path: `/r/${code}` }, snapshot: snapshot(room, id) }
  }
  async create(request: GuestAdmissionRequest): Promise<GuestAdmission> {
    const id = keyed(this.secret, 'room', JSON.stringify([request.commandId, request.admissionSecret])).slice(0, 32)
    const identity = this.admission(id, request)
    for (let attempt = 0; attempt < 4; attempt++) {
      const existing = await this.repository.read(id)
      if (existing) { live(existing.room, this.now()); const result = this.admitted(existing.room, request); await this.notify(id); return result }
      const room: Room = { format: 1, id, revision: 1, expiresAt: this.now() + LIMITS.roomMs, hostId: identity.id, inviteHash: hash(this.invite(id)), phase: 'setup', rosterVersion: 1, contextVersion: 1, roundVersion: 0,
        screens: [], constraints: { kinds: ['movie', 'show_start', 'show_continue'], maxMinutes: null, moods: [] }, episodeProposals: [], participants: [this.member(identity.id, request.nickname, identity.token, identity.digest, request.commandId)], round: null, candidates: [], shortlist: null, shortlistVersion: 0, proposalVersion: 0, proposedId: null, decision: null, tickets: [] }
      try { await this.repository.insert(room) } catch (e) { if (!(e instanceof IndeterminateWrite)) throw e }
      // Always recover the authoritative post-commit result by full primary key, never return a locally proposed aggregate.
    }
    const stored = await this.repository.read(id)
    if (stored) { live(stored.room, this.now()); const result = this.admitted(stored.room, request); await this.notify(id); return result }
    throw new RoomError('outcome_unknown', 'Retain and retry the same admission', 503, true)
  }
  async resolveInvite(code: string) {
    const [id, proof, extra] = code.split('.')
    requireRoom(id && proof && !extra && /^[A-Za-z0-9_-]{32}$/.test(id), 'not_found', 'Invite unavailable', 404)
    const { room } = await this.get(id)
    requireRoom(equal(room.inviteHash, hash(code)), 'not_found', 'Invite unavailable', 404)
    return { roomId: id }
  }
  async join(id: string, request: JoinRoomRequest): Promise<GuestAdmission> {
    await this.resolveInvite(request.inviteCode)
    const identity = this.admission(id, { commandId: request.commandId, admissionSecret: request.admissionSecret, nickname: request.nickname })
    // Admission hash includes the invite/screen so a command ID cannot silently change the requested action.
    const base = { commandId: request.commandId, admissionSecret: request.admissionSecret, nickname: request.nickname }
    for (let attempt = 0; attempt < 6; attempt++) {
      const previous = await this.get(id); const room = structuredClone(previous.room)
      requireRoom(equal(room.inviteHash, hash(request.inviteCode)), 'not_found', 'Invite unavailable', 404)
      const existing = room.participants.find(p => p.id === identity.id)
      if (existing) { const admission = this.admitted(room, base); await this.notify(id); return admission }
      requireRoom(room.participants.length < LIMITS.participants, 'limit_reached', 'Room is full')
      if (request.screenId) requireRoom(room.screens.some(s => s.id === request.screenId), 'invalid_request', 'Unknown screen', 400)
      const member = this.member(identity.id, request.nickname, identity.token, identity.digest, request.commandId); member.screenId = request.screenId ?? null
      room.participants.push(member); room.rosterVersion++; room.revision++
      // Existing round roster stays frozen. Late arrivals wait; joining during setup invalidates readiness.
      if (room.phase === 'setup') for (const p of room.participants) p.ready = false
      try { await this.repository.compareAndSwap(previous, room, true) } catch (e) { if (!(e instanceof IndeterminateWrite)) throw e }
    }
    const stored = await this.get(id)
    if (stored.room.participants.some(p => p.id === identity.id)) { await this.notify(id); return this.admitted(stored.room, base) }
    throw new RoomError('outcome_unknown', 'Retain and retry the same admission', 503, true)
  }
  async command(id: string, credential: ActorCredential, envelope: CommandEnvelope): Promise<CommandResult> {
    const digest = hash(JSON.stringify(envelope)); let uncertain = false
    for (let attempt = 0; attempt < 6; attempt++) {
      const previous = await this.get(id); const actor = this.auth(previous.room, credential)
      const receipt = actor.receipts.find(r => r.commandId === envelope.commandId || r.sequence === envelope.sequence)
      if (receipt) {
        requireRoom(receipt.digest === digest, 'conflict', 'Command ID or sequence reused with another command')
        await this.notify(id)
        return { receipt: { commandId: receipt.commandId, sequence: receipt.sequence, appliedRevision: receipt.revision, replayed: true }, snapshot: snapshot(previous.room, actor.id) }
      }
      requireRoom(envelope.sequence >= actor.nextSequence, 'outcome_unknown', 'Receipt no longer retained; resnapshot and reconcile')
      requireRoom(envelope.sequence === actor.nextSequence, 'conflict', 'Commands must be sent in sequence')
      let prepared: Candidate[] | undefined; let rechecked: Candidate['availability'] | undefined
      let proposedEpisode: import('../../../packages/yepwatch-contracts/index.ts').EpisodeIdentity | undefined
      if (envelope.command.type === 'propose_episode') {
        requireRoom(previous.room.hostId === actor.id, 'forbidden', 'Host capability required', 403)
        const c = envelope.command; proposedEpisode = (await this.catalog.episodes(c.showId)).find(e => e.tmdbId === c.episodeId)
        requireRoom(proposedEpisode, 'catalog_unavailable', 'Canonical episode unavailable', 503)
      }
      if (envelope.command.type === 'show_progress') {
        const progressCommand = envelope.command
        const episodes = await this.catalog.episodes(progressCommand.showId)
        const input = progressCommand.input
        requireRoom(episodes.length, 'catalog_unavailable', 'Episode catalog unavailable', 503)
        requireRoom(input.state !== 'continue' || episodes.some(e => e.tmdbId === input.nextEpisodeId), 'invalid_request', 'Unknown canonical episode', 400)
        requireRoom(progressCommand.approvedEpisodeId === null || episodes.some(e => e.tmdbId === progressCommand.approvedEpisodeId), 'invalid_request', 'Unknown approved episode', 400)
      }
      if (envelope.command.type === 'start_round') prepared = await this.catalog.candidates(previous.room)
      if (envelope.command.type === 'decide') {
        const candidate = previous.room.candidates.find(c => c.id === previous.room.proposedId)
        requireRoom(candidate, 'conflict', 'No active candidate'); rechecked = await this.catalog.recheck(previous.room, candidate)
      }
      const room = transition(previous.room, actor.id, envelope, this.now(), prepared, rechecked, proposedEpisode)
      const changed = participant(room, actor.id); changed.nextSequence++
      changed.receipts.push({ commandId: envelope.commandId, sequence: envelope.sequence, digest, revision: room.revision })
      changed.receipts = changed.receipts.slice(-LIMITS.receipts)
      try {
        if (!await this.repository.compareAndSwap(previous, room, true)) continue
      } catch (e) { if (!(e instanceof IndeterminateWrite)) throw e; uncertain = true; continue }
      const committed = await this.get(id); const durableReceipt = participant(committed.room, actor.id).receipts.find(r => r.digest === digest)
      if (!durableReceipt) { uncertain = true; continue }
      await this.notify(id)
      return { receipt: { commandId: envelope.commandId, sequence: envelope.sequence, appliedRevision: durableReceipt.revision, replayed: false }, snapshot: snapshot(committed.room, actor.id) }
    }
    throw new RoomError(uncertain ? 'outcome_unknown' : 'busy', 'Retain and retry the same command', 503, true)
  }
  async showProgress(id: string, credential: ActorCredential, showId: number): Promise<ShowProgressResponse> {
    const { room } = await this.get(id); const actor = this.auth(room, credential)
    const own = actor.progress.find(p => p.showId === showId) ?? { showId, input: { state: 'unknown' as const }, approvedEpisodeId: null }
    try { const episodes = await this.catalog.episodes(showId); const conflicts = room.phase === 'setup' ? continuationProposal(room, showId, episodes).conflicts.get(actor.id) ?? [] : progressConflicts(room, actor).filter(c => c.showId === showId); return { showId, own, episodes, conflicts, catalogState: episodes.length ? 'ready' : 'unavailable', source: 'guest' } }
    catch { return { showId, own, episodes: [], conflicts: [{ showId, reason: 'episode_catalog_unavailable', ownNextEpisodeId: own.input.state === 'continue' ? own.input.nextEpisodeId : null, proposedEpisode: null }], catalogState: 'unavailable', source: 'guest' } }
  }
  async ticket(id: string, credential: ActorCredential): Promise<RealtimeTicket> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const previous = await this.get(id); const actor = this.auth(previous.room, credential); const room = structuredClone(previous.room)
      room.tickets = room.tickets.filter(t => t.expiresAt > this.now())
      requireRoom(room.tickets.filter(t => t.participantId === actor.id).length < LIMITS.tickets, 'limit_reached', 'Too many pending connection tickets')
      const ticket = random(); const expiresAt = Math.min(this.now() + 30_000, room.expiresAt)
      room.tickets.push({ hash: hash(ticket), participantId: actor.id, epoch: actor.epoch, expiresAt })
      try { if (await this.repository.compareAndSwap(previous, room, false)) return { ticket, expiresAt, websocketPath: '/api/yepwatch/v1/realtime' } }
      catch (e) { if (!(e instanceof IndeterminateWrite)) throw e; throw new RoomError('outcome_unknown', 'Ticket issue uncertain; request a fresh ticket after backoff', 503, true) }
    }
    throw new RoomError('busy', 'Room busy; retry ticket issue', 503, true)
  }
  private attachment(room: Room, participantId: string): RealtimeAttachment {
    const p = participant(room, participantId); const expiresAt = Math.min(this.now() + 60_000, room.expiresAt)
    const lease: Lease = { roomId: room.id, participantId, epoch: p.epoch, expiresAt, scope: 'shared:read' }
    return { roomId: room.id, participantId, lease: sign(this.secret, lease), leaseExpiresAt: expiresAt, roomExpiresAt: room.expiresAt, capabilityEpoch: p.epoch, scope: 'shared:read' }
  }
  async attach(id: string, ticket: string): Promise<RealtimeAttachment> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const previous = await this.get(id); const room = structuredClone(previous.room); const t = room.tickets.find(t => equal(t.hash, hash(ticket)))
      requireRoom(t && t.expiresAt > this.now(), 'unauthorized', 'Ticket expired or consumed', 401)
      const p = participant(room, t.participantId); requireRoom(p.epoch === t.epoch, 'forbidden', 'Capability revoked', 403)
      room.tickets = room.tickets.filter(other => other !== t)
      try {
        if (await this.repository.compareAndSwap(previous, room, false)) {
          const committed = await this.get(id); const current = participant(committed.room, p.id)
          requireRoom(current.epoch === t.epoch, 'forbidden', 'Capability revoked', 403)
          return this.attachment(committed.room, p.id)
        }
      } catch (e) { if (!(e instanceof IndeterminateWrite)) throw e; throw new RoomError('outcome_unknown', 'Ticket consumption uncertain; obtain a new ticket', 503, true) }
    }
    throw new RoomError('busy', 'Room busy; reconnect', 503, true)
  }
  async view(id: string, token: string): Promise<RealtimeViewResponse> {
    const lease = verify<Lease>(this.secret, token)
    requireRoom(lease && lease.roomId === id && lease.scope === 'shared:read' && Number.isFinite(lease.expiresAt) && lease.expiresAt > this.now(), 'unauthorized', 'Lease invalid or expired', 401)
    const { room } = await this.get(id); const p = participant(room, lease.participantId)
    requireRoom(p.epoch === lease.epoch, 'forbidden', 'Capability revoked', 403)
    return { ...this.attachment(room, p.id), snapshot: shared(room) }
  }
  /** Persistent pending_revision survives commit-before-publish crashes. Pub/Sub is only an at-most-once hint. */
  async notify(id: string): Promise<void> {
    try { const stored = await this.repository.read(id); if (!stored || stored.room.expiresAt <= this.now() || !stored.pendingRevision) return
      await this.publish({ roomId: id, revision: stored.room.revision }); await this.repository.acknowledge(id, stored.room.revision)
    } catch { /* Do not turn committed command into a failure or acknowledge a failed publish. Repair worker retries. */ }
  }
  async repairNotifications() { for (const id of await this.repository.pending(100)) await this.notify(id) }
}
