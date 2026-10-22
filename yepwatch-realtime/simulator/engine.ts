import { randomBytes } from 'node:crypto'
import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { paths, type ApiError, type CommandEnvelope, type GuestAdmission, type GuestCredential,
  type RoomCommand, type RoomSnapshot, type SharedRoomSnapshot, type VoteValue } from '@goodwatch/yepwatch-contracts'
import { sharedProjection } from '../src/projection.js'

export type Scenario = 'agreement' | 'disagreement' | 'slow'
export interface SimulatorConfig { apiOrigin: string; wsOrigin: string; appOrigin: string }
export function localOrigin(input: string, protocol: 'http:' | 'ws:') {
  const value = new URL(input)
  if (value.protocol !== protocol || value.hostname !== '127.0.0.1' || value.username || value.password ||
      value.pathname !== '/' || value.search || value.hash || !value.port) throw new Error('Use a 127.0.0.1 origin with an explicit local port')
  return value.origin
}
const nonce = () => randomBytes(24).toString('base64url')
class ApiFailure extends Error {
  constructor(readonly status: number, readonly failure?: ApiError['error']) { super(failure?.message ?? 'Local API unavailable') }
}
export interface SimActor {
  id: string; name: string; index: number; host: boolean; cookie?: string; credential?: GuestCredential
  snapshot: RoomSnapshot; ws?: WebSocket; connected: boolean; paused: boolean; busy: boolean; syncQueued: boolean; syncRevision: number
  status: string; error: string | null; lastAction: string; nextAt: number; pending?: CommandEnvelope
  needsRecovery: boolean; chain: Promise<unknown>; lastVotedId?: string
}
export class Simulator extends EventEmitter {
  readonly config: SimulatorConfig
  private actors: SimActor[] = []
  private invitePath = ''
  private roomId = ''
  private timer: NodeJS.Timeout
  private generation = 0
  private starting = false
  private tickBusy = false
  private closed = false
  scenario: Scenario = 'agreement'
  automatic = false
  paceMs = 1500
  shared?: SharedRoomSnapshot
  frames = 0
  privacyFailures = 0
  notice = 'Create a fresh demo. No retained rooms can be selected here.'
  constructor(config: SimulatorConfig) {
    super()
    this.config = { apiOrigin: localOrigin(config.apiOrigin, 'http:'), wsOrigin: localOrigin(config.wsOrigin, 'ws:'), appOrigin: localOrigin(config.appOrigin, 'http:') }
    this.timer = setInterval(() => { void this.tick() }, 200)
  }
  private changed() { this.emit('change', this.state()) }
  private async request<T>(path: string, body?: unknown, actor?: SimActor, browser = false): Promise<{ data: T; cookie?: string }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (browser || actor?.host) { headers.Origin = this.config.appOrigin; if (actor?.cookie) headers.Cookie = actor.cookie }
    else {
      headers['X-YepWatch-Client'] = 'native'
      if (actor?.credential) { headers.Authorization = `Bearer ${actor.credential.token}`; headers['X-YepWatch-Participant'] = actor.id }
    }
    let response: Response
    try {
      response = await fetch(new URL(path, this.config.apiOrigin), { method: body === undefined ? 'GET' : 'POST', headers,
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000), redirect: 'error' })
    } catch { throw new ApiFailure(0, { code: 'outcome_unknown', message: 'Local request outcome is unknown. Retry the retained action or create a fresh demo.', retryable: true }) }
    const data = await response.json() as T & ApiError
    if (!response.ok) throw new ApiFailure(response.status, data.error)
    return { data, cookie: response.headers.get('set-cookie') ?? undefined }
  }
  private queue<T>(actor: SimActor, work: () => Promise<T>): Promise<T> {
    const next = actor.chain.then(async () => {
      actor.busy = true; this.changed()
      try { return await work() }
      catch (error) {
        actor.error = error instanceof Error ? error.message : 'Local action failed'
        actor.status = 'Action needs attention'; this.changed(); throw error
      } finally { actor.busy = false; this.changed() }
    })
    actor.chain = next.catch(() => {})
    return next
  }
  private accept(actor: SimActor, snapshot: RoomSnapshot) {
    sharedProjection(snapshot.shared, this.roomId)
    if (snapshot.own.participantId !== actor.id) throw new Error('Wrong private actor projection')
    const previous = actor.snapshot
    if (snapshot.shared.revision >= previous.shared.revision && snapshot.own.nextSequence >= previous.own.nextSequence) actor.snapshot = snapshot
    if (!this.shared || snapshot.shared.revision >= this.shared.revision) this.shared = sharedProjection(snapshot.shared, this.roomId)
    actor.error = null
    this.status(actor)
    this.changed()
  }
  private async read(actor: SimActor) {
    const { data } = await this.request<RoomSnapshot>(paths.snapshot(this.roomId), undefined, actor)
    this.accept(actor, data)
  }
  private status(actor: SimActor) {
    if (!actor.connected) { actor.status = 'Disconnected · still required'; return }
    if (actor.snapshot.shared.revision < actor.syncRevision) { actor.status = 'Refreshing own private state'; return }
    const own = actor.snapshot.own, shared = actor.snapshot.shared
    if (shared.phase === 'voting') actor.status = own.roundCompleted ? 'Finished' : shared.candidates.every(c => own.votes.some(v => v.candidateId === c.id && v.value !== null)) ? 'Choices made · finish next' : 'Choosing'
    else if (shared.phase === 'shortlist') actor.status = shared.shortlist?.proposedCandidateId ? 'Proposal awaits private consent' : 'Round finished · host compares shortlist'
    else if (shared.phase === 'decided') actor.status = 'Decision confirmed'
    else actor.status = shared.participants.find(p => p.participantId === actor.id)?.ready ? 'Ready · waiting for host' : 'Setup'
  }
  private async command(actor: SimActor, command: RoomCommand) {
    if (this.closed) throw new Error('Local simulator stopped')
    if (actor.pending) throw new Error('Retry the pending action before a new command')
    const envelope: CommandEnvelope = { commandId: nonce(), sequence: actor.snapshot.own.nextSequence, command }
    actor.pending = envelope
    return this.sendPending(actor)
  }
  private async sendPending(actor: SimActor) {
    const envelope = actor.pending
    if (!envelope) throw new Error('No pending action')
    try {
      const { data } = await this.request<{ snapshot: RoomSnapshot }>(paths.commands(this.roomId), envelope, actor)
      actor.pending = undefined; actor.needsRecovery = false
      this.accept(actor, data.snapshot)
      return data.snapshot
    } catch (error) {
      actor.needsRecovery = true
      // Keep ID, sequence and body after ambiguous/temporary outcomes. Never manufacture a new vote.
      if (error instanceof ApiFailure && !['outcome_unknown', 'busy'].includes(error.failure?.code ?? '')) actor.pending = undefined
      throw error
    }
  }
  private async connect(actor: SimActor) {
    if (this.closed) throw new Error('Local simulator stopped')
    actor.ws?.close(1000, 'Fresh local subscription')
    const generation = this.generation
    const { data } = await this.request<{ ticket: string }>(paths.realtimeTicket(this.roomId), {}, actor)
    const ws = new WebSocket(`${this.config.wsOrigin}${paths.realtime}`, actor.host ? { origin: this.config.appOrigin } : {})
    actor.ws = ws
    await new Promise<void>((resolve, reject) => {
      let settled = false
      const timer = setTimeout(() => { ws.terminate(); reject(new Error('Local WebSocket snapshot timed out')) }, 6000)
      ws.on('open', () => ws.send(JSON.stringify({ type: 'authenticate', ticket: data.ticket, roomId: this.roomId, lastRevision: actor.snapshot.shared.revision })))
      ws.on('message', raw => {
        if (this.generation !== generation || actor.ws !== ws) return
        try {
          const frame = JSON.parse(raw.toString())
          if (frame.type === 'room.snapshot' || frame.type === 'room.updated') {
            const shared = sharedProjection(frame.snapshot, this.roomId)
            this.frames++
            if (!this.shared || shared.revision >= this.shared.revision) this.shared = shared
            actor.syncRevision = Math.max(actor.syncRevision, shared.revision)
            actor.connected = true; this.status(actor); this.changed()
            if (!settled) { settled = true; clearTimeout(timer); resolve() }
            // WS carries only shared state. Each actor refreshes its OWN private HTTP view.
            if (actor.syncRevision > actor.snapshot.shared.revision && !actor.syncQueued) {
              actor.syncQueued = true
              void this.queue(actor, async () => {
                try {
                  // Hints arriving during read() raise the target rather than being lost.
                  // Bounded catch-up avoids spinning if authority keeps returning old views.
                  for (let attempt = 0; attempt < 3 && !this.closed && this.generation === generation && actor.snapshot.shared.revision < actor.syncRevision; attempt++) await this.read(actor)
                  if (!this.closed && this.generation === generation && actor.snapshot.shared.revision < actor.syncRevision) {
                    actor.needsRecovery = true
                    throw new Error('Private state has not caught up. Use Recover / retry.')
                  }
                } finally { actor.syncQueued = false }
              }).catch(() => {})
            }
          } else if (frame.type === 'degraded' || frame.type === 'restarting') {
            actor.connected = false; actor.status = 'Transport degraded · no automated actions'; this.changed()
          } else if (frame.type === 'error') {
            clearTimeout(timer); reject(new Error('Local WebSocket authorization failed'))
          }
        } catch { this.privacyFailures++; actor.connected = false; actor.paused = true; ws.close(); this.changed() }
      })
      ws.on('close', () => {
        clearTimeout(timer)
        if (actor.ws !== ws) return
        actor.connected = false; this.status(actor); this.changed()
        if (!settled) reject(new Error('Local WebSocket closed before snapshot'))
      })
      ws.on('error', () => { clearTimeout(timer); if (!settled) reject(new Error('Local WebSocket connection failed')) })
    })
    await this.read(actor)
  }
  private actor(admission: GuestAdmission, name: string, index: number, host: boolean, cookie?: string): SimActor {
    return { id: admission.credential.participantId, name, index, host, cookie,
      credential: host ? undefined : admission.credential, snapshot: admission.snapshot,
      connected: false, paused: false, busy: false, syncQueued: false, syncRevision: admission.snapshot.shared.revision, status: 'Connecting', error: null,
      lastAction: 'None', nextAt: Date.now(), needsRecovery: false, chain: Promise.resolve() }
  }
  async fresh(options: { count: number; scenario: Scenario; paceMs: number }) {
    if (this.starting) throw new Error('Fresh demo creation is already running')
    if (![1, 2, 3].includes(options.count)) throw new Error('Choose one to three simulated people')
    if (!['agreement', 'disagreement', 'slow'].includes(options.scenario)) throw new Error('Unknown scenario')
    if (!Number.isInteger(options.paceMs) || options.paceMs < 300 || options.paceMs > 10_000) throw new Error('Pace must be 300–10000 ms')
    this.starting = true
    this.automatic = false; this.generation++
    for (const actor of this.actors) actor.ws?.close(1000, 'New local demo')
    this.actors = []; this.shared = undefined; this.roomId = ''; this.invitePath = ''; this.frames = 0; this.privacyFailures = 0
    this.scenario = options.scenario; this.paceMs = options.paceMs
    this.notice = 'Creating a NEW ordinary memory room. Previous room membership is not changed.'
    this.changed()
    try {
      const { data: admission, cookie } = await this.request<GuestAdmission>(paths.rooms, {
        commandId: nonce(), admissionSecret: nonce() + nonce(), nickname: 'Demo host' }, undefined, true)
      if (!cookie || admission.credential.token) throw new Error('Browser HttpOnly host cookie was not returned')
      this.roomId = admission.credential.roomId; this.invitePath = admission.invite.path
      const host = this.actor(admission, 'Demo host', -1, true, cookie.split(';')[0]); this.actors.push(host)
      for (let index = 0; index < options.count; index++) {
        const name = ['Sim Alex', 'Sim Bea', 'Sim Casey'][index]
        const { data } = await this.request<GuestAdmission>(paths.join(this.roomId), {
          commandId: nonce(), admissionSecret: nonce() + nonce(), nickname: name, inviteCode: admission.invite.code })
        this.actors.push(this.actor(data, name, index, false))
      }
      await this.read(host)
      await this.command(host, { type: 'setup', expectedContextVersion: host.snapshot.shared.contextVersion,
        screens: [{ id: 'demo-screen', label: 'Demo screen', country: 'DE', serviceIds: [8], confirmed: true }],
        constraints: { kinds: ['movie', 'show_start'], moods: [], maxMinutes: null }, screenId: 'demo-screen' })
      for (const actor of this.actors.filter(a => !a.host)) {
        await this.read(actor)
        await this.command(actor, { type: 'assign_screen', expectedContextVersion: actor.snapshot.shared.contextVersion, screenId: 'demo-screen' })
        await this.command(actor, { type: 'ready', expectedContextVersion: actor.snapshot.shared.contextVersion, ready: true })
      }
      for (const actor of this.actors) await this.connect(actor)
      this.notice = 'Fresh demo ready. Open the actual host app, then start there. Simulated choices and consent are artificial and private to these controlled demo guests.'
      this.changed()
      return { cookie, hostAppUrl: new URL(this.invitePath, this.config.appOrigin).href }
    } finally { this.starting = false; this.changed() }
  }
  private candidate(actor: SimActor) {
    const deck = actor.snapshot.shared.candidates
    const offset = actor.index % Math.max(deck.length, 1)
    const order = [...deck.slice(offset), ...deck.slice(0, offset)]
    return order.find(c => !actor.snapshot.own.votes.some(v => v.candidateId === c.id && v.value !== null))
  }
  private async vote(actor: SimActor, value: VoteValue | null, candidateId?: string) {
    const shared = actor.snapshot.shared
    const id = candidateId ?? this.candidate(actor)?.id
    if (!id || !shared.round) throw new Error('No active private card')
    const current = actor.snapshot.own.votes.find(v => v.candidateId === id)
    await this.command(actor, { type: 'vote', roundVersion: shared.round.version,
      candidateId: id, expectedVoteRevision: current?.revision ?? 0, value })
    actor.lastVotedId = id; actor.lastAction = value === null ? 'Artificial undo' : value === 'watch' ? 'Artificial Watch' : 'Artificial No'
  }
  async action(actorId: string, action: 'step' | 'watch' | 'pass' | 'finish' | 'accept' | 'decline' | 'undo' | 'pause' | 'resume' | 'disconnect' | 'reconnect' | 'retry') {
    const actor = this.actors.find(a => a.id === actorId && !a.host)
    if (!actor) throw new Error('Choose one of this fresh demo’s simulated people')
    if (action === 'pause' || action === 'resume') { actor.paused = action === 'pause'; actor.nextAt = Date.now(); this.changed(); return }
    if (action === 'disconnect') {
      actor.connected = false; actor.ws?.close(1000, 'Operator disconnected simulated person')
      this.status(actor); this.changed(); return
    }
    return this.queue(actor, async () => {
      if (action === 'reconnect') { await this.connect(actor); actor.lastAction = 'Fresh ticket + private state recovered'; return }
      if (!actor.connected) throw new Error('Reconnect this simulated person first; they still remain a required voter')
      if (action === 'retry') {
        if (actor.pending) await this.sendPending(actor)
        else { await this.read(actor); actor.needsRecovery = false }
        return
      }
      if (actor.needsRecovery) throw new Error('Use Recover / retry before another artificial action')
      await this.read(actor)
      const shared = actor.snapshot.shared
      if (action === 'watch' || action === 'pass') return this.vote(actor, action)
      if (action === 'undo') return this.vote(actor, null, actor.lastVotedId)
      if (action === 'finish') {
        if (!shared.round) throw new Error('No round')
        await this.command(actor, { type: 'complete_round', roundVersion: shared.round.version }); actor.lastAction = 'Artificial finish'; return
      }
      if (action === 'accept' || action === 'decline') {
        if (!shared.shortlist?.proposedCandidateId) throw new Error('Host must propose a shortlisted title first')
        await this.command(actor, { type: 'consent', proposalVersion: shared.shortlist.proposalVersion, accepted: action === 'accept' })
        actor.lastAction = action === 'accept' ? 'Artificial accept consent' : 'Artificial decline consent'; return
      }
      await this.step(actor)
    })
  }
  private async step(actor: SimActor) {
    const shared = actor.snapshot.shared
    if (shared.phase === 'setup') {
      const own = shared.participants.find(p => p.participantId === actor.id)
      if (!own?.screenId && shared.screens[0]) await this.command(actor, { type: 'assign_screen', expectedContextVersion: shared.contextVersion, screenId: shared.screens[0].id })
      else if (!own?.ready) await this.command(actor, { type: 'ready', expectedContextVersion: shared.contextVersion, ready: true })
      return
    }
    if (shared.phase === 'voting' && !actor.snapshot.own.roundCompleted) {
      const candidate = this.candidate(actor)
      if (!candidate) {
        await this.command(actor, { type: 'complete_round', roundVersion: shared.round!.version })
        actor.lastAction = 'Artificial finish after own choices'; return
      }
      const no = this.scenario === 'disagreement' && actor.index === 0
      await this.vote(actor, no ? 'pass' : 'watch'); return
    }
    if (shared.phase === 'shortlist' && shared.shortlist) {
      if (shared.shortlist.proposedCandidateId) {
        const own = actor.snapshot.own.consent
        if (!own || own.proposalVersion !== shared.shortlist.proposalVersion) {
          await this.command(actor, { type: 'consent', proposalVersion: shared.shortlist.proposalVersion, accepted: true })
          actor.lastAction = 'Artificial accept current proposal'
        }
      } else if (shared.shortlist.candidateIds[0] && !actor.snapshot.own.shortlistPreference) {
        await this.command(actor, { type: 'shortlist_preference', shortlistVersion: shared.shortlist.version, candidateId: shared.shortlist.candidateIds[0] })
        actor.lastAction = 'Artificial private preference · does not choose for room'
      }
    }
  }
  private async tick() {
    if (this.tickBusy || !this.automatic || this.closed || this.starting) return
    this.tickBusy = true
    try {
      await Promise.all(this.actors.filter(a => !a.host && !a.paused && !a.busy && a.connected && !a.needsRecovery && Date.now() >= a.nextAt).map(async actor => {
        const factor = this.scenario === 'slow' && actor === this.actors.at(-1) ? 5 : 1
        actor.nextAt = Date.now() + this.paceMs * factor
        await this.action(actor.id, 'step').catch(() => {})
      }))
    } finally { this.tickBusy = false }
  }
  async controls(input: { automatic?: boolean; paceMs?: number; scenario?: Scenario }) {
    if (input.automatic !== undefined && typeof input.automatic !== 'boolean') throw new Error('Automatic must be true or false')
    if (input.paceMs !== undefined && (!Number.isInteger(input.paceMs) || input.paceMs < 300 || input.paceMs > 10_000)) throw new Error('Pace must be 300–10000 ms')
    if (input.scenario && !['agreement', 'disagreement', 'slow'].includes(input.scenario)) throw new Error('Unknown scenario')
    if (input.automatic !== undefined) this.automatic = input.automatic
    if (input.paceMs !== undefined) this.paceMs = input.paceMs
    if (input.scenario) this.scenario = input.scenario
    this.changed()
  }
  state() {
    return { starting: this.starting, room: !!this.roomId, notice: this.notice,
      hostAppUrl: this.invitePath ? new URL(this.invitePath, this.config.appOrigin).href : null,
      automatic: this.automatic, scenario: this.scenario, paceMs: this.paceMs,
      phase: this.shared?.phase ?? 'none', sharedRevision: this.shared?.revision ?? null,
      sharedFrames: this.frames, privacyFailures: this.privacyFailures,
      shared: this.shared,
      actors: this.actors.map(actor => {
        const candidate = actor.host ? undefined : this.candidate(actor)
        const own = actor.snapshot.own
        return { id: actor.id, name: actor.name, host: actor.host, connected: actor.connected, paused: actor.paused,
          busy: actor.busy, status: actor.status, error: actor.error, needsRecovery: actor.needsRecovery,
          lastAction: actor.lastAction, privateCard: candidate ? { title: candidate.title, kind: candidate.identity.kind } : null,
          privateAnswered: own.votes.filter(v => v.value !== null).length, privateFinished: own.roundCompleted,
          privateConsent: own.consent?.accepted ?? null }
      }) }
  }
  close() {
    this.closed = true; clearInterval(this.timer); this.generation++
    for (const actor of this.actors) actor.ws?.close(1000, 'Local simulator stopped')
  }
}
